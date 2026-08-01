const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 26;
export const MID_REVIEW_WEEK = 13; // 3개월차
export const FINAL_REVIEW_WEEK = 26; // 6개월차

// 월요일 00:00을 그 주의 시작으로 본다 (= 일요일 자정에 그 주 제출이 마감되고
// 월요일이 되면 다음 미션이 열림).
function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일 ~ 6=토
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

// joinedAt(온보딩 시작일)이 속한 주를 1주차로 놓고, 실제 달력 기준 월요일마다
// 주차가 넘어간다 (입사 요일과 무관하게 매주 일요일 자정에 마감). 26주가 지나도
// 27주차로 넘어가지 않고 26에서 멈춰 최종 리뷰 상태를 유지한다.
export function getCurrentWeek(joinedAt) {
  if (!joinedAt) return 1;
  const joined = joinedAt instanceof Date ? joinedAt : new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return 1;

  const joinedWeekStart = startOfWeekMonday(joined);
  const nowWeekStart = startOfWeekMonday(new Date());
  const weeksSince = Math.round((nowWeekStart - joinedWeekStart) / WEEK_MS);

  return Math.min(Math.max(weeksSince + 1, 1), TOTAL_WEEKS);
}

export function isReviewWeek(week) {
  return week === MID_REVIEW_WEEK || week === FINAL_REVIEW_WEEK;
}
