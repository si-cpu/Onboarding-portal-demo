// HR 전용 읽기 전용 점수 표시. "열람 가능, 조정 불가" 원칙에 따라
// 입력 불가능한 바 형태로만 보여준다 (실제 <input type="range">는 쓰지 않는다).
export default function ScoreSlider({ label, score }) {
  return (
    <div className="score-row">
      <div className="row" style={{ border: "none", padding: 0 }}>
        <span>{label}</span>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{score}</span>
      </div>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
    </div>
  );
}
