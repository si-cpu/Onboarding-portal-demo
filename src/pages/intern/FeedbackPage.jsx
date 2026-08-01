import { useEffect, useState } from "react";
import { useResponses } from "../../hooks/useResponses";
import { useMissions } from "../../hooks/useMissions";
import FeedbackCard from "../../components/FeedbackCard";
import NudgeCard from "../../components/NudgeCard";

export default function FeedbackPage() {
  const { checkAllStatuses } = useResponses();
  const { missions } = useMissions();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAllStatuses()
      .then((r) => setEntries(r.entries))
      .catch((e) => {
        console.error("피드백 히스토리 조회 실패:", e.message); // 실제 원인은 콘솔에서 확인
        setError(true);
      });
  }, []);

  // 조회 실패든 데이터가 아직 없는 것이든, 신입 눈에는 "요청 실패 (404)" 같은
  // 기술적인 문구 대신 담담한 안내 문구만 보여준다.
  if (error) return <div className="muted">피드백을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</div>;
  if (!entries) return <div className="muted">불러오는 중...</div>;
  if (entries.length === 0) return <div className="muted">아직 제출된 답변이 없습니다.</div>;

  const questionFor = (missionId) => missions.find((m) => m.id === missionId)?.question ?? `미션 #${missionId}`;

  return (
    <div>
      {entries.map((entry) => (
        <div key={entry.missionId}>
          <div className="label">{questionFor(entry.missionId)}</div>
          <FeedbackCard feedbackText={entry.feedback_text} />
          <NudgeCard nudgeText={entry.nudge_text} />
        </div>
      ))}
    </div>
  );
}
