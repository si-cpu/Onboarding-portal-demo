import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getCurrentWeek } from "../../lib/week";
import { OBSERVED_VALUES } from "../../lib/coreValues";
import ScoreSlider from "../../components/ScoreSlider";
import ReviewPanel from "../../components/ReviewPanel";

// AI-팀장 관찰 평균 점수 차이가 이 이상이면 "자기서술이 실제 관찰보다 포장됐을
// 가능성" 신호로 표시한다(임의 기준값 — 발표 전 실제 데이터로 조정 가능).
const GAP_FLAG_THRESHOLD = 20;

function avgOfScores(scores) {
  const values = Object.values(scores ?? {});
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// 가치명 기준으로 점수를 평균 낸다. AI 자기서술 채점(responses.scores)과
// 팀장 관찰(manager_feedback.scores) 양쪽 다 이 함수로 집계해서 같은 방식으로
// 비교 가능하게 한다.
function averageByLabel(scoreObjects) {
  const totals = {};
  const counts = {};
  scoreObjects.forEach((scores) => {
    Object.entries(scores ?? {}).forEach(([label, score]) => {
      totals[label] = (totals[label] ?? 0) + score;
      counts[label] = (counts[label] ?? 0) + 1;
    });
  });
  return Object.fromEntries(Object.keys(totals).map((label) => [label, Math.round(totals[label] / counts[label])]));
}

// 전체 응답의 scores를 가치명 기준으로 평균 내어 낮은 순으로 정렬한다 (면담 때
// 짚어줄 상대적 약점 후보).
function computeWeakAreas(responses) {
  const byLabel = averageByLabel(responses.map((r) => r.scores));
  return Object.entries(byLabel)
    .map(([label, avg]) => ({ label, avg }))
    .sort((a, b) => a.avg - b.avg);
}

function computeMissedWeeks(responses, upToWeek) {
  const submitted = new Set(responses.map((r) => r.missionId));
  const missed = [];
  for (let week = 1; week <= upToWeek; week++) {
    if (!submitted.has(week)) missed.push(week);
  }
  return missed;
}

function HrCommentBox({ responseDocId, initialComment }) {
  const [comment, setComment] = useState(initialComment ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // firestore.rules: hr는 hr_comment 필드만 수정 가능 (점수는 불변)
      await updateDoc(doc(db, "responses", responseDocId), { hr_comment: comment });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        className="textarea"
        style={{ minHeight: 50 }}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="HR 코멘트 (신입에게는 노출되지 않음)"
      />
      <button className="btn btn-secondary" onClick={save} disabled={saving}>
        {saving ? "저장 중..." : "코멘트 저장"}
      </button>
    </div>
  );
}

export default function ResponseDetailPage() {
  const { internId } = useParams();
  const [responses, setResponses] = useState(null);
  const [managerFeedback, setManagerFeedback] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [reviews, setReviews] = useState({}); // { mid: narrative_text, final: narrative_text }
  const [interviews, setInterviews] = useState({}); // { mid: notes, final: notes }
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [userSnap, respSnap, feedbackSnap] = await Promise.all([
          getDoc(doc(db, "users", internId)),
          getDocs(query(collection(db, "responses"), where("userId", "==", internId), orderBy("round", "asc"))),
          getDocs(query(collection(db, "manager_feedback"), where("internId", "==", internId))),
        ]);

        const joinedAt = userSnap.data()?.joinedAt?.toDate?.() ?? null;
        setCurrentWeek(getCurrentWeek(joinedAt));
        setResponses(respSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setManagerFeedback(feedbackSnap.docs.map((d) => d.data()));

        const [midReview, finalReview, midInterview, finalInterview] = await Promise.all([
          getDoc(doc(db, "reviews", `${internId}_mid`)),
          getDoc(doc(db, "reviews", `${internId}_final`)),
          getDoc(doc(db, "interviews", `${internId}_mid`)),
          getDoc(doc(db, "interviews", `${internId}_final`)),
        ]);
        setReviews({
          mid: midReview.exists() ? midReview.data().narrative_text : null,
          final: finalReview.exists() ? finalReview.data().narrative_text : null,
        });
        setInterviews({
          mid: midInterview.exists() ? midInterview.data().notes : "",
          final: finalInterview.exists() ? finalInterview.data().notes : "",
        });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [internId]);

  async function saveInterviewNotes(reviewType, notes) {
    await setDoc(
      doc(db, "interviews", `${internId}_${reviewType}`),
      { internId, reviewType, notes, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    setInterviews((prev) => ({ ...prev, [reviewType]: notes }));
  }

  if (error) return <div className="error">{error}</div>;
  if (!responses) return <div className="muted">불러오는 중...</div>;

  const trendPoints = responses
    .map((r) => ({ week: r.missionId, avg: avgOfScores(r.scores) }))
    .filter((p) => p.avg !== null)
    .sort((a, b) => a.week - b.week);

  const showMid = currentWeek >= 13;
  const showFinal = currentWeek >= 26;

  // AI(자기서술) 평균과 팀장 관찰 평균을 관찰형 7개 값 기준으로 나란히 비교한다.
  // 괴리가 크면 "자기서술로는 포장됐지만 실제 관찰은 다르다"는 신호 —
  // KPI "AI 채점-팀장 관찰 간 일치도"가 바로 이 비교에서 나온다.
  const aiAveragesByLabel = averageByLabel(responses.map((r) => r.scores));
  const managerAveragesByLabel = averageByLabel(managerFeedback.map((f) => f.scores));
  const comparisonRows = OBSERVED_VALUES.map((label) => ({
    label,
    ai: aiAveragesByLabel[label] ?? null,
    manager: managerAveragesByLabel[label] ?? null,
  })).filter((row) => row.ai !== null || row.manager !== null);

  return (
    <div>
      <div className="label">{internId}의 제출 내역 ({currentWeek}주차)</div>

      {comparisonRows.length > 0 && (
        <div className="card card-wide">
          <div className="label">AI 자기서술 채점 vs 팀장 관찰 (관계·태도형 7개 값)</div>
          <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
            괴리가 크면(팀장 관찰이 AI보다 뚜렷이 낮음) 자기서술 답변이 실제 관찰보다 포장됐을 가능성 신호
          </div>
          {comparisonRows.map(({ label, ai, manager }) => {
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
      )}

      {showMid && (
        <ReviewPanel
          reviewType="mid"
          weakAreas={computeWeakAreas(responses.filter((r) => r.missionId <= 12))}
          missedWeeks={computeMissedWeeks(responses, 12)}
          trendPoints={trendPoints.filter((p) => p.week <= 12)}
          narrativeText={reviews.mid}
          initialNotes={interviews.mid}
          onSaveNotes={(notes) => saveInterviewNotes("mid", notes)}
        />
      )}

      {showFinal && (
        <ReviewPanel
          reviewType="final"
          weakAreas={computeWeakAreas(responses.filter((r) => r.missionId <= 25))}
          missedWeeks={computeMissedWeeks(responses, 25)}
          trendPoints={trendPoints.filter((p) => p.week <= 25)}
          narrativeText={reviews.final}
          initialNotes={interviews.final}
          onSaveNotes={(notes) => saveInterviewNotes("final", notes)}
        />
      )}

      {responses.map((r) => (
        <div className="card card-wide" key={r.id}>
          <div className="badge">미션 #{r.missionId} · {r.round}번째 제출</div>
          <div style={{ fontSize: 13, marginBottom: 12, color: "var(--text-dim)" }}>{r.feedback_text}</div>
          {Object.entries(r.scores ?? {}).map(([label, score]) => (
            <ScoreSlider key={label} label={label} score={score} />
          ))}
          <HrCommentBox responseDocId={r.id} initialComment={r.hr_comment} />
        </div>
      ))}
    </div>
  );
}
