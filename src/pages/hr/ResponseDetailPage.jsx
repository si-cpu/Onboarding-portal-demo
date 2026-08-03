import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getCurrentWeek } from "../../lib/week";
import ScoreSlider from "../../components/ScoreSlider";
import ReviewPanel from "../../components/ReviewPanel";
import ObservedComparisonPanel from "../../components/ObservedComparisonPanel";

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
  const [internEmail, setInternEmail] = useState(null);
  const [responses, setResponses] = useState(null);
  const [managerFeedback, setManagerFeedback] = useState({}); // { mid: scores|null, final: scores|null }
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
        // 제목에 raw uid 대신 이메일을 보여준다 — HR이 uid만 보고는 누구 페이지인지
        // 알 수 없었다(실브라우저로 확인하다가 발견). 계정 삭제 등으로 이메일이
        // 없을 수도 있으니 그 경우엔 uid로 폴백한다.
        setInternEmail(userSnap.data()?.email ?? null);
        setResponses(respSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 매니저 관찰은 3개월/6개월 시점에 한 번씩만 남기는 구조라
        // (MetaFeedbackPage.jsx), 문서 ID가 `{internId}_{mid|final}`로 고정돼
        // 있어 컬렉션 쿼리 없이 바로 조회한다.
        const [midReview, finalReview, midInterview, finalInterview, midFeedback, finalFeedback] = await Promise.all([
          getDoc(doc(db, "reviews", `${internId}_mid`)),
          getDoc(doc(db, "reviews", `${internId}_final`)),
          getDoc(doc(db, "interviews", `${internId}_mid`)),
          getDoc(doc(db, "interviews", `${internId}_final`)),
          getDoc(doc(db, "manager_feedback", `${internId}_mid`)),
          getDoc(doc(db, "manager_feedback", `${internId}_final`)),
        ]);
        setReviews({
          mid: midReview.exists() ? midReview.data().narrative_text : null,
          final: finalReview.exists() ? finalReview.data().narrative_text : null,
        });
        setInterviews({
          mid: midInterview.exists() ? midInterview.data().notes : "",
          final: finalInterview.exists() ? finalInterview.data().notes : "",
        });
        setManagerFeedback({
          mid: midFeedback.exists() ? midFeedback.data().scores : null,
          final: finalFeedback.exists() ? finalFeedback.data().scores : null,
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

  // AI(자기서술) 평균을 그 시점 범위로 한정해서 팀장이 그 시점에 남긴 관찰
  // (MetaFeedbackPage.jsx에서 mid/final 각각 한 번씩)과 짝지어 비교한다 —
  // 3개월 시점엔 1~12주 AI 평균, 6개월 시점엔 1~25주 AI 평균과 비교하는 식.
  // KPI "AI 채점-팀장 관찰 간 일치도"가 바로 이 비교에서 나온다.
  const aiMidAveragesByLabel = averageByLabel(responses.filter((r) => r.missionId <= 12).map((r) => r.scores));
  const aiFinalAveragesByLabel = averageByLabel(responses.filter((r) => r.missionId <= 25).map((r) => r.scores));

  return (
    <div>
      <div className="label">{internEmail ?? internId}의 제출 내역 ({currentWeek}주차)</div>

      {showMid && (
        <>
          <ObservedComparisonPanel
            title="AI 채점 vs 팀장 관찰 — 3개월 시점"
            aiAveragesByLabel={aiMidAveragesByLabel}
            managerScores={managerFeedback.mid}
          />
          <ReviewPanel
            reviewType="mid"
            weakAreas={computeWeakAreas(responses.filter((r) => r.missionId <= 12))}
            missedWeeks={computeMissedWeeks(responses, 12)}
            trendPoints={trendPoints.filter((p) => p.week <= 12)}
            narrativeText={reviews.mid}
            initialNotes={interviews.mid}
            onSaveNotes={(notes) => saveInterviewNotes("mid", notes)}
          />
        </>
      )}

      {showFinal && (
        <>
          <ObservedComparisonPanel
            title="AI 채점 vs 팀장 관찰 — 6개월 시점"
            aiAveragesByLabel={aiFinalAveragesByLabel}
            managerScores={managerFeedback.final}
          />
          <ReviewPanel
            reviewType="final"
            weakAreas={computeWeakAreas(responses.filter((r) => r.missionId <= 25))}
            missedWeeks={computeMissedWeeks(responses, 25)}
            trendPoints={trendPoints.filter((p) => p.week <= 25)}
            narrativeText={reviews.final}
            initialNotes={interviews.final}
            onSaveNotes={(notes) => saveInterviewNotes("final", notes)}
          />
        </>
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
