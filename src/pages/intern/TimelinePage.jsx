import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useMissions } from "../../hooks/useMissions";
import { useResponses } from "../../hooks/useResponses";
import { FINAL_REVIEW_WEEK } from "../../lib/week";
import TimelineView from "../../components/TimelineView";
import ComprehensiveReviewCard from "../../components/ComprehensiveReviewCard";
import LockedPanel from "../../components/LockedPanel";

// CHARTER In Scope: "내 답변 타임라인 화면(6개월 종료 시 공개)". 예전엔 이 페이지
// 자체엔 주차 게이팅이 전혀 없어서 1주차부터 접근 가능했다(외부 리뷰로 발견 — 표기만
// "6개월 후 공개"였고 실제 잠금은 없었음). currentWeek로 실제 게이팅을 강제한다.
export default function TimelinePage() {
  const { currentWeek } = useAuth();
  const { missions, loading: missionsLoading } = useMissions();
  const { checkMissionStatus } = useResponses();

  const [historyByMission, setHistoryByMission] = useState({});

  useEffect(() => {
    if (currentWeek < FINAL_REVIEW_WEEK || missionsLoading || missions.length === 0) return;
    Promise.all(missions.map((m) => checkMissionStatus(m.id).then((r) => [m.id, r.history ?? []])))
      .then((pairs) => setHistoryByMission(Object.fromEntries(pairs)))
      .catch(() => {});
  }, [currentWeek, missionsLoading, missions]);

  if (currentWeek < FINAL_REVIEW_WEEK) {
    return (
      <LockedPanel>
        인터엑스와 함께한 여정 이야기는 {FINAL_REVIEW_WEEK}주차(6개월)에 열립니다. 지금은 {currentWeek}주차예요.
      </LockedPanel>
    );
  }

  if (missionsLoading) return <div className="muted">불러오는 중...</div>;

  const missionsWithHistory = missions.filter((m) => (historyByMission[m.id]?.length ?? 0) > 0);

  return (
    <div>
      <ComprehensiveReviewCard reviewType="final" />
      {missionsWithHistory.length === 0 ? (
        <div className="muted">아직 제출된 답변이 없습니다.</div>
      ) : (
        missionsWithHistory.map((mission) => (
          <TimelineView key={mission.id} mission={mission} entries={historyByMission[mission.id] ?? []} />
        ))
      )}
    </div>
  );
}
