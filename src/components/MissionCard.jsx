export default function MissionCard({ mission }) {
  return (
    <div className="card">
      <div className="badge">{mission.type}</div>
      <div className="label">이번 주 회고 미션</div>
      <div style={{ fontWeight: 600 }}>{mission.question}</div>
    </div>
  );
}
