import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";

// 신입 → 인사팀 소통 채널. 평가 파이프라인(미션/점수)과는 완전히 분리된 자유서술
// 창구다 — 일부러 "이번 주 컨디션: 좋음/보통/어려움" 같은 상태 트래킹은 넣지 않았다.
// 그런 상시 관찰형 필드를 만들면 "나 지금 지켜보고 있다"는 인상을 줘서, 이 프로젝트가
// 다른 모든 화면에서 지키려는 미션 블라인드·정보 잠금 원칙과 같은 방향으로 가지 않는다.
// 여긴 순수하게 "물어보고 싶을 때 물어보는" 자발적 채널이다.
//
// 톡처럼 보이지만 실시간 양방향 통신(웹소켓 등)은 아니다 — 보낼 때/새로고침할 때만
// 다시 불러오는 기존 방식 그대로고, 말풍선 UI만 입혔다.
function formatTime(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HelpPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState(null);

  async function loadRequests() {
    // 대화창처럼 오래된 메시지가 위, 최신 메시지가 아래로 오도록 오름차순 정렬한다.
    const snap = await getDocs(
      query(collection(db, "help_requests"), where("userId", "==", user.uid), orderBy("createdAt", "asc"))
    );
    setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    loadRequests().catch(() => setRequests([]));
  }, [user.uid]);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, "help_requests"), {
        userId: user.uid,
        message: message.trim(),
        status: "open",
        createdAt: serverTimestamp(),
      });
      setMessage("");
      await loadRequests();
    } catch (e) {
      setError("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="hero">
        <div className="label">인사팀에게</div>
        <h1 className="hero-title">궁금한 점이나 도움이 필요하면 남겨주세요</h1>
        <p className="hero-subtitle">
          여기 남긴 내용은 미션 점수와 무관하게 인사팀이 직접 확인하고 답장합니다.
        </p>
      </div>

      <div className="card card-wide">
        {requests === null ? (
          <div className="muted">불러오는 중...</div>
        ) : requests.length === 0 ? (
          <div className="muted">아직 남긴 메시지가 없습니다. 아래에 첫 메시지를 남겨보세요.</div>
        ) : (
          <div className="chat-thread">
            {requests.map((r) => (
              <div key={r.id}>
                <div className="chat-row mine">
                  <div>
                    <div className="chat-bubble mine">{r.message}</div>
                    <div className="chat-meta" style={{ textAlign: "right" }}>{formatTime(r.createdAt)}</div>
                  </div>
                </div>
                {r.hrReply ? (
                  <div className="chat-row theirs">
                    <div>
                      <div className="chat-bubble theirs">{r.hrReply}</div>
                      <div className="chat-meta">인사팀 · {formatTime(r.repliedAt)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="chat-row theirs">
                    <div className="chat-waiting">인사팀 답장을 기다리는 중...</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="chat-composer">
          <textarea
            className="textarea"
            style={{ minHeight: 60 }}
            placeholder="예: 이번 주 업무 도구 접근 권한이 필요해요 / 팀 적응이 조금 힘들어요"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="btn" onClick={submit} disabled={submitting || !message.trim()}>
            {submitting ? "전송 중..." : "인사팀에게 보내기"}
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
