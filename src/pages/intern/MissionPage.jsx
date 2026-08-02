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

// 26주(6개월) 온보딩 동안 매주 그 주차에 해당하는 미션 하나만 보여준다.
// 지난 미션들을 자유롭게 골라볼 수 있는 목록이 아니라, 이번 주 걸 제출해야만
// 다음 주가 됐을 때 다음 미션이 열리는 구조 — 과거 답변/피드백은 "피드백 히스토리"
// 탭에서 따로 본다.
export default function MissionPage() {
  const { currentWeek } = useAuth();
  const { missions, loading: missionsLoading, error: missionsError } = useMissions();
  const { submitAnswer, checkMissionStatus } = useResponses();

  const [status, setStatus] = useState(undefined); // undefined = 조회 전, null = 없음
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    setStatus(undefined);
    checkMissionStatus(currentWeek)
      .then((r) => setStatus(r.exists ? r : null))
      .catch(() => setStatus(null));
  }, [currentWeek]);

  const currentMission = missions.find((m) => m.id === currentWeek);

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

      {/* 정확히 그 주차일 때만 보여주면(===), 그 주에 못 보고 지나간 신입은
          영영 종합 해석을 생성할 방법이 없어진다 — 그 주차 "이후" 내내 보이게 한다. */}
      {currentWeek >= MID_REVIEW_WEEK && <ComprehensiveReviewCard reviewType="mid" />}
      {currentWeek >= FINAL_REVIEW_WEEK && <ComprehensiveReviewCard reviewType="final" />}

      {currentMission ? (
        <>
          <MissionCard mission={currentMission} />

          {status ? (
            <>
              <div className="success">✅ 제출 완료 — 답변이 저장됐습니다.</div>
              <FeedbackCard feedbackText={status.feedback_text} />
              <NudgeCard nudgeText={status.nudge_text} />
              <LockedPanel>이번 주 점수는 표시되지 않습니다. 다음 주에 새 미션이 열립니다.</LockedPanel>
            </>
          ) : (
            <AnswerForm onSubmit={handleSubmit} loading={submitting} />
          )}

          {submitError && <div className="error">{submitError}</div>}
        </>
      ) : (
        <div className="muted">이번 주 미션을 찾을 수 없습니다. 인사팀에 문의해 주세요.</div>
      )}
    </div>
  );
}
