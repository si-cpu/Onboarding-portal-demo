import { useState } from "react";
import ScoreSlider from "./ScoreSlider";
import ScoreTrend from "./ScoreTrend";

const TITLE = { mid: "3개월차 면담 자료", final: "6개월차 면담 자료" };

export default function ReviewPanel({ reviewType, weakAreas, missedWeeks, trendPoints, narrativeText, initialNotes, onSaveNotes }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveNotes(notes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card card-wide">
      <div className="label">{TITLE[reviewType]}</div>

      {narrativeText && (
        <div className="locked locked-solid" style={{ marginBottom: 14 }}>
          <div className="muted" style={{ marginBottom: 4 }}>AI 종합 서사 (신입에게 보여준 것과 동일)</div>
          {narrativeText}
        </div>
      )}

      {trendPoints.length >= 2 && (
        <div style={{ marginBottom: 14 }}>
          <div className="muted" style={{ marginBottom: 4 }}>주차별 평균 점수 추이</div>
          <ScoreTrend points={trendPoints} />
        </div>
      )}

      {weakAreas.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="muted" style={{ marginBottom: 6 }}>상대적으로 약한 분야 (평균 낮은 순)</div>
          {weakAreas.slice(0, 5).map((w) => (
            <ScoreSlider key={w.label} label={w.label} score={w.avg} />
          ))}
        </div>
      )}

      {missedWeeks.length > 0 && (
        <div className="locked" style={{ marginBottom: 14 }}>
          미제출 주차: {missedWeeks.join(", ")}주차
        </div>
      )}

      <div className="muted" style={{ marginBottom: 6 }}>면담 결과 (신입에게는 노출되지 않음)</div>
      <textarea
        className="textarea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="면담 진행 여부, 논의한 내용, 후속 조치 등을 기록하세요."
      />
      <button className="btn" onClick={handleSave} disabled={saving}>
        {saving ? "저장 중..." : "면담 결과 저장"}
      </button>
    </div>
  );
}
