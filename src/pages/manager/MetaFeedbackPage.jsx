import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// manager_feedback: 신입은 절대 read 불가 (firestore.rules 참고, 평가자 익명성 원칙).
export default function MetaFeedbackPage() {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState("");
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
    if (!selectedIntern || !comment.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "manager_feedback"), {
        managerId: auth.currentUser.uid,
        internId: selectedIntern,
        comment,
        createdAt: serverTimestamp(),
      });
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
        <textarea
          className="textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="이 신입에게는 절대 노출되지 않는 비공개 코멘트입니다."
        />
        <button className="btn" onClick={submit} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card card-wide">
        <div className="label">내가 남긴 코멘트</div>
        {entries.length === 0 && <div className="muted">아직 작성한 코멘트가 없습니다.</div>}
        {entries.map((e) => (
          <div className="row" key={e.id}>
            <span>{e.internId}</span>
            <span className="muted">{e.comment}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
