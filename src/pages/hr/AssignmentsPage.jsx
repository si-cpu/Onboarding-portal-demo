import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

// 신입-매니저 배정을 관리하는 HR 전용 화면. users/{internId}.managerId를 여기서 설정한다.
//
// 이 화면이 없던 이전 버전에서는 매니저 role이면 아무 신입에게나 관찰(manager_feedback)을
// 남길 수 있었다 — 배정이라는 개념 자체가 코드에 없었기 때문이다. 그 결과 (a) 담당자가
// 아닌 다른 매니저가 같은 신입에 값을 저장하면 기존 관찰이 경고 없이 덮어써질 수 있었고,
// (b) 20명·5개 분야처럼 매니저가 여러 명인 실제 조직 구조를 반영할 방법이 없었다(코드
// 리뷰로 발견). MetaFeedbackPage는 이제 managerId로 필터링된 담당 신입만 보여주고,
// firestore.rules도 manager_feedback read/write를 배정 관계로 제한한다.
export default function AssignmentsPage() {
  const [interns, setInterns] = useState(null);
  const [managers, setManagers] = useState([]);
  const [savingUid, setSavingUid] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const [internsSnap, managersSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "intern"))),
        getDocs(query(collection(db, "users"), where("role", "==", "manager"))),
      ]);
      setInterns(internsSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      setManagers(managersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function assign(internUid, managerUid) {
    setSavingUid(internUid);
    try {
      await updateDoc(doc(db, "users", internUid), { managerId: managerUid || null });
      setInterns((prev) =>
        prev.map((i) => (i.uid === internUid ? { ...i, managerId: managerUid || null } : i))
      );
    } catch (e) {
      setError(e.message);
    }
    setSavingUid(null);
  }

  if (error) return <div className="error">{error}</div>;
  if (!interns) return <div className="muted">불러오는 중...</div>;

  return (
    <div className="card card-wide">
      <div className="label">신입-매니저 배정</div>
      <div className="muted" style={{ marginBottom: 14, fontSize: 13 }}>
        여기서 배정한 매니저만 해당 신입의 비공개 관찰(manager_feedback)을 남기고 볼 수
        있습니다. 배정 전에는 담당 매니저가 목록에서 이 신입을 볼 수 없습니다.
      </div>
      {interns.length === 0 && <div className="muted">등록된 신입이 없습니다.</div>}
      {managers.length === 0 && interns.length > 0 && (
        <div className="muted" style={{ marginBottom: 12 }}>
          등록된 매니저 계정이 없습니다.
        </div>
      )}
      {interns.map((intern) => (
        <div className="row" key={intern.uid} style={{ gap: 10 }}>
          <span>{intern.email ?? intern.uid}</span>
          <select
            className="input"
            style={{ maxWidth: 240 }}
            value={intern.managerId ?? ""}
            disabled={savingUid === intern.uid}
            onChange={(e) => assign(intern.uid, e.target.value)}
          >
            <option value="">미배정</option>
            {managers.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.email ?? m.uid}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
