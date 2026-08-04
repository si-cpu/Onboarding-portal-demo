import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMissions } from "../../hooks/useMissions";
import { useResponses } from "../../hooks/useResponses";
import { TOTAL_WEEKS, MID_REVIEW_WEEK, FINAL_REVIEW_WEEK } from "../../lib/week";
import { CORE_VALUE_STORIES } from "../../lib/coreValues";

// 로그인 직후 첫 화면. 예전엔 로그인하면 바로 /intern/missions(제출/채점 화면)로
// 떨어져서, 첫인상이 "환영"보다 "평가"에 가까웠다(외부 피드백으로 지적). 이 화면은
// 새 데이터를 만들지 않고 이미 있는 것(이번 주 미션 상태, 최근 피드백, 다음 체크인,
// 핵심가치 소개)만 한 곳에 모아 "6개월 여정을 함께 따라가고 있다"는 톤으로 보여준다.
//
// "이번 주 핵심가치 한 조각"은 이번 주 미션이 실제로 측정하는 가치(서버 전용 매핑)와
// 절대 연결하지 않는다 — 그러면 미션 블라인드 원칙이 뚫린다. 그냥 currentWeek로
// 로테이션만 시켜서 노출하는, CoreValuesPage와 같은 성격의 소개용 콘텐츠다.
export default function HomePage() {
  const { currentWeek } = useAuth();
  const { missions } = useMissions();
  const { checkMissionStatus } = useResponses();
  const [status, setStatus] = useState(undefined);

  useEffect(() => {
    setStatus(undefined);
    checkMissionStatus(currentWeek)
      .then((r) => setStatus(r.exists ? r : null))
      .catch(() => setStatus(null));
  }, [currentWeek]);

  const mission = missions.find((m) => m.id === currentWeek);
  const valueOfWeek = CORE_VALUE_STORIES[(currentWeek - 1) % CORE_VALUE_STORIES.length];

  const nextCheckpoint =
    currentWeek < MID_REVIEW_WEEK
      ? { label: "3개월 체크인", week: MID_REVIEW_WEEK }
      : currentWeek < FINAL_REVIEW_WEEK
        ? { label: "6개월 최종 리뷰", week: FINAL_REVIEW_WEEK }
        : null;

  return (
    <div>
      <div className="hero">
        <div className="label">이번 주 온보딩</div>
        <h1 className="hero-title">잘 지내고 있나요?</h1>
        <p className="hero-subtitle">
          {currentWeek}주차 / {TOTAL_WEEKS}주 — 혼자 하는 게 아니라, 6개월 여정을 함께 따라가고 있어요.
        </p>
      </div>

      <div className="card">
        <div className="label">이번 주 열린 미션</div>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{mission?.question ?? "불러오는 중..."}</div>
        {status === undefined ? null : status ? (
          <div className="success" style={{ marginBottom: 0 }}>✅ 이번 주 답변 제출 완료</div>
        ) : (
          <Link
            to="/intern/missions"
            className="btn"
            style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
          >
            미션 답변하러 가기
          </Link>
        )}
      </div>

      {status?.feedback_text && (
        <div className="card">
          <div className="label">최근 AI 피드백</div>
          <div style={{ fontSize: 13 }}>{status.feedback_text}</div>
        </div>
      )}

      <div className="card">
        <div className="label">오늘의 핵심가치</div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{valueOfWeek.name}</div>
        <div className="muted">{valueOfWeek.description}</div>
      </div>

      {nextCheckpoint && (
        <div className="card">
          <div className="label">다음 체크인</div>
          <div className="muted">
            {nextCheckpoint.label} · {nextCheckpoint.week}주차 (앞으로 {nextCheckpoint.week - currentWeek}주 남음)
          </div>
        </div>
      )}

      <Link
        to="/intern/help"
        className="btn btn-secondary"
        style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
      >
        💬 궁금한 점이나 도움이 필요하면 남겨주세요
      </Link>
    </div>
  );
}
