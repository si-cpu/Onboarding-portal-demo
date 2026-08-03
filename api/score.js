// Vercel 서버리스 함수: POST /api/score
// Headers: Authorization: Bearer <firebase idToken>
// body: { missionId, answerText }
//
// 흐름:
// 1. idToken을 검증해 uid를 얻는다 (body의 userId는 신뢰하지 않는다).
// 2. answerText로 answerHash를 서버에서 재계산해 캐시(Firestore responses 컬렉션) 조회
//    → 있으면 즉시 반환 (재현성 보장, API 비용 절감)
// 3. 없으면 Claude API로 채점(사실형: 구체성/연관성/성찰깊이, 정서형: 정서일관성 루브릭) +
//    nudge.js로 넛지 문장 생성
// 4. 결과를 Firestore에 저장(점수는 이후 고정·불변) 후 안전한 필드만 반환
//
// 응답에는 feedback_text/nudge_text만 담긴다 — scores/evidence_density는 이 API가
// 절대 클라이언트로 내려보내지 않는다 (점수 비공개 원칙을 프론트 렌더링 규칙이 아니라
// API 레이어에서 강제한다).

import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { MISSION_BANK } from "./missionBank.js";
import { adminDb, requireUid, requireIntern } from "./_firebaseAdmin.js";
import { hashAnswer } from "./_hash.js";
import { generateNudgeText } from "./nudge.js";
import { getCurrentWeek } from "./_week.js";
import { newRequestId, log, alert } from "./_logger.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// "300자 이내로 적어주세요" 안내보다 넉넉하게 잡은 서버 측 상한 — 플레이스홀더는
// 안내일 뿐 강제가 아니므로, 비정상적으로 긴 입력이 그대로 Claude 호출 비용으로
// 이어지는 걸 막기 위한 방어선이다.
const MAX_ANSWER_LENGTH = 500;

// 루브릭 설명(추상적 기준)만으로는 같은 품질의 답변도 호출마다 점수가 5~15점씩
// 흔들리는 게 LLM 채점의 흔한 문제다. 구체적인 점수대별 예시(앵커)를 프롬프트에
// 박아 넣어서 "이 정도면 몇 점대"라는 기준점을 고정한다 — 특정 미션에 종속되지
// 않는 범용 예시로, 모든 사실형/정서형 미션에 재사용한다.
const RUBRIC_FACTUAL = `
아래 3개 축으로 0~100점씩 채점하고, 가중합산(구체성 40% + 연관성 30% + 성찰깊이 30%)으로 최종 점수를 산출하라.
- 구체성(Specificity): 추상적 표현 대신 실제 사례·행동·수치가 있는가. 근거 없는 주장은 감점.
- 연관성(Relevance): 질문이 의도한 상황과 답변이 실제로 맞닿아 있는가.
- 성찰 깊이(Reflection): 단순 사실 나열이 아니라 "왜 그렇게 했는지, 다음엔 어떻게 할지"까지 있는가.

채점 기준점(앵커) 예시 — 아래와 비슷한 수준이면 비슷한 점수대로 채점하라:
- 85~95점대 예시: "화요일에 API 응답 지연이 3초까지 늘어난 걸 발견해서, 로그를 뒤져 N+1 쿼리가 원인임을
  확인했다. 캐시를 붙여 평균 300ms로 줄였고, 왜 처음부터 인덱스를 안 걸었는지 점검 리스트를 만들어
  다음 스프린트에 반영하기로 했다." (구체적 수치·행동·원인 분석·다음 계획이 모두 있음)
- 35~45점대 예시: "이번 주에도 여러 이슈가 있었지만 잘 대응한 것 같다. 앞으로도 꾸준히 노력하겠다."
  (수치·구체적 행동·원인 분석이 전혀 없고 질문에 실제로 답하지 않음)
`;

const RUBRIC_EMOTIONAL = `
아래 기준으로 0~100점 채점하라.
- 정서 일관성(Tone Consistency): 질문이 묻는 감정 상태(예: 힘 빠짐)와 답변의 톤이 일치하는가.
  성과 자랑이나 지나치게 긍정적인 포장으로 회피하는 답변은 감점하라.
- 구체성: 실제 순간에 대한 구체적 묘사가 있는가.

채점 기준점(앵커) 예시:
- 80~90점대 예시: "금요일 오후에 세 번째로 같은 버그를 마주쳤을 때 정말 자신감이 떨어졌다. 그냥
  퇴근하고 싶었는데, 동료가 '나도 저번에 그거 이틀 걸렸다'고 한 말에 다시 붙잡고 앉았다." (감정 상태를
  회피하지 않고 구체적 순간·계기까지 서술)
- 30~40점대 예시: "이번 주는 힘든 일도 있었지만 전반적으로 성과가 좋아서 만족스러웠다." (질문이 묻는
  '힘 빠짐'을 실제로 다루지 않고 성과 자랑으로 우회함 — 정서 일관성 위반)
`;

export default async function handler(req, res) {
  const requestId = newRequestId();
  const receivedAt = Date.now();
  if (req.method !== "POST") return res.status(405).end();

  let uid;
  try {
    uid = await requireUid(req);
    await requireIntern(uid);
  } catch (e) {
    alert(requestId, "score.auth_failed", { status: e.status, message: e.message });
    return res.status(e.status ?? 401).json({ error: e.status === 403 ? "신입 전용 기능입니다." : "인증이 필요합니다." });
  }

  const { missionId, answerText } = req.body ?? {};
  log(requestId, "score.request_received", { uid, missionId, answerLength: answerText?.length ?? 0 });

  const mission = MISSION_BANK.find((m) => m.id === missionId);
  if (!mission || !answerText?.trim()) {
    log(requestId, "score.invalid_input", { uid, missionId });
    return res.status(400).json({ error: "invalid missionId or answerText" });
  }
  if (answerText.length > MAX_ANSWER_LENGTH) {
    log(requestId, "score.answer_too_long", { uid, missionId, length: answerText.length });
    return res.status(400).json({ error: `답변은 ${MAX_ANSWER_LENGTH}자를 넘을 수 없습니다.` });
  }

  // 클라이언트(MissionPage)는 currentWeek에 해당하는 미션만 렌더링하지만, 그건
  // UI 레벨 가드일 뿐이다 — comprehensiveReview.js가 reviewType을 서버에서 직접
  // 검증하는 것과 같은 이유로, 여기서도 joinedAt 기준 실제 주차와 missionId가
  // 일치하는지 서버가 직접 검증해야 한다(그래야 임의 missionId 조기 제출을 막는다).
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const joinedAt = userSnap.data()?.joinedAt?.toDate?.() ?? null;
  const currentWeek = getCurrentWeek(joinedAt);
  if (missionId !== currentWeek) {
    log(requestId, "score.wrong_week", { uid, missionId, currentWeek });
    return res.status(403).json({ error: "이번 주 미션이 아닙니다." });
  }

  const answerHash = hashAnswer(answerText);
  const responses = adminDb.collection("responses");

  try {
    const cachedSnap = await responses
      .where("userId", "==", uid)
      .where("missionId", "==", missionId)
      .where("answerHash", "==", answerHash)
      .limit(1)
      .get();

    if (!cachedSnap.empty) {
      const cached = cachedSnap.docs[0].data();
      log(requestId, "score.cache_hit", { uid, missionId, round: cached.round });
      return res.status(200).json({
        feedback_text: cached.feedback_text,
        nudge_text: cached.nudge_text ?? null,
        cached: true,
      });
    }

    // 같은 주차 미션에 이미 (다른 텍스트로) 제출한 기록이 있으면 재제출을 막는다.
    // 해시가 다른 이상 위 캐시 히트로는 안 걸러지므로 별도 체크가 필요하다 —
    // 이게 없으면 같은 missionId로 여러 번 다르게 제출해 round가 계속 쌓일 수 있고,
    // comprehensiveReview.js가 missionId 중복 제거 없이 그대로 훑기 때문에 중복
    // 데이터가 종합 해석에 섞여 들어간다.
    //
    // 이 체크는 "빠른 경로"일 뿐이다 — 여기서 통과해도 아래 트랜잭션 안에서 다시
    // 검증한다. 두 요청이 거의 동시에 도착하면(더블클릭, 네트워크 재시도, 다중 탭)
    // 둘 다 이 체크를 통과할 수 있고, 이 체크만으로는 라운드 계산 트랜잭션의 재시도
    // 경로에서 두 번째 문서가 만들어지는 걸 못 막는다(코드 리뷰로 발견) — 진짜
    // 직렬화는 트랜잭션 안의 재검증이 담당하고, 이 체크는 그 전에 대부분의 경우
    // Claude 호출 비용을 아끼기 위한 최적화다.
    const existingSnap = await responses
      .where("userId", "==", uid)
      .where("missionId", "==", missionId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      log(requestId, "score.already_submitted", { uid, missionId });
      return res.status(409).json({ error: "이번 주 미션에는 이미 답변을 제출했습니다." });
    }

    const rubric = mission.type === "정서형" ? RUBRIC_EMOTIONAL : RUBRIC_FACTUAL;
    const prompt = `
당신은 신입사원 온보딩 회고 답변을 채점하는 평가자입니다.
측정 대상 핵심가치: ${mission.mapped.primary} (보조: ${mission.mapped.secondary.join(", ")})

${rubric}

질문: ${mission.question}
답변: ${answerText}

feedback_text 작성 규칙:
- 옆자리 동료가 진심으로 건네는 코멘트처럼 편안하고 자연스러운 구어체로 쓸 것 — 딱딱한 평가 보고서 톤 금지
- "~점이 인상적입니다", "~한 점이 돋보입니다" 같은 정형화된 문장 틀을 매번 반복하지 말고, 이번 답변 내용에 맞게 표현을 매번 다르게 바꿀 것
- 점수나 가치명은 절대 언급하지 말 것

다음 JSON 형식으로만 응답하라 (다른 텍스트 없이):
{
  "scores": { "${mission.mapped.primary}": 0-100, ${mission.mapped.secondary
      .map((v) => `"${v}": 0-100`)
      .join(", ")} },
  "feedback_text": "위 feedback_text 작성 규칙을 따른 정성 피드백 2~3문장",
  "evidence_density": "high" | "medium" | "low"
}
`;

    log(requestId, "score.claude_call_start", { uid, missionId, missionType: mission.type });
    const claudeStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      temperature: 0, // 재현성 확보 (점수 고정 원칙)
      messages: [{ role: "user", content: prompt }],
    });
    log(requestId, "score.claude_call_end", {
      uid,
      missionId,
      ms: Date.now() - claudeStart,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      alert(requestId, "score.parse_failed", { uid, missionId, raw: raw.slice(0, 300) });
      return res.status(500).json({ error: "AI 응답 파싱 실패" });
    }

    let nudgeText = null;
    try {
      nudgeText = await generateNudgeText({
        uid,
        currentScores: parsed.scores,
        question: mission.question,
        requestId,
      });
    } catch (e) {
      // 넛지 생성 실패는 채점 자체를 막지 않지만, 조용히 계속 실패하고 있는지
      // 알 수 있어야 하므로 alert로 남긴다.
      alert(requestId, "score.nudge_failed", { uid, missionId, message: e.message });
      nudgeText = null;
    }

    // round 계산(개수 세기), "이미 제출됐는지" 재검증, 문서 생성을 하나의 트랜잭션으로
    // 묶는다. 위의 existingSnap 체크만으로는 두 요청이 동시에 그 체크를 통과한 뒤
    // 각자 트랜잭션에 들어오는 경우를 못 막는다 — Firestore 트랜잭션은 읽은 쿼리
    // 결과가 커밋 전에 바뀌면 자동으로 재시도하는데, 재시도 시점엔 상대방이 이미
    // 써놓은 문서가 priorSnap에 보이므로 "먼저 커밋한 쪽만 성공"이 아니라 여기서
    // ALREADY_SUBMITTED로 명시적으로 막아야 재시도한 쪽이 round=2로 중복 문서를
    // 만드는 걸 원천 차단할 수 있다(코드 리뷰로 발견 — 실질적으로 같은 유저·같은
    // missionId에 대한 제출을 직렬화하는 역할).
    const docRef = adminDb.collection("responses").doc();
    let round;
    try {
      round = await adminDb.runTransaction(async (tx) => {
        const priorSnap = await tx.get(
          responses.where("userId", "==", uid).where("missionId", "==", missionId)
        );
        if (priorSnap.size > 0) {
          const err = new Error("already submitted (race)");
          err.code = "ALREADY_SUBMITTED";
          throw err;
        }
        tx.set(docRef, {
          userId: uid,
          missionId,
          round: 1,
          answerText,
          answerHash,
          scores: parsed.scores,
          evidence_density: parsed.evidence_density ?? null,
          feedback_text: parsed.feedback_text,
          nudge_text: nudgeText,
          createdAt: FieldValue.serverTimestamp(),
          requestId,
          receivedAt: new Date(receivedAt).toISOString(),
          durationMs: Date.now() - receivedAt,
        });
        return 1;
      });
    } catch (e) {
      if (e.code === "ALREADY_SUBMITTED") {
        log(requestId, "score.already_submitted_race", { uid, missionId });
        return res.status(409).json({ error: "이번 주 미션에는 이미 답변을 제출했습니다." });
      }
      throw e;
    }

    log(requestId, "score.stored", { uid, missionId, docId: docRef.id, round, totalMs: Date.now() - receivedAt });

    return res.status(200).json({
      feedback_text: parsed.feedback_text,
      nudge_text: nudgeText,
      cached: false,
    });
  } catch (e) {
    alert(requestId, "score.unhandled_error", { uid, missionId, message: e.message, stack: e.stack });
    return res.status(500).json({ error: "채점 처리 중 오류가 발생했습니다." });
  }
}
