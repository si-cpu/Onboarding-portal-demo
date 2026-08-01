import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getCurrentWeek } from "../../lib/week";
import ScoreSlider from "../../components/ScoreSlider";
import ReviewPanel from "../../components/ReviewPanel";

function avgOfScores(scores) {
  const values = Object.values(scores ?? {});
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// 전체 응답의 scores를 가치명 기준으로 평균 내어 낮은 순으로 정렬한다 (면담 때
// 짚어줄 상대적 약점 후보).
function computeWeakAreas(responses) {
  const totals = {};
  const counts = {};
  responses.forEach((r) => {
    Object.entries(r.scores ?? {}).forEach(([label, score]) => {
      totals[label] = (totals[label] ?? 0) + score;
      counts[label] = (counts[label] ?? 0) + 1;
    });
  });
  return Object.keys(totals)
    .map((label) => ({ label, avg: Math.round(totals[label] / counts[label]) }))
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
  const [currentWeek, setCurrentWeek] = useState(1);
  const [reviews, setReviews] = useState({}); // { mid: narrative_text, final: narrative_text }
  const [interviews, setInterviews] = useState({}); // { mid: notes, final: notes }
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [userSnap, respSnap] = await Promise.all([
          getDoc(doc(db, "users", internId)),
          getDocs(query(collection(db, "responses"), where("userId", "==", internId), orderBy("round", "asc"))),
        ]);

        const joinedAt = userSnap.data()?.joinedAt?.toDate?.() ?? null;
        setCurrentWeek(getCurrentWeek(joinedAt));
        setResponses(respSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

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

  return (
    <div>
      <div className="label">{internId}의 제출 내역 ({currentWeek}주차)</div>

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
