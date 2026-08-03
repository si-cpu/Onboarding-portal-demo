import { callApi } from "../lib/api";

// /api/score, /api/checkCache, /api/comprehensiveReview 호출을 감싸는 얇은 훅.
// 로딩/에러 상태는 호출하는 컴포넌트가 각자 관리한다 (제출 폼 vs 히스토리 목록의
// 로딩 UX가 서로 다르기 때문).
//
// growthNarrative(같은 미션 2회 이상 답변 비교)는 26개 미션이 전부 유니크해서 정상
// 흐름에서 절대 트리거 안 되는 죽은 기능이라 api/growthNarrative.js와 함께 제거했다
// — 3/6개월 종합 해석(comprehensiveReview)이 그 역할을 대신한다.
export function useResponses() {
  const submitAnswer = (missionId, answerText) =>
    callApi("/api/score", { missionId, answerText });

  const checkMissionStatus = (missionId) => callApi("/api/checkCache", { missionId });

  const checkAllStatuses = () => callApi("/api/checkCache", {});

  const generateComprehensiveReview = (reviewType) => callApi("/api/comprehensiveReview", { reviewType });

  return { submitAnswer, checkMissionStatus, checkAllStatuses, generateComprehensiveReview };
}
