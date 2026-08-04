import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";

// 신입 → 인사팀 소통 채널. 평가 파이프라인(미션/점수)과는 완전히 분리된 자유서술
// 창구다 — 일부러 "이번 주 컨디션: 좋음/보통/어려움" 같은 상태 트래킹은 넣지 않았다.
// 그런 상시 관찰형 필드를 만들면 "나 지금 지켜보고 있다"는 인상을 줘서, 이 프로젝트가
// 다른 모든 화면에서 지키려는 미션 블라인드·정보 잠금 원칙과 같은 방향으로 가지 않는다.
// 여긴 순수하게 "물어보고 싶을 때 물어보는" 자발적 채널이다.
export default function HelpPage() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState(null);

  async function loadRequests() {
    const snap = await getDocs(
      query(collection(db, "help_requests"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
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

      <div className="card">
        <div className="label">새 메시지</div>
        <textarea
          className="textarea"
          placeholder="예: 이번 주 업무 도구 접근 권한이 필요해요 / 팀 적응이 조금 힘들어요"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="btn" onClick={submit} disabled={submitting || !message.trim()}>
          {submitting ? "전송 중..." : "인사팀에게 보내기"}
        </button>
        {error && <div className="error">{error}</div>}
      </div>

      {requests === null ? (
        <div className="muted">불러오는 중...</div>
      ) : requests.length === 0 ? (
        <div className="muted">아직 남긴 메시지가 없습니다.</div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="card">
            <div className="label">내 메시지</div>
            <div style={{ fontSize: 13, marginBottom: r.hrReply ? 10 : 0 }}>{r.message}</div>
            {r.hrReply ? (
              <>
                <div className="label" style={{ marginTop: 10 }}>인사팀 답장</div>
                <div style={{ fontSize: 13, color: "var(--accent)" }}>{r.hrReply}</div>
              </>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>아직 답장이 없습니다.</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
