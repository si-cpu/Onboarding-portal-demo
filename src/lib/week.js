const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TOTAL_WEEKS = 26;
export const MID_REVIEW_WEEK = 13; // 3개월차
export const FINAL_REVIEW_WEEK = 26; // 6개월차

// 팀장 관찰 체크인 주차 — CHARTER 문서의 "주1회 or 월1회" 취지를 26주(6개월) 동안
// 약 월 1회, 6번으로 구현한다. MID_REVIEW_WEEK/FINAL_REVIEW_WEEK(심사 시점, AI 종합
// 해석이 담당)과는 다른 축이다 — 팀장 관찰은 심사 시점에만 몰아서 남기면 "관계가
// 끝나가는 시점의 총평"과 똑같이 왜곡 위험이 커지므로(설계원칙 4·6번과 같은 논리),
// 평상시 여러 시점에 누적되게 한다(외부 리뷰로 발견 — 예전엔 mid/final 딱 2번뿐이었음).
export const MANAGER_CHECKPOINT_WEEKS = [4, 8, 12, 16, 20, 25];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 월요일 00:00(KST)을 그 주의 시작으로 본다 (= 일요일 자정에 그 주 제출이 마감되고
// 월요일이 되면 다음 미션이 열림).
//
// d.setHours(0,0,0,0)처럼 로컬 타임존 기준으로 "자정"을 구하면, 이 함수를 실행하는
// 환경의 시스템 타임존에 따라 결과가 달라진다. 브라우저는 보통 KST지만 Vercel
// 서버리스 함수는 기본 UTC로 실행되므로, 같은 로직이라도 서버/클라가 최대 9시간
// 어긋난 "주의 시작"을 계산해 월요일 새벽 시간대에 클라는 이미 새 주차인데 서버는
// 아직 이전 주차로 판단하는 불일치가 생길 수 있었다(코드 리뷰로 발견).
// 그래서 실행 환경 타임존과 무관하게 항상 KST 기준으로 계산하도록, 실제 시각(epoch)에
// KST 오프셋을 더한 뒤 UTC getter로 읽는 방식(런타임 타임존을 우회하는 표준 트릭)을 쓴다.
function startOfWeekMonday(date) {
  const asKstFields = new Date(date.getTime() + KST_OFFSET_MS);
  const day = asKstFields.getUTCDay(); // 0=일 ~ 6=토 (KST 기준)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const mondayKstMidnightAsUtcFields = Date.UTC(
    asKstFields.getUTCFullYear(),
    asKstFields.getUTCMonth(),
    asKstFields.getUTCDate() + diffToMonday,
    0, 0, 0, 0
  );
  // 위에서 구한 값은 "KST 자정"을 UTC 필드로 표현한 것뿐이라, 실제 시각(epoch)으로
  // 되돌리려면 더했던 오프셋을 다시 빼야 한다.
  return new Date(mondayKstMidnightAsUtcFields - KST_OFFSET_MS);
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
