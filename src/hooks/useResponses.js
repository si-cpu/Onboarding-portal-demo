import { callApi } from "../lib/api";

// /api/score, /api/checkCache, /api/growthNarrative 호출을 감싸는 얇은 훅.
// 로딩/에러 상태는 호출하는 컴포넌트가 각자 관리한다 (제출 폼 vs 히스토리 목록의
// 로딩 UX가 서로 다르기 때문).
export function useResponses() {
  const submitAnswer = (missionId, answerText) =>
    callApi("/api/score", { missionId, answerText });

  const checkMissionStatus = (missionId) => callApi("/api/checkCache", { missionId });

  const checkAllStatuses = () => callApi("/api/checkCache", {});

  const generateNarrative = (missionId) => callApi("/api/growthNarrative", { missionId });

  const generateComprehensiveReview = (reviewType) => callApi("/api/comprehensiveReview", { reviewType });

  return { submitAnswer, checkMissionStatus, checkAllStatuses, generateNarrative, generateComprehensiveReview };
}
