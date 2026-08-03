// 26주차(6개월) 잠금 해제 후에만 렌더링된다(TimelinePage가 currentWeek로 게이트).
// 예전엔 "같은 미션에 2회 이상 답변 쌓으면 AI 성장 서사 생성" 버튼이 있었는데, 26개
// 미션이 전부 유니크 질문이라 정상 흐름에서 절대 그 조건에 도달하지 못하는 죽은
// 기능이었다(growthNarrative.js와 함께 제거) — 3/6개월 종합 해석이 그 역할을 대신한다.
export default function TimelineView({ mission, entries }) {
  return (
    <div className="card card-wide">
      <div className="label">{mission.question}</div>
      {entries.map((entry) => (
        <div
          key={entry.round}
          style={{
            marginTop: 10,
            paddingBottom: 10,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="badge" style={{ marginBottom: 6 }}>
            {mission.id}주차 · #{entry.round}
          </div>
          {entry.answerText && (
            <div style={{ fontSize: 13, marginBottom: 8 }}>{entry.answerText}</div>
          )}
          <div className="muted" style={{ fontSize: 12, marginBottom: entry.nudge_text ? 6 : 0 }}>
            {entry.feedback_text}
          </div>
          {entry.nudge_text && (
            <div style={{ fontSize: 12, color: "var(--accent)" }}>💡 {entry.nudge_text}</div>
          )}
        </div>
      ))}
    </div>
  );
}
