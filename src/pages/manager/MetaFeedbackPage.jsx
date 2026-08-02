import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { OBSERVED_VALUES } from "../../lib/coreValues";

const DEFAULT_SCORE = 50;

function defaultScores() {
  return Object.fromEntries(OBSERVED_VALUES.map((v) => [v, DEFAULT_SCORE]));
}

// manager_feedback: 신입은 절대 read 불가 (firestore.rules + 라우터의
// RequireRole role="manager"로 이중 차단, 평가자 익명성 원칙).
export default function MetaFeedbackPage() {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState("");
  const [scores, setScores] = useState(defaultScores);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  async function loadEntries() {
    const snap = await getDocs(
      query(collection(db, "manager_feedback"), where("managerId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"))
    );
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    (async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "intern")));
        setInterns(usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        await loadEntries();
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function submit() {
    if (!selectedIntern) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "manager_feedback"), {
        managerId: auth.currentUser.uid,
        internId: selectedIntern,
        scores,
        comment: comment.trim() || null,
        createdAt: serverTimestamp(),
      });
      setScores(defaultScores());
      setComment("");
      await loadEntries();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="card">
        <div className="label">비공개 매니저 피드백 작성</div>
        <select
          className="input"
          style={{ marginBottom: 14 }}
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
          {saving ? "저장 중..." : "저장"}
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card card-wide">
        <div className="label">내가 남긴 피드백</div>
        {entries.length === 0 && <div className="muted">아직 작성한 피드백이 없습니다.</div>}
        {entries.map((e) => (
          <div className="row" key={e.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span>{e.internId}</span>
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
