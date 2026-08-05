import { useEffect, useState } from "react";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// HR이 신입의 소통 요청(help_requests)을 보고 답장하는 화면. responses의 hr_comment
// 패턴과 동일하게 client SDK로 직접 updateDoc — HR은 신뢰된 역할이라 API 레이어를
// 새로 만들 필요가 없다(firestore.rules가 hrReply/status/repliedAt 외 필드 수정은 막음).
//
// 사람별로 대화 스레드를 묶어 톡처럼 보여준다 — 실시간 양방향 통신(웹소켓)은 아니고
// 답장 저장 후 다시 불러오는 기존 방식 그대로다.
function formatTime(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HelpRequestsPage() {
  const [requests, setRequests] = useState(null);
  const [users, setUsers] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const [reqSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, "help_requests"), orderBy("createdAt", "asc"))),
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

  // userId별로 대화 스레드를 묶는다. 이미 createdAt 오름차순으로 불러왔으니 각
  // 스레드 내부 순서는 그대로 대화 순서가 되고, 미답변이 있는 사람을 위로 올린다.
  const threadMap = new Map();
  requests.forEach((r) => {
    if (!threadMap.has(r.userId)) threadMap.set(r.userId, []);
    threadMap.get(r.userId).push(r);
  });
  const threads = [...threadMap.entries()].sort((a, b) => {
    const aOpen = a[1].some((r) => r.status === "open");
    const bOpen = b[1].some((r) => r.status === "open");
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return 0;
  });

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>신입 소통 요청함</div>
      {threads.map(([userId, msgs]) => {
        const openCount = msgs.filter((r) => r.status === "open").length;
        return (
          <div key={userId} className="card card-wide">
            <div className="badge">{openCount > 0 ? `미답변 ${openCount}건` : "답변 완료"}</div>
            <div className="muted" style={{ marginBottom: 10 }}>{users[userId] ?? userId}</div>
            <div className="chat-thread">
              {msgs.map((r) => (
                <div key={r.id}>
                  <div className="chat-row theirs">
                    <div>
                      <div className="chat-bubble theirs">{r.message}</div>
                      <div className="chat-meta">{formatTime(r.createdAt)}</div>
                    </div>
                  </div>
                  {r.hrReply ? (
                    <div className="chat-row mine">
                      <div>
                        <div className="chat-bubble mine">{r.hrReply}</div>
                        <div className="chat-meta" style={{ textAlign: "right" }}>인사팀 · {formatTime(r.repliedAt)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-row mine" style={{ width: "100%" }}>
                      <div style={{ width: "100%" }}>
                        <textarea
                          className="textarea"
                          style={{ minHeight: 60 }}
                          placeholder="답장 작성..."
                          value={replyDrafts[r.id] ?? ""}
                          onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        />
                        <button
                          className="btn"
                          onClick={() => sendReply(r.id)}
                          disabled={savingId === r.id || !(replyDrafts[r.id] ?? "").trim()}
                        >
                          {savingId === r.id ? "저장 중..." : "답장 보내기"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
