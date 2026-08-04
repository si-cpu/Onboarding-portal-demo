import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// HR이 신입의 소통 요청(help_requests)을 보고 답장하는 화면. responses의 hr_comment
// 패턴과 동일하게 client SDK로 직접 updateDoc — HR은 신뢰된 역할이라 API 레이어를
// 새로 만들 필요가 없다(firestore.rules가 hrReply/status/repliedAt 외 필드 수정은 막음).
export default function HelpRequestsPage() {
  const [requests, setRequests] = useState(null);
  const [users, setUsers] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const [reqSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, "help_requests"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "users")),
    ]);
    const userMap = {};
    usersSnap.forEach((d) => {
      userMap[d.id] = d.data().email ?? d.id;
    });
    setUsers(userMap);
    setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    load().catch(() => setError(true));
  }, []);

  async function sendReply(id) {
    const reply = (replyDrafts[id] ?? "").trim();
    if (!reply) return;
    setSavingId(id);
    try {
      await updateDoc(doc(db, "help_requests", id), {
        hrReply: reply,
        status: "replied",
        repliedAt: new Date().toISOString(),
      });
      await load();
    } catch (e) {
      setError(true);
    }
    setSavingId(null);
  }

  if (error) return <div className="error">요청 목록을 불러올 수 없습니다.</div>;
  if (requests === null) return <div className="muted">불러오는 중...</div>;
  if (requests.length === 0) return <div className="muted">아직 접수된 요청이 없습니다.</div>;

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>신입 소통 요청함</div>
      {requests.map((r) => (
        <div key={r.id} className="card card-wide">
          <div className="badge">{r.status === "open" ? "미답변" : "답변 완료"}</div>
          <div className="muted" style={{ marginBottom: 6 }}>{users[r.userId] ?? r.userId}</div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>{r.message}</div>
          <textarea
            className="textarea"
            placeholder="답장 작성..."
            value={replyDrafts[r.id] ?? r.hrReply ?? ""}
            onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
          />
          <button className="btn" onClick={() => sendReply(r.id)} disabled={savingId === r.id}>
            {savingId === r.id ? "저장 중..." : "답장 보내기"}
          </button>
        </div>
      ))}
    </div>
  );
}
