// src/lib/week.js와 동일한 주차 계산 로직의 서버 측 사본.
// comprehensiveReview.js가 클라이언트가 보낸 reviewType(mid/final)을 그대로
// 믿지 않고, joinedAt으로 서버에서 직접 "지금 정말 그 리뷰 주차인지" 검증할 때 쓴다.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 26;
export const MID_REVIEW_WEEK = 13;
export const FINAL_REVIEW_WEEK = 26;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// src/lib/week.js와 동일한 이유로 KST 고정 오프셋 계산을 쓴다 — Vercel 서버리스
// 함수는 기본 UTC로 실행되는데, d.setHours(0,0,0,0) 같은 로컬 타임존 기준 계산은
// 브라우저(KST)와 최대 9시간 어긋난 "주의 시작"을 계산해버린다(코드 리뷰로 발견).
function startOfWeekMonday(date) {
  const asKstFields = new Date(date.getTime() + KST_OFFSET_MS);
  const day = asKstFields.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayKstMidnightAsUtcFields = Date.UTC(
    asKstFields.getUTCFullYear(),
    asKstFields.getUTCMonth(),
    asKstFields.getUTCDate() + diffToMonday,
    0, 0, 0, 0
  );
  return new Date(mondayKstMidnightAsUtcFields - KST_OFFSET_MS);
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
