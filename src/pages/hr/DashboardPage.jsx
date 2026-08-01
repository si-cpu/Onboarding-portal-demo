import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

// HR은 Firestore SDK로 responses를 직접 읽어도 된다 (firestore.rules: role() in ['manager','hr']).
// 신입 화면과 달리 여기서는 scores를 그대로 다뤄도 원칙에 어긋나지 않는다.
function avgOfScores(scores) {
  const values = Object.values(scores ?? {});
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export default function DashboardPage() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // 인턴 수만큼 responses를 따로 쿼리하면(N+1) 인원이 늘수록 느려진다.
        // 대신 전체 responses를 한 번에 받아서 클라이언트에서 userId로 묶는다
        // (총 쿼리 2번 — interns 1번 + responses 1번 — 로 고정).
        const [usersSnap, responsesSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "intern"))),
          getDocs(collection(db, "responses")),
        ]);

        const responsesByUser = {};
        responsesSnap.forEach((doc) => {
          const d = doc.data();
          (responsesByUser[d.userId] ??= []).push(d);
        });

        const interns = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        const withScores = interns.map((intern) => {
          const list = responsesByUser[intern.uid] ?? [];
          const averages = list.map((d) => avgOfScores(d.scores)).filter((v) => v !== null);
          const overall = averages.length
            ? Math.round(averages.reduce((a, b) => a + b, 0) / averages.length)
            : null;
          return { ...intern, responseCount: list.length, overall };
        });

        setRows(withScores);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!rows) return <div className="muted">불러오는 중...</div>;

  return (
    <div className="card card-wide">
      <div className="label">미션별 점수 (열람 가능, 조정 불가)</div>
      {rows.length === 0 && <div className="muted">등록된 신입이 없습니다.</div>}
      {rows.map((r) => (
        <Link key={r.uid} to={`/hr/responses/${r.uid}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="row">
            <span>{r.email ?? r.uid} · 제출 {r.responseCount}건</span>
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{r.overall ?? "-"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
