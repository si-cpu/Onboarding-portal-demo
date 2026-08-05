import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { getCurrentWeek, MANAGER_CHECKPOINT_WEEKS } from "../../lib/week";
import ScoreSlider from "../../components/ScoreSlider";
import ReviewPanel from "../../components/ReviewPanel";
import ObservedComparisonPanel from "../../components/ObservedComparisonPanel";
import ScoreCaveat from "../../components/ScoreCaveat";
import ConfirmDialog from "../../components/ConfirmDialog";

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

// 전체 응답의 scores를 가치명 기준으로 평균+측정 횟수를 함께 내어 낮은 순으로
// 정렬한다(면담 때 짚어줄 상대적 약점 후보). 예전엔 이와 별개로 "주차별 평균"을
// 하나의 선 그래프로 이어 보여줬는데, 매주 서로 다른 가치를 측정하는 구조(같은 주에
// 3~4개 값이 섞여 나옴)라 그 평균선은 통계적으로 의미가 없었다(외부 리뷰로 지적 —
// 예: 1주차 "끈기" 60점과 2주차 "목표의식" 80점을 이어서 "20점 성장"이라고 읽을 수
// 없음). 그래프를 없애고, 그 대신 가치별 평균·측정 횟수로 대체했다 — 표본이 적은
// 값(count가 작음)은 그 자체로 "아직 판단 근거가 부족하다"는 신호가 된다.
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
    .map((label) => ({ label, avg: Math.round(totals[label] / counts[label]), count: counts[label] }))
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

// 저장된 코멘트가 있으면 읽기 전용으로 보여주고 "수정" 버튼을 눌러야 편집 모드로
// 들어가게 한다 — 예전엔 textarea가 항상 열려 있어서 지금 보이는 게 이미 저장된
// 값인지 아직 안 저장한 값인지 구분이 안 됐다.
function HrCommentBox({ responseDocId, initialComment }) {
  const [comment, setComment] = useState(initialComment ?? "");
  const [editing, setEditing] = useState(!initialComment);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // firestore.rules: hr는 hr_comment 필드만 수정 가능 (점수는 불변)
      await updateDoc(doc(db, "responses", responseDocId), { hr_comment: comment });
      setEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setComment(initialComment ?? "");
    setEditing(false);
  }

  async function remove() {
    setConfirmDeleteOpen(false);
    setSaving(true);
    try {
      await updateDoc(doc(db, "responses", responseDocId), { hr_comment: "" });
      setComment("");
      setEditing(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="label">HR 코멘트 (신입에게는 노출되지 않음)</div>
      {justSaved && <div className="success">✅ 저장 완료</div>}
      {editing ? (
        <>
          <textarea
            className="textarea"
            style={{ minHeight: 50 }}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="코멘트를 입력하세요"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} onClick={save} disabled={saving || !comment.trim()}>
              {saving ? "저장 중..." : "저장"}
            </button>
            {initialComment && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={cancel}
                disabled={saving}
              >
                취소
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{comment}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setEditing(true)}
            >
              수정
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              삭제
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        message={"코멘트를 삭제하시겠습니까?"}
        onConfirm={remove}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}

export default function ResponseDetailPage() {
  const { internId } = useParams();
  const [internEmail, setInternEmail] = useState(null);
  const [responses, setResponses] = useState(null);
  const [managerCheckpoints, setManagerCheckpoints] = useState([]); // [{ checkpointWeek, scores }]
  const [currentWeek, setCurrentWeek] = useState(1);
  const [reviews, setReviews] = useState({}); // { mid: narrative_text, final: narrative_text }
  const [interviews, setInterviews] = useState({}); // { mid: notes, final: notes }
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [userSnap, respSnap] = await Promise.all([
          getDoc(doc(db, "users", internId)),
          // missionId(=주차) 기준 오름차순 — round는 미션당 재제출 횟수라 여러 미션을
          // 섞으면 실제 주차 순서를 보장하지 못한다(재제출이 없으면 전부 round=1이라
          // 정렬 기준이 되지 못함).
          getDocs(query(collection(db, "responses"), where("userId", "==", internId), orderBy("missionId", "asc"))),
        ]);

        const joinedAt = userSnap.data()?.joinedAt?.toDate?.() ?? null;
        setCurrentWeek(getCurrentWeek(joinedAt));
        // 제목에 raw uid 대신 이메일을 보여준다 — HR이 uid만 보고는 누구 페이지인지
        // 알 수 없었다(실브라우저로 확인하다가 발견). 계정 삭제 등으로 이메일이
        // 없을 수도 있으니 그 경우엔 uid로 폴백한다.
        setInternEmail(userSnap.data()?.email ?? null);
        setResponses(respSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // reviews/interviews는 여전히 3개월/6개월 심사 시점 2번뿐이라(AI 종합 해석,
        // comprehensiveReview.js가 담당) 문서 ID로 바로 조회한다. 팀장 관찰
        // (manager_feedback)은 이제 MANAGER_CHECKPOINT_WEEKS(약 월 1회, 6번)마다
        // 별도 문서라 체크인 주차 수만큼 조회한다 — 심사 시점에만 몰아 남기면 팀장
        // 관찰도 "관계가 끝나가는 시점의 총평"과 같은 왜곡 위험을 그대로 받기 때문에
        // 평상시 여러 시점으로 나눴다(외부 리뷰로 발견).
        const [midReview, finalReview, midInterview, finalInterview, ...checkpointSnaps] = await Promise.all([
          getDoc(doc(db, "reviews", `${internId}_mid`)),
          getDoc(doc(db, "reviews", `${internId}_final`)),
          getDoc(doc(db, "interviews", `${internId}_mid`)),
          getDoc(doc(db, "interviews", `${internId}_final`)),
          ...MANAGER_CHECKPOINT_WEEKS.map((w) => getDoc(doc(db, "manager_feedback", `${internId}_${w}`))),
        ]);
        setReviews({
          mid: midReview.exists() ? midReview.data().narrative_text : null,
          final: finalReview.exists() ? finalReview.data().narrative_text : null,
        });
        setInterviews({
          mid: midInterview.exists() ? midInterview.data().notes : "",
          final: finalInterview.exists() ? finalInterview.data().notes : "",
        });
        setManagerCheckpoints(
          checkpointSnaps
            .filter((snap) => snap.exists())
            .map((snap) => snap.data())
        );
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

  const showMid = currentWeek >= 13;
  const showFinal = currentWeek >= 26;

  // AI-팀장 비교는 더 이상 mid/final 심사 시점에 묶이지 않는다 — 팀장 관찰이
  // MANAGER_CHECKPOINT_WEEKS(약 월 1회)마다 누적되므로, 지금까지 쌓인 전체를
  // 그대로 비교한다(체크인이 하나도 없으면 ObservedComparisonPanel이 알아서 안 그림).
  const aiCumulativeAveragesByLabel = averageByLabel(responses.map((r) => r.scores));
  const managerCumulativeAveragesByLabel = averageByLabel(managerCheckpoints.map((c) => c.scores));
  const checkpointWeeksSoFar = managerCheckpoints
    .map((c) => c.checkpointWeek)
    .sort((a, b) => a - b);

  return (
    <div>
      <div className="label">{internEmail ?? internId}의 제출 내역 ({currentWeek}주차)</div>
      <ScoreCaveat />

      <ObservedComparisonPanel
        title="AI 채점 vs 팀장 관찰 (누적)"
        subtitle={checkpointWeeksSoFar.length ? `팀장 체크인: ${checkpointWeeksSoFar.join(", ")}주차` : undefined}
        aiAveragesByLabel={aiCumulativeAveragesByLabel}
        managerScores={managerCumulativeAveragesByLabel}
      />

      {showMid && (
        <ReviewPanel
          reviewType="mid"
          weakAreas={computeWeakAreas(responses.filter((r) => r.missionId <= 12))}
          missedWeeks={computeMissedWeeks(responses, 12)}
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
          narrativeText={reviews.final}
          initialNotes={interviews.final}
          onSaveNotes={(notes) => saveInterviewNotes("final", notes)}
        />
      )}

      {responses.map((r) => (
        <details className="card card-wide" key={r.id}>
          <summary className="toggle-label">
            <span className="badge" style={{ marginBottom: 0 }}>
              {r.missionId}주차 · 미션 #{r.missionId}{r.round > 1 ? ` · ${r.round}번째 제출` : ""}
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <div className="label">신입 답변</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>{r.answerText}</div>
            <div className="label">AI 피드백</div>
            <div style={{ fontSize: 13, marginBottom: 12, color: "var(--text-dim)" }}>{r.feedback_text}</div>
            {Object.entries(r.scores ?? {}).map(([label, score]) => (
              <ScoreSlider key={label} label={label} score={score} />
            ))}
            <HrCommentBox responseDocId={r.id} initialComment={r.hr_comment} />
          </div>
        </details>
      ))}
    </div>
  );
}
