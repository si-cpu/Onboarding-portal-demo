// Vercel 서버리스 함수: POST /api/comprehensiveReview
// Headers: Authorization: Bearer <firebase idToken>
// body: { reviewType: "mid" | "final" }
//
// 3개월차(13주)/6개월차(26주) 시점에 그동안 쌓인 답변들을 모아 Claude가 종합
// 성장 서사를 생성한다. growthNarrative.js와 같은 원칙(점수/가치명 비공개,
// 관찰자 시점, 판단형 표현 금지)을 따르되 범위가 훨씬 넓다(최대 25개 답변).
//
// reviewType은 클라이언트가 주장하는 값을 그대로 믿지 않는다 — joinedAt으로
// 서버가 직접 "지금 정말 그 리뷰 주차에 도달했는지" 검증한 뒤에만 생성한다.
//
// 한 번 생성한 리뷰는 Firestore(reviews 컬렉션)에 캐싱해서 재방문 시 재사용한다
// (점수 고정 원칙과 같은 맥락 — 같은 리뷰가 방문할 때마다 달라지면 안 된다).

import Anthropic from "@anthropic-ai/sdk";
import { MISSION_BANK } from "./missionBank.js";
import { adminDb, requireUid, requireIntern } from "./_firebaseAdmin.js";
import { getCurrentWeek, MID_REVIEW_WEEK, FINAL_REVIEW_WEEK } from "./_week.js";
import { newRequestId, log, alert } from "./_logger.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIN_RESPONSES_REQUIRED = 3;

export default async function handler(req, res) {
  const requestId = newRequestId();
  if (req.method !== "POST") return res.status(405).end();

  let uid;
  try {
    uid = await requireUid(req);
    await requireIntern(uid);
  } catch (e) {
    alert(requestId, "comprehensiveReview.auth_failed", { status: e.status, message: e.message });
    return res.status(e.status ?? 401).json({ error: e.status === 403 ? "신입 전용 기능입니다." : "인증이 필요합니다." });
  }

  const { reviewType } = req.body ?? {};
  if (reviewType !== "mid" && reviewType !== "final") {
    return res.status(400).json({ error: "invalid reviewType" });
  }

  // 서버가 직접 joinedAt으로 지금이 정말 그 리뷰 주차인지 확인한다.
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const joinedAt = userSnap.data()?.joinedAt?.toDate?.() ?? null;
  const currentWeek = getCurrentWeek(joinedAt);
  const requiredWeek = reviewType === "mid" ? MID_REVIEW_WEEK : FINAL_REVIEW_WEEK;

  if (currentWeek < requiredWeek) {
    log(requestId, "comprehensiveReview.not_yet_eligible", { uid, reviewType, currentWeek, requiredWeek });
    return res.status(403).json({ error: "아직 이 리뷰를 볼 수 있는 시점이 아닙니다." });
  }

  const reviewDocId = `${uid}_${reviewType}`;
  const reviewRef = adminDb.collection("reviews").doc(reviewDocId);

  const cached = await reviewRef.get();
  if (cached.exists) {
    log(requestId, "comprehensiveReview.cache_hit", { uid, reviewType });
    return res.status(200).json({ narrative_text: cached.data().narrative_text, cached: true });
  }

  // 이 리뷰 주차 "이전"에 완료된 미션들만 종합한다 (mid: 1~12주, final: 1~25주).
  const maxMissionId = requiredWeek - 1;
  const snap = await adminDb.collection("responses").where("userId", "==", uid).orderBy("round", "asc").get();
  const included = snap.docs
    .map((doc) => doc.data())
    .filter((d) => d.missionId <= maxMissionId)
    .sort((a, b) => a.missionId - b.missionId);

  if (included.length < MIN_RESPONSES_REQUIRED) {
    log(requestId, "comprehensiveReview.insufficient_data", { uid, reviewType, count: included.length });
    return res.status(400).json({ error: "종합 해석을 만들기엔 아직 쌓인 답변이 부족합니다." });
  }

  const answersBlock = included
    .map((d) => {
      const mission = MISSION_BANK.find((m) => m.id === d.missionId);
      const date = d.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? "";
      return `[${d.missionId}주차 · ${date}]\n질문: ${mission?.question ?? ""}\n답변: ${d.answerText}`;
    })
    .join("\n\n");

  const periodLabel = reviewType === "mid" ? "3개월(약 12주)" : "6개월(약 25주)";
  const prompt = `다음은 한 신입사원이 온보딩 ${periodLabel} 동안 매주 서로 다른 질문에 답한 회고 기록입니다.

${answersBlock}

이 기록 전체를 훑어보고, 신입 본인에게 보여줄 종합 성장 서사를 작성하세요.
규칙:
- 평가하거나 점수를 매기지 말 것 (예: "좋아졌다", "부족하다", "우수하다" 같은 판단형 표현 금지)
- 점수/가치명은 절대 언급하지 말 것
- 담담한 관찰자 시점으로, 시간이 지나며 답변에서 실제로 무엇이 달라졌는지(다루는 주제, 대응 방식, 표현 등)를 서술
- 5문장 이내
- 다른 설명·따옴표·JSON 없이 서사 본문만 출력할 것

서사 본문만 그대로 출력하라 (앞뒤에 아무것도 붙이지 말 것).`;

  log(requestId, "comprehensiveReview.claude_call_start", { uid, reviewType, sourceCount: included.length });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  // narrative_text는 필드 하나짜리 문자열이라 JSON으로 감싸 봐야 얻는 게 없고,
  // 오히려 서사 안에 인용부호가 섞여 들어가면(신입 답변을 인용하는 경우 흔함)
  // JSON.parse가 깨지는 위험만 생긴다 — 실제로 3개월 리뷰에서 이 파싱 실패가
  // 발생했다(6개월 리뷰는 우연히 통과). 그래서 그냥 응답 텍스트를 그대로 쓴다.
  const narrative_text = response.content.find((b) => b.type === "text")?.text?.trim();
  if (!narrative_text) {
    alert(requestId, "comprehensiveReview.empty_response", { uid, reviewType });
    return res.status(500).json({ error: "AI 응답이 비어있습니다." });
  }

  await reviewRef.set({
    uid,
    reviewType,
    narrative_text,
    sourceCount: included.length,
    generatedAt: new Date().toISOString(),
  });

  log(requestId, "comprehensiveReview.generated", { uid, reviewType, sourceCount: included.length });
  return res.status(200).json({ narrative_text, cached: false });
}
