// ⚠️ 이 파일은 default export(핸들러)가 없다 — Vercel이 별도 HTTP 라우트로 노출하지 않는다.
// score.js가 채점 직후 내부적으로 import해서 호출하는 서버 전용 헬퍼 모듈이다.
// (신입에게는 nudge_text 한 문장만 노출되고, 이 계산에 쓰인 실제 점수/가치명은 응답에 절대 포함하지 않는다)

import Anthropic from "@anthropic-ai/sdk";
import { adminDb } from "./_firebaseAdmin.js";
import { log, alert } from "./_logger.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 최근 응답들의 점수를 가치명 기준으로 평균 내어, 현재 제출 포함 상대적으로
// 가장 덜 드러난(점수가 낮은) 가치를 하나 골라 행동 제안 문장으로 바꿔준다.
// requestId는 score.js가 넘겨주는 값을 그대로 써서 로그를 한 요청으로 엮는다.
export async function generateNudgeText({ uid, currentScores, question, requestId }) {
  const recentSnap = await adminDb
    .collection("responses")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  const totals = {};
  const counts = {};
  const accumulate = (scores) => {
    for (const [value, score] of Object.entries(scores ?? {})) {
      totals[value] = (totals[value] ?? 0) + score;
      counts[value] = (counts[value] ?? 0) + 1;
    }
  };
  accumulate(currentScores);
  recentSnap.forEach((doc) => accumulate(doc.data().scores));

  const averages = Object.keys(totals).map((value) => ({
    value,
    avg: totals[value] / counts[value],
  }));
  if (averages.length === 0) return null;

  averages.sort((a, b) => a.avg - b.avg);
  const weakest = averages[0].value;
  log(requestId, "nudge.weakest_value_selected", { uid, weakest, sampleSize: recentSnap.size + 1 });

  const prompt = `당신은 신입사원에게 보여줄 성장 넛지 문장을 작성하는 어시스턴트입니다.
아래 핵심가치는 최근 답변들 대비 상대적으로 덜 드러난 영역입니다: "${weakest}"

이 질문에 대한 답변을 기준으로 판단했습니다: "${question}"

규칙:
- 가치명("${weakest}")을 문장에 절대 직접 언급하지 말 것
- 점수나 순위를 언급하지 말 것
- 신입이 다음에 시도해볼 수 있는 구체적 행동 제안으로 1문장만 작성할 것
- 딱딱한 평가 보고서 톤이 아니라, 옆자리 동료가 편하게 건네는 말투로 쓸 것
- 다른 설명·따옴표·JSON 없이 문장 하나만 출력할 것

문장 하나만 그대로 출력하라 (앞뒤에 아무것도 붙이지 말 것).`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  // comprehensiveReview.js에서 실제로 겪은 것과 같은 이유로 JSON 래핑을 없앴다 —
  // 문장 하나짜리 응답을 JSON으로 감싸면 인용부호 등에 파싱이 깨질 위험만 있고
  // 얻는 게 없다.
  const nudgeText = response.content.find((b) => b.type === "text")?.text?.trim();
  if (!nudgeText) {
    alert(requestId, "nudge.empty_response", { uid });
    return null;
  }
  return nudgeText;
}
