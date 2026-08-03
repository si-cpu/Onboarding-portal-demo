// score.js와 comprehensiveReview.js가 함께 쓰는 출력 유출 검사. 프롬프트로 "가치명/점수를
// 언급하지 말라"고만 지시하면 (a) 모델이 실수로 어길 수 있고 (b) 사용자 입력(답변 텍스트)에
// 섞인 인젝션이 그 지시 자체를 흔들 수 있다 — 지시만 믿지 않고 AI 출력을 직접 검사해서
// 미션 블라인드·점수 비공개 원칙을 API 레이어에서 한 번 더 강제한다.
import { ALL_CORE_VALUES } from "./_coreValues.js";

export function textLeaksSensitiveInfo(text) {
  if (!text) return false;
  if (ALL_CORE_VALUES.some((v) => text.includes(v))) return true;
  if (/\d{1,3}\s*점/.test(text)) return true;
  return false;
}
