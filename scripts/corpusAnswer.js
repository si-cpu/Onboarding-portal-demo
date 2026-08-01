// generateDummyCorpus.js가 미리 만들어둔 scripts/dummyCorpus.json에서 품질별
// 더미 답변을 꺼내온다. 파일이 없으면 false를 반환하고, 호출부(runLoadTest.js)는
// dummyAnswer.js의 즉석 템플릿 생성기로 폴백한다.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CORPUS_PATH = fileURLToPath(new URL("./dummyCorpus.json", import.meta.url));

let cachedCorpus = null;

export function loadCorpus() {
  if (cachedCorpus !== null) return cachedCorpus;
  cachedCorpus = existsSync(CORPUS_PATH) ? JSON.parse(readFileSync(CORPUS_PATH, "utf-8")) : false;
  return cachedCorpus;
}

// seed로 품질 레벨(high/medium/low 또는 evasive)을 순환시켜가며 골라,
// 라운드마다 서로 다른 품질의 답변이 골고루 채점되도록 한다.
export function pickFromCorpus(mission, seed) {
  const corpus = loadCorpus();
  const variants = corpus ? corpus[mission.id] : null;
  if (!variants?.length) return null;
  const variant = variants[seed % variants.length];
  return { answerText: variant.answerText, quality: variant.quality };
}
