import { useEffect, useState } from "react";
import { doc, getDoc, getDocs, collection, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { OBSERVED_VALUES } from "../../lib/coreValues";

const DEFAULT_SCORE = 50;

const REVIEW_TYPES = [
  { value: "mid", label: "3개월차 관찰" },
  { value: "final", label: "6개월차 관찰" },
];

function defaultScores() {
  return Object.fromEntries(OBSERVED_VALUES.map((v) => [v, DEFAULT_SCORE]));
}

// manager_feedback: 신입은 절대 read 불가 (firestore.rules + 라우터의
// RequireRole role="manager"로 이중 차단, 평가자 익명성 원칙).
//
// 매주/매월 계속 입력하는 구조가 아니라, 3개월차·6개월차 심사 직전에 딱 한 번씩만
// 관찰을 남기도록 설계한다 — 문서 ID를 `{internId}_{reviewType}`로 고정해서
// 같은 시점에 대해서는 새로 쓰는 게 아니라 덮어쓰기(수정)가 되게 한다. 이렇게 하면
// HR 쪽 "AI vs 팀장 관찰" 비교도 3개월/6개월 시점 각각과 정확히 짝지어진다.
export default function MetaFeedbackPage() {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState("");
  const [reviewType, setReviewType] = useState("mid");
  const [scores, setScores] = useState(defaultScores);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  async function loadEntries() {
    const snap = await getDocs(query(collection(db, "manager_feedback"), where("managerId", "==", auth.currentUser.uid)));
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    (async () => {
      try {
        // HR 배정 화면(AssignmentsPage)에서 정한 managerId로 담당 신입만 보여준다 —
        // 배정 개념이 없을 때는 매니저 role이면 아무 신입에나 관찰을 남길 수 있었고,
        // 담당자가 아닌 다른 매니저가 저장하면 기존 값이 조용히 덮어써지는 문제가
        // 있었다(firestore.rules도 같은 기준으로 배정된 매니저만 쓰도록 스코핑함).
        const usersSnap = await getDocs(
          query(collection(db, "users"), where("role", "==", "intern"), where("managerId", "==", auth.currentUser.uid))
        );
        setInterns(usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        await loadEntries();
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  // 신입/시점을 바꾸면 이미 남겨둔 관찰이 있는지 확인해서 슬라이더에 불러와준다 —
  // 3개월차 관찰을 심사 직전에 다시 열어 수정하는 경우를 위해서다.
  useEffect(() => {
    if (!selectedIntern) return;
    (async () => {
      const docId = `${selectedIntern}_${reviewType}`;
      const snap = await getDoc(doc(db, "manager_feedback", docId));
      if (snap.exists()) {
        setScores({ ...defaultScores(), ...snap.data().scores });
        setComment(snap.data().comment ?? "");
      } else {
        setScores(defaultScores());
        setComment("");
      }
    })();
  }, [selectedIntern, reviewType]);

  async function submit() {
    if (!selectedIntern) return;
    setSaving(true);
    try {
      const docId = `${selectedIntern}_${reviewType}`;
      await setDoc(
        doc(db, "manager_feedback", docId),
        {
          managerId: auth.currentUser.uid,
          internId: selectedIntern,
          reviewType,
          scores,
          comment: comment.trim() || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadEntries();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="card">
        <div className="label">비공개 매니저 관찰 입력</div>
        <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
          매주 입력하는 게 아니라, 3개월차·6개월차 심사 직전에 한 번씩만 남기면 됩니다.
        </div>

        {interns.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            담당으로 배정된 신입이 없습니다. 인사팀에 배정을 요청해 주세요.
          </div>
        ) : (
          <>
            <select
              className="input"
              style={{ marginBottom: 10 }}
              value={selectedIntern}
              onChange={(e) => setSelectedIntern(e.target.value)}
            >
              <option value="">신입 선택</option>
              {interns.map((i) => (
                <option key={i.uid} value={i.uid}>
                  {i.email ?? i.uid}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {REVIEW_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  className={reviewType === rt.value ? "btn" : "btn btn-secondary"}
                  onClick={() => setReviewType(rt.value)}
                >
                  {rt.label}
                </button>
              ))}
            </div>

            {OBSERVED_VALUES.map((value) => (
              <div key={value} style={{ marginBottom: 12 }}>
                <div className="muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{value}</span>
                  <span>{scores[value]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scores[value]}
                  onChange={(e) => setScores((prev) => ({ ...prev, [value]: Number(e.target.value) }))}
                  style={{ width: "100%" }}
                />
              </div>
            ))}

            <textarea
              className="textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="(선택) 맥락 코멘트 — 이 신입에게는 절대 노출되지 않습니다."
            />
            <button className="btn" onClick={submit} disabled={saving || !selectedIntern}>
              {saving ? "저장 중..." : `${REVIEW_TYPES.find((rt) => rt.value === reviewType).label} 저장`}
            </button>
            {error && <div className="error">{error}</div>}
          </>
        )}
      </div>

      <div className="card card-wide">
        <div className="label">내가 남긴 관찰</div>
        {entries.length === 0 && <div className="muted">아직 남긴 관찰이 없습니다.</div>}
        {entries.map((e) => (
          <div className="row" key={e.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span>
              {/* raw uid 대신 이메일로 표시 — interns 목록에 없으면(배정 해제 등) uid로 폴백 */}
              {interns.find((i) => i.uid === e.internId)?.email ?? e.internId} ·{" "}
              {REVIEW_TYPES.find((rt) => rt.value === e.reviewType)?.label ?? e.reviewType}
            </span>
            {e.scores && (
              <span className="muted" style={{ fontSize: 12 }}>
                {Object.entries(e.scores)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </span>
            )}
            {e.comment && <span className="muted">{e.comment}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
