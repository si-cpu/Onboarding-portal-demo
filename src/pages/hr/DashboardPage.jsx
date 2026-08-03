import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { NARRATIVE_VALUES, OBSERVED_VALUES } from "../../lib/coreValues";
import ScoreCaveat from "../../components/ScoreCaveat";

// HR은 Firestore SDK로 responses를 직접 읽어도 된다 (firestore.rules: role() in ['manager','hr']).
// 신입 화면과 달리 여기서는 scores를 그대로 다뤄도 원칙에 어긋나지 않는다.
//
// NARRATIVE_VALUES(자기서술로도 신뢰할 만한 5개)와 OBSERVED_VALUES(자기서술로는
// 인상관리 위험이 큰 7개)를 하나의 "overall" 숫자로 뭉치면, 신뢰도가 다른 두
// 값이 구분 없이 섞여 대표 점수의 방어력이 떨어진다(설계원칙 1번 "이중 측정
// 구조"가 실제로는 집계 단계에서 지켜지지 않는 문제 — 코드 리뷰로 발견해 분리함).
// 그래서 그룹별로 따로 평균낸다.
function avgByGroup(responses, group) {
  const scores = [];
  responses.forEach((r) => {
    Object.entries(r.scores ?? {}).forEach(([label, score]) => {
      if (group.includes(label)) scores.push(score);
    });
  });
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
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
          return {
            ...intern,
            responseCount: list.length,
            narrativeAvg: avgByGroup(list, NARRATIVE_VALUES),
            observedAvg: avgByGroup(list, OBSERVED_VALUES),
          };
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
      <ScoreCaveat />
      <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
        서술형 평균은 자기서술로도 신뢰도가 높은 5개 값, 관찰형 평균은 원래 팀장 관찰이
        더 정확한 7개 값을 AI 자기서술로 채점한 것(참고용 — 3/6개월 시점엔 실제 팀장
        관찰과 비교됨)입니다. 둘을 하나로 합치지 않습니다.
      </div>
      {rows.length === 0 && <div className="muted">등록된 신입이 없습니다.</div>}
      {rows.map((r) => (
        <Link key={r.uid} to={`/hr/responses/${r.uid}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="row">
            <span>{r.email ?? r.uid} · 제출 {r.responseCount}건</span>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>서술형 {r.narrativeAvg ?? "-"}</span>
              <span className="muted" style={{ marginLeft: 10 }}>관찰형(자기서술) {r.observedAvg ?? "-"}</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
