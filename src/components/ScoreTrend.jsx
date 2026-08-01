// 주차별 평균 점수 추이를 보여주는 작은 라인 스파크라인. 차트 라이브러리 없이
// 인라인 SVG로 그린다 — 값 범위가 항상 0~100으로 고정돼 있어 스케일 계산이 단순하다.
// points: [{ week, avg }] — week은 missionId(=주차 번호)와 동일하다.
export default function ScoreTrend({ points }) {
  if (!points || points.length < 2) return null;

  const width = 100;
  const height = 32;
  const pad = 4;
  const maxWeek = points[points.length - 1].week;
  const minWeek = points[0].week;
  const weekSpan = Math.max(maxWeek - minWeek, 1);

  const coords = points.map((p) => {
    const x = pad + ((p.week - minWeek) / weekSpan) * (width - pad * 2);
    const y = pad + (1 - p.avg / 100) * (height - pad * 2);
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 48, display: "block" }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" strokeWidth="0.5" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        <circle cx={last.x} cy={last.y} r="1.8" fill="var(--accent)" />
      </svg>
      <div className="muted" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{minWeek}주차</span>
        <span>{maxWeek}주차 · 최근 평균 {last.avg}점</span>
      </div>
    </div>
  );
}
