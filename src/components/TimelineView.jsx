import LockedPanel from "./LockedPanel";

export default function TimelineView({ mission, entries, narrative, narrativeLoading, onGenerate }) {
  const canGenerate = entries.length >= 2;

  return (
    <div className="card card-wide">
      <div className="label">{mission.question}</div>
      <div className="muted" style={{ marginBottom: 10 }}>
        나의 성장 타임라인 (6개월 후 공개 · 점수 없음)
      </div>

      {!canGenerate && (
        <div className="muted">같은 질문에 2회 이상 답변을 쌓으면 성장 서사가 생성됩니다.</div>
      )}

      {canGenerate && (
        <>
          <button className="btn" onClick={onGenerate} disabled={narrativeLoading}>
            {narrativeLoading ? "서사 생성 중..." : "성장 서사 생성하기 (AI)"}
          </button>
          {narrative && <div className="locked locked-solid" style={{ marginTop: 12 }}>{narrative}</div>}
        </>
      )}

      <div style={{ marginTop: 14 }}>
        {entries.map((entry) => (
          <div
            key={entry.round}
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              marginBottom: 8,
              paddingBottom: 8,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ color: "var(--accent)", marginBottom: 3 }}>#{entry.round}</div>
            {entry.feedback_text}
          </div>
        ))}
      </div>

      <LockedPanel>인터엑스와 함께한 여정 이야기는 3개월·6개월 시점에 만나볼 수 있어요</LockedPanel>
    </div>
  );
}
