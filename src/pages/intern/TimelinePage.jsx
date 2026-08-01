import { useEffect, useState } from "react";
import { useMissions } from "../../hooks/useMissions";
import { useResponses } from "../../hooks/useResponses";
import TimelineView from "../../components/TimelineView";

export default function TimelinePage() {
  const { missions, loading: missionsLoading } = useMissions();
  const { checkMissionStatus, generateNarrative } = useResponses();

  const [historyByMission, setHistoryByMission] = useState({});
  const [narrativeByMission, setNarrativeByMission] = useState({});
  const [narrativeLoadingId, setNarrativeLoadingId] = useState(null);

  useEffect(() => {
    if (missionsLoading || missions.length === 0) return;
    Promise.all(missions.map((m) => checkMissionStatus(m.id).then((r) => [m.id, r.history ?? []])))
      .then((pairs) => setHistoryByMission(Object.fromEntries(pairs)))
      .catch(() => {});
  }, [missionsLoading, missions]);

  async function handleGenerate(missionId) {
    setNarrativeLoadingId(missionId);
    try {
      const { narrative_text } = await generateNarrative(missionId);
      setNarrativeByMission((prev) => ({ ...prev, [missionId]: narrative_text }));
    } catch (e) {
      console.error("성장 서사 생성 실패:", e.message);
      setNarrativeByMission((prev) => ({ ...prev, [missionId]: "성장 서사를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요." }));
    }
    setNarrativeLoadingId(null);
  }

  if (missionsLoading) return <div className="muted">불러오는 중...</div>;

  const missionsWithHistory = missions.filter((m) => (historyByMission[m.id]?.length ?? 0) > 0);

  if (missionsWithHistory.length === 0) {
    return <div className="muted">아직 제출된 답변이 없습니다. 신입 뷰에서 답변을 제출해 보세요.</div>;
  }

  return (
    <div>
      {missionsWithHistory.map((mission) => (
        <TimelineView
          key={mission.id}
          mission={mission}
          entries={historyByMission[mission.id] ?? []}
          narrative={narrativeByMission[mission.id]}
          narrativeLoading={narrativeLoadingId === mission.id}
          onGenerate={() => handleGenerate(mission.id)}
        />
      ))}
    </div>
  );
}
