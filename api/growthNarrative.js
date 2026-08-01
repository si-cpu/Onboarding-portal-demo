// Vercel 서버리스 함수: POST /api/growthNarrative
// Headers: Authorization: Bearer <firebase idToken>
// body: { missionId }
//
// 같은 질문에 대한 여러 라운드의 답변을 모아 Claude가 "성장 서사"를 자연어로 요약 생성한다.
// 이건 단순 집계로는 불가능하고, 장문맥 이해가 필요한 LLM 고유 작업이라
// "AI가 반드시 필요한 기능"의 핵심 근거가 된다.
//
// 답변 원문은 클라이언트가 보내는 게 아니라, uid로 Firestore에서 서버가 직접 조회한다
// (신입이 다른 사람의 답변을 roundAnswers에 끼워 넣어 서사를 조작할 수 없도록).
//
// 출력은 정량 점수가 아니라 신입 본인에게 보여줄 서사(narrative_text) —
// 6개월 타임라인 화면(TimelineView)에서 각 질문 하단에 노출한다.

import Anthropic from "@anthropic-ai/sdk";
import { MISSION_BANK } from "./missionBank.js";
import { adminDb, requireUid, requireIntern } from "./_firebaseAdmin.js";
import { newRequestId, log, alert } from "./_logger.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  const requestId = newRequestId();
  if (req.method !== "POST") return res.status(405).end();

  let uid;
  try {
    uid = await requireUid(req);
    await requireIntern(uid);
  } catch (e) {
    alert(requestId, "growthNarrative.auth_failed", { status: e.status, message: e.message });
    return res.status(e.status ?? 401).json({ error: e.status === 403 ? "신입 전용 기능입니다." : "인증이 필요합니다." });
  }

  const { missionId } = req.body ?? {};
  log(requestId, "growthNarrative.request_received", { uid, missionId });

  const mission = MISSION_BANK.find((m) => m.id === missionId);
  if (!mission) return res.status(400).json({ error: "invalid missionId" });

  const snap = await adminDb
    .collection("responses")
    .where("userId", "==", uid)
    .where("missionId", "==", missionId)
    .orderBy("round", "asc")
    .get();

  if (snap.size < 2) {
    log(requestId, "growthNarrative.insufficient_rounds", { uid, missionId, rounds: snap.size });
    return res.status(400).json({ error: "최소 2개 라운드의 답변이 필요합니다." });
  }

  const answersBlock = snap.docs
    .map((doc) => {
      const d = doc.data();
      const date = d.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? "";
      return `[${d.round}번째 제출 · ${date}]\n${d.answerText}`;
    })
    .join("\n\n");

  const prompt = `다음은 같은 질문에 대해 시간 간격을 두고 작성된 한 신입사원의 답변들입니다.

질문: ${mission.question}

${answersBlock}

이 답변들을 비교해서, 신입 본인에게 보여줄 짧은 성장 서사를 작성하세요.
규칙:
- 평가하거나 점수를 매기지 말 것 (예: "좋아졌다", "부족하다" 같은 판단형 표현 금지)
- 담담하게 "무엇이 달라졌는지"를 관찰자 시점으로 서술
- 3문장 이내
- 점수/가치명은 절대 언급하지 말 것

다음 JSON 형식으로만 응답하라:
{ "narrative_text": "..." }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    alert(requestId, "growthNarrative.parse_failed", { uid, missionId, raw: raw.slice(0, 300) });
    return res.status(500).json({ error: "AI 응답 파싱 실패" });
  }

  log(requestId, "growthNarrative.generated", { uid, missionId, rounds: snap.size });
  return res.status(200).json(parsed);
}
