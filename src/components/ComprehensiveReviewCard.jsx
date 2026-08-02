import { useEffect, useState } from "react";
import { useResponses } from "../hooks/useResponses";

const TITLE = { mid: "인터엑스와 함께한 3개월", final: "인터엑스와 함께한 6개월" };

// 신입이 보는 3/6개월 종합 해석 카드. 점수/가치명은 절대 안 보여주고 AI가 쓴
// 서사 텍스트만 노출한다 — HR이 보는 ReviewPanel(점수 그래프 포함)과는 다른 컴포넌트다.
export default function ComprehensiveReviewCard({ reviewType }) {
  const { generateComprehensiveReview } = useResponses();
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    setNarrative(null);
    setError(null);
    setAttempted(false);
  }, [reviewType]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const { narrative_text } = await generateComprehensiveReview(reviewType);
      setNarrative(narrative_text);
    } catch (e) {
      console.error("종합 해석 생성 실패:", e.message);
      setError(e.message?.includes("부족") ? e.message : "아직 이야기를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    setLoading(false);
    setAttempted(true);
  }

  return (
    <div className="card">
      <div className="label">{TITLE[reviewType]}</div>
      {narrative ? (
        <div style={{ fontSize: 13 }}>{narrative}</div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            지금까지 함께해온 시간을 돌아보며, 나만의 성장 이야기를 만나볼 수 있어요.
          </div>
          <button className="btn" onClick={handleGenerate} disabled={loading}>
            {loading ? "이야기를 만드는 중..." : "나의 여정 돌아보기"}
          </button>
          {attempted && error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
        </>
      )}
    </div>
  );
}
