import { OBSERVED_VALUES } from "../lib/coreValues";

// AI-팀장 관찰 평균 점수 차이가 이 이상이면 "자기서술이 실제 관찰보다 포장됐을
// 가능성" 신호로 표시한다(임의 기준값 — 발표 전 실제 데이터로 조정 가능).
const GAP_FLAG_THRESHOLD = 20;

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
        괴리가 크면(팀장 관찰이 AI보다 뚜렷이 낮음) 자기서술 답변이 실제 관찰보다 포장됐을 가능성 신호
        {subtitle && <> · {subtitle}</>}
      </div>
      {rows.map(({ label, ai, manager }) => {
        const gap = ai != null && manager != null ? ai - manager : null;
        const flagged = gap != null && Math.abs(gap) >= GAP_FLAG_THRESHOLD;
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
              {flagged && (
                <span style={{ color: "var(--danger)", marginLeft: 8 }}>
                  ⚠️ 괴리 {gap > 0 ? "+" : ""}
                  {gap}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
