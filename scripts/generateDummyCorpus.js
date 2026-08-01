// 채점 루브릭이 답변 품질에 따라 실제로 다르게 반응하는지 확인하기 위한
// "품질별 더미 답변" 코퍼스를 Claude로 한 번만 생성해서 파일로 캐싱한다.
// (dummyAnswer.js의 JS 템플릿은 문장 구조가 거의 동일해서 구체성/성찰깊이
// 차이를 테스트하기엔 부족함 — 이 스크립트는 미션별로 high/medium/low(또는
// evasive) 품질의 답변을 실제로 다르게 써서 루브릭이 그 차이를 잡아내는지
// 확인할 수 있게 해준다)
//
// 실행: node --env-file=.env.local scripts/generateDummyCorpus.js
// 결과: scripts/dummyCorpus.json (9개 미션 x 품질별 답변, 1회성 생성 비용만 발생)

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { MISSION_BANK } from "../api/missionBank.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// score.js의 RUBRIC_FACTUAL/RUBRIC_EMOTIONAL 채점 기준에 맞춰 의도적으로
// 품질을 갈라놓은 답변을 만든다 — 실제로 채점해봤을 때 점수/피드백이
// 이 의도대로 갈리는지가 곧 "루브릭이 제대로 동작하는지"의 확인 방법이다.
const FACTUAL_LEVELS = [
  { quality: "high", guide: "실제 사례·행동·수치가 구체적으로 드러나고, 왜 그렇게 했는지와 다음엔 어떻게 할지까지 성찰이 깊은 답변" },
  { quality: "medium", guide: "사실 전달은 되지만 구체적인 수치나 행동 묘사가 부족하고, 성찰은 표면적인 수준인 답변" },
  { quality: "low", guide: "추상적인 표현 위주이고 근거 없는 주장이 많으며, 질문 의도와 약간 어긋나는 답변" },
];

const EMOTIONAL_LEVELS = [
  { quality: "high", guide: "질문이 묻는 감정 상태와 톤이 일치하고, 실제 순간에 대한 구체적 묘사가 있는 답변" },
  { quality: "medium", guide: "감정을 언급하긴 하지만 다소 피상적이고 구체적 묘사가 부족한 답변" },
  { quality: "evasive", guide: "힘들었던 감정을 솔직히 다루지 않고 성과 자랑이나 지나치게 긍정적인 포장으로 회피하는 답변 (루브릭상 감점 대상)" },
];

async function generateForMission(mission) {
  const levels = mission.type === "정서형" ? EMOTIONAL_LEVELS : FACTUAL_LEVELS;
  const prompt = `다음은 신입사원 온보딩 회고 질문입니다.

질문: ${mission.question}

아래 ${levels.length}개 품질 수준에 맞는 답변을 각각 하나씩, 실제 신입사원이 쓸 법한 자연스러운 한국어 문체로 200~350자 분량으로 작성하세요. 같은 사람이 쓴 것처럼 보이지 않도록 소재(업무 종류, 상황)도 서로 다르게 하세요.

${levels.map((l) => `- ${l.quality}: ${l.guide}`).join("\n")}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
[${levels.map((l) => `{"quality": "${l.quality}", "answerText": "..."}`).join(", ")}]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    temperature: 1,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "[]";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    throw new Error(`미션 #${mission.id} 응답 파싱 실패: ${raw.slice(0, 200)}`);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY가 필요합니다.");
    console.error("실행: node --env-file=.env.local scripts/generateDummyCorpus.js");
    process.exit(1);
  }

  const corpus = {};
  for (const mission of MISSION_BANK) {
    console.log(`미션 #${mission.id} (${mission.type}) 답변 생성 중...`);
    corpus[mission.id] = await generateForMission(mission);
  }

  const outPath = new URL("./dummyCorpus.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(corpus, null, 2));
  console.log(`완료: scripts/dummyCorpus.json 에 미션 ${MISSION_BANK.length}개 x 품질별 답변 저장`);
  console.log("이제 runLoadTest.js를 돌리면 이 코퍼스를 자동으로 사용합니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
