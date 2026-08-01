// src/lib/week.js와 동일한 주차 계산 로직의 서버 측 사본.
// comprehensiveReview.js가 클라이언트가 보낸 reviewType(mid/final)을 그대로
// 믿지 않고, joinedAt으로 서버에서 직접 "지금 정말 그 리뷰 주차인지" 검증할 때 쓴다.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 26;
export const MID_REVIEW_WEEK = 13;
export const FINAL_REVIEW_WEEK = 26;

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function getCurrentWeek(joinedAt) {
  if (!joinedAt) return 1;
  const joined = joinedAt instanceof Date ? joinedAt : new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return 1;

  const joinedWeekStart = startOfWeekMonday(joined);
  const nowWeekStart = startOfWeekMonday(new Date());
  const weeksSince = Math.round((nowWeekStart - joinedWeekStart) / WEEK_MS);

  return Math.min(Math.max(weeksSince + 1, 1), TOTAL_WEEKS);
}
