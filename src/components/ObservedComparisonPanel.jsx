import { OBSERVED_VALUES } from "../lib/coreValues";

// AI-팀장 관찰 평균 점수 차이가 이 이상이면 방향별로 다른 신호로 표시한다
// (임의 기준값 — 발표 전 실제 데이터로 조정 가능).
const GAP_FLAG_THRESHOLD = 20;

// 괴리는 방향에 따라 의미가 다르다 — 예전엔 Math.abs(gap)로 크기만 보고 어느
// 방향이든 같은 "포장 가능성" 문구를 붙였는데, 그건 AI가 높을 때만 맞는 해석이다
// (외부 리뷰로 지적). AI가 더 높으면 자기서술이 관찰보다 부풀려졌을 가능성이지만,
// 팀장이 더 높으면 반대로 "AI가 그 답변만 보고는 과소평가했거나, 답변에 근거가
// 충분히 드러나지 않았을 가능성"이다 — 같은 신호가 아니다.
function interpretGap(gap) {
  if (gap == null || Math.abs(gap) < GAP_FLAG_THRESHOLD) return null;
  return gap > 0
    ? { color: "var(--danger)", text: `⚠️ 괴리 +${gap} · 자기서술 포장 가능성` }
    : { color: "var(--accent)", text: `⚠️ 괴리 ${gap} · AI 과소평가 또는 답변 근거 부족 가능성` };
}

// 관찰형 7개 값에 대해 AI 자기서술 채점 평균과 팀장 관찰(그 시점에 한 번 남긴
// 슬라이더 값)을 나란히 비교한다. mid/final 리뷰 블록 안에서 그 시점 범위의
// AI 평균과 그 시점에 매니저가 남긴 관찰을 짝지어 보여주기 위해 컴포넌트로 뺐다.
export default function ObservedComparisonPanel({ title, subtitle, aiAveragesByLabel, managerScores }) {
  const rows = OBSERVED_VALUES.map((label) => ({
    label,
    ai: aiAveragesByLabel[label] ?? null,
    manager: managerScores?.[label] ?? null,
  })).filter((row) => row.ai !== null || row.manager !== null);

  if (rows.length === 0) return null;

  return (
    <div className="card card-wide">
      <div className="label">{title}</div>
      <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
        AI가 뚜렷이 높으면 자기서술이 실제 관찰보다 포장됐을 가능성, 팀장이 뚜렷이 높으면
        AI가 과소평가했거나 답변에 근거가 충분히 드러나지 않았을 가능성 신호
        {subtitle && <> · {subtitle}</>}
      </div>
      {rows.map(({ label, ai, manager }) => {
        const gap = ai != null && manager != null ? ai - manager : null;
        const flag = interpretGap(gap);
        return (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid var(--border)",
              fontSize: 13,
            }}
          >
            <span>{label}</span>
            <span>
              AI {ai ?? "–"} · 팀장 {manager ?? "–"}
              {flag && <span style={{ color: flag.color, marginLeft: 8 }}>{flag.text}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
