import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useMissions } from "../../hooks/useMissions";
import { useResponses } from "../../hooks/useResponses";
import { TOTAL_WEEKS, MID_REVIEW_WEEK, FINAL_REVIEW_WEEK } from "../../lib/week";
import MissionCard from "../../components/MissionCard";
import AnswerForm from "../../components/AnswerForm";
import FeedbackCard from "../../components/FeedbackCard";
import NudgeCard from "../../components/NudgeCard";
import LockedPanel from "../../components/LockedPanel";
import ComprehensiveReviewCard from "../../components/ComprehensiveReviewCard";

// 26주(6개월) 온보딩 동안 매주 그 주차에 해당하는 미션 하나만 새로 열린다.
// 이번 주 걸 제출해야만 다음 주가 됐을 때 다음 미션이 열리는 구조는 그대로 두되,
// 이미 지나간 주차(1~currentWeek)는 상단 네비게이션으로 오가며 그때 낸 답변과
// 피드백을 바로 볼 수 있다 — 과거 주차는 읽기 전용(제출 폼 없음).
export default function MissionPage() {
  const { currentWeek } = useAuth();
  const { missions, loading: missionsLoading, error: missionsError } = useMissions();
  const { submitAnswer, checkMissionStatus } = useResponses();

  const [viewedWeek, setViewedWeek] = useState(currentWeek);
  const [status, setStatus] = useState(undefined); // undefined = 조회 전, null = 없음
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // 탭을 오래 열어둬서 currentWeek이 넘어가면(월요일 자정), 보고 있던 주차도
  // 최신 주차로 따라가게 한다 — 과거 주차를 보다가 자기도 모르게 그대로
  // 멈춰있는 것보다는, 새 주차가 열렸다는 걸 알아채는 게 낫다.
  useEffect(() => {
    setViewedWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    setStatus(undefined);
    checkMissionStatus(viewedWeek)
      .then((r) => setStatus(r.exists ? r : null))
      .catch(() => setStatus(null));
  }, [viewedWeek]);

  const viewedMission = missions.find((m) => m.id === viewedWeek);
  const isCurrentWeek = viewedWeek === currentWeek;

  async function handleSubmit(answerText) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitAnswer(currentWeek, answerText);
      setStatus({ ...result, missionId: currentWeek });
    } catch (e) {
      setSubmitError(e.message);
    }
    setSubmitting(false);
  }

  if (missionsLoading || status === undefined) return <div className="muted">불러오는 중...</div>;
  if (missionsError) return <div className="error">{missionsError}</div>;

  return (
    <div>
      <div className="muted" style={{ marginBottom: 12 }}>
        {currentWeek}주차 / {TOTAL_WEEKS}주
      </div>

      {/* 지금까지 열린 주차(1~currentWeek)를 오갈 수 있는 네비게이션.
          미래 주차는 아직 안 열렸으니 안 보여준다. */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {Array.from({ length: currentWeek }, (_, i) => i + 1).map((week) => (
          <button
            key={week}
            type="button"
            className={week === viewedWeek ? "btn" : "btn btn-secondary"}
            style={{ flexShrink: 0, padding: "6px 12px", fontSize: 13 }}
            onClick={() => setViewedWeek(week)}
          >
            {week}주차
          </button>
        ))}
      </div>

      {/* 종합 해석은 "지금 이 순간의 나"에 대한 것이라 과거 주차를 들여다볼 땐
          안 보여주고, 현재 주차 탭에서만 보여준다. */}
      {isCurrentWeek && currentWeek >= MID_REVIEW_WEEK && <ComprehensiveReviewCard reviewType="mid" />}
      {isCurrentWeek && currentWeek >= FINAL_REVIEW_WEEK && <ComprehensiveReviewCard reviewType="final" />}

      {viewedMission ? (
        <>
          <MissionCard mission={viewedMission} />

          {status ? (
            <>
              {isCurrentWeek && <div className="success">✅ 제출 완료 — 답변이 저장됐습니다.</div>}
              <FeedbackCard feedbackText={status.feedback_text} />
              <NudgeCard nudgeText={status.nudge_text} />
              {isCurrentWeek && (
                <LockedPanel>이번 주 점수는 표시되지 않습니다. 다음 주에 새 미션이 열립니다.</LockedPanel>
              )}
            </>
          ) : isCurrentWeek ? (
            <AnswerForm onSubmit={handleSubmit} loading={submitting} />
          ) : (
            <div className="muted">이 주차엔 제출한 답변이 없습니다.</div>
          )}

          {submitError && <div className="error">{submitError}</div>}
        </>
      ) : (
        <div className="muted">이번 주 미션을 찾을 수 없습니다. 인사팀에 문의해 주세요.</div>
      )}
    </div>
  );
}
