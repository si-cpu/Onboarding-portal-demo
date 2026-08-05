import { useEffect, useState } from "react";
import { doc, getDoc, getDocs, collection, query, where, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { OBSERVED_VALUES } from "../../lib/coreValues";
import { MANAGER_CHECKPOINT_WEEKS, getCurrentWeek } from "../../lib/week";
import ConfirmDialog from "../../components/ConfirmDialog";

const DEFAULT_SCORE = 50;

// manager_feedback: 신입은 절대 read 불가 (firestore.rules + 라우터의
// RequireRole role="manager"로 이중 차단, 평가자 익명성 원칙).
//
// 문서 ID를 `{internId}_{checkpointWeek}`로 고정해서(MANAGER_CHECKPOINT_WEEKS —
// 26주 동안 6번, 약 월 1회), 같은 체크인 주차에 대해서는 새로 쓰는 게 아니라
// 덮어쓰기(수정)가 되게 한다. 예전엔 3개월/6개월 심사 직전 딱 2번만 남기는
// 구조였는데, 그러면 팀장 관찰도 "관계가 끝나가는 시점의 총평"과 똑같이 왜곡
// 위험이 커진다는 걸 외부 리뷰로 지적받아 평상시 여러 시점으로 나눴다.
export default function MetaFeedbackPage() {
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState("");
  const [checkpointWeek, setCheckpointWeek] = useState(null);
  const [scores, setScores] = useState({}); // { [value]: number } — 관찰 안 한 값은 키 자체가 없음
  const [comment, setComment] = useState("");
  const [hasExistingEntry, setHasExistingEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);

  async function loadEntries() {
    const snap = await getDocs(query(collection(db, "manager_feedback"), where("managerId", "==", auth.currentUser.uid)));
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => {
    (async () => {
      try {
        // HR 배정 화면(AssignmentsPage)에서 정한 managerId로 담당 신입만 보여준다.
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

  const selectedInternData = interns.find((i) => i.uid === selectedIntern);
  const internCurrentWeek = selectedInternData ? getCurrentWeek(selectedInternData.joinedAt?.toDate?.() ?? null) : 1;
  // 아직 도달 안 한 체크인 주차는 선택지에서 뺀다 — 심사 시점 몰아쓰기를 막으려는
  // 취지 자체가 "아직 안 된 주차를 미리 채우는 것"도 같이 막아야 의미가 있다.
  const reachableCheckpoints = MANAGER_CHECKPOINT_WEEKS.filter((w) => w <= internCurrentWeek);

  // 신입을 바꾸면 그 신입 기준으로 도달한 가장 최근 체크인 주차를 기본 선택한다.
  useEffect(() => {
    if (!selectedIntern) {
      setCheckpointWeek(null);
      return;
    }
    setCheckpointWeek(reachableCheckpoints[reachableCheckpoints.length - 1] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIntern]);

  // 신입/체크인 주차를 바꾸면 이미 남겨둔 관찰이 있는지 확인해서 불러온다.
  useEffect(() => {
    if (!selectedIntern || !checkpointWeek) return;
    setJustSaved(false);
    (async () => {
      const docId = `${selectedIntern}_${checkpointWeek}`;
      const snap = await getDoc(doc(db, "manager_feedback", docId));
      if (snap.exists()) {
        setScores(snap.data().scores ?? {});
        setComment(snap.data().comment ?? "");
        setHasExistingEntry(true);
      } else {
        setScores({});
        setComment("");
        setHasExistingEntry(false);
      }
    })();
  }, [selectedIntern, checkpointWeek]);

  function toggleObserved(value, checked) {
    setScores((prev) => {
      const next = { ...prev };
      if (checked) next[value] = next[value] ?? DEFAULT_SCORE;
      else delete next[value];
      return next;
    });
  }

  async function submit() {
    if (!selectedIntern || !checkpointWeek) return;
    setSaving(true);
    try {
      const docId = `${selectedIntern}_${checkpointWeek}`;
      await setDoc(
        doc(db, "manager_feedback", docId),
        {
          managerId: auth.currentUser.uid,
          internId: selectedIntern,
          checkpointWeek,
          scores,
          comment: comment.trim() || null,
          updatedAt: serverTimestamp(),
        },
        { merge: false } // 관찰 못 한 값을 체크 해제하면 그 키가 사라져야 하므로 병합하지 않고 통째로 덮어씀
      );
      setHasExistingEntry(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      await loadEntries();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  // 매니저는 firestore.rules상 문서 자체를 delete할 권한이 없다(체크인 슬롯이
  // internId_checkpointWeek로 고정돼 있어 애초에 삭제 개념보다 "비워서 덮어쓰기"가
  // 자연스럽다) — scores/comment를 빈 값으로 되돌려 사실상 "이 체크인 지우기"와
  // 같은 효과를 낸다.
  async function removeEntry() {
    if (!selectedIntern || !checkpointWeek) return;
    setConfirmDeleteOpen(false);
    setSaving(true);
    try {
      const docId = `${selectedIntern}_${checkpointWeek}`;
      await setDoc(
        doc(db, "manager_feedback", docId),
        {
          managerId: auth.currentUser.uid,
          internId: selectedIntern,
          checkpointWeek,
          scores: {},
          comment: null,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
      setScores({});
      setComment("");
      setHasExistingEntry(false);
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
          매주 입력하는 게 아니라, 약 월 1회(4·8·12·16·20·25주차)에 짧게 체크인하면 됩니다.
          관찰 못 한 항목은 체크를 꺼두세요 — 50점으로 저장되지 않고 아예 기록에서 빠집니다.
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

            {selectedIntern && reachableCheckpoints.length === 0 && (
              <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                아직 첫 체크인 주차(4주차)가 안 됐습니다 — 지금은 {internCurrentWeek}주차입니다.
              </div>
            )}

            {reachableCheckpoints.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                {reachableCheckpoints.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={checkpointWeek === w ? "btn" : "btn btn-secondary"}
                    style={{ width: "auto", marginTop: 0, padding: "6px 12px", fontSize: 13 }}
                    onClick={() => setCheckpointWeek(w)}
                  >
                    {w}주차 체크인
                  </button>
                ))}
              </div>
            )}

            {checkpointWeek && (
              <>
                {hasExistingEntry && (
                  <div className="badge" style={{ display: "block", marginBottom: 10 }}>
                    이미 저장된 체크인 · 수정 중 (저장하면 기존 값을 덮어씁니다)
                  </div>
                )}
                {OBSERVED_VALUES.map((value) => {
                  const observed = value in scores;
                  return (
                    <div key={value} style={{ marginBottom: 12 }}>
                      <div className="muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={observed}
                            onChange={(e) => toggleObserved(value, e.target.checked)}
                          />
                          {value}
                        </label>
                        <span>{observed ? scores[value] : "관찰 못 함"}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={scores[value] ?? DEFAULT_SCORE}
                        disabled={!observed}
                        onChange={(e) => setScores((prev) => ({ ...prev, [value]: Number(e.target.value) }))}
                        style={{ width: "100%", opacity: observed ? 1 : 0.4 }}
                      />
                    </div>
                  );
                })}

                <textarea
                  className="textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="(선택) 맥락 코멘트 — 이 신입에게는 절대 노출되지 않습니다."
                />
                {justSaved && <div className="success">✅ 저장 완료</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={submit} disabled={saving || !selectedIntern}>
                    {saving ? "저장 중..." : hasExistingEntry ? `${checkpointWeek}주차 체크인 수정 저장` : `${checkpointWeek}주차 체크인 저장`}
                  </button>
                  {hasExistingEntry && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => setConfirmDeleteOpen(true)}
                      disabled={saving}
                    >
                      삭제
                    </button>
                  )}
                </div>
                {error && <div className="error">{error}</div>}
              </>
            )}

            <ConfirmDialog
              open={confirmDeleteOpen}
              message={"이 체크인 기록을 삭제하시겠습니까?"}
              onConfirm={removeEntry}
              onCancel={() => setConfirmDeleteOpen(false)}
            />
          </>
        )}
      </div>

      <div className="card card-wide">
        <div className="label">내가 남긴 관찰</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          항목을 클릭하면 위 입력창으로 불러와 수정할 수 있습니다.
        </div>
        {/* 삭제(=scores/comment를 비워서 덮어쓰기)된 체크인은 목록에서도 빠져야
            "삭제됐다"는 게 눈에 보인다 — 문서 자체는 남아 있지만 내용이 없는 빈
            항목까지 계속 보이면 삭제가 안 된 것처럼 보인다. */}
        {entries.filter((e) => (e.scores && Object.keys(e.scores).length > 0) || e.comment).length === 0 && (
          <div className="muted">아직 남긴 관찰이 없습니다.</div>
        )}
        {entries
          .filter((e) => (e.scores && Object.keys(e.scores).length > 0) || e.comment)
          .slice()
          .sort((a, b) => (a.checkpointWeek ?? 0) - (b.checkpointWeek ?? 0))
          .map((e) => (
            <div
              className="row"
              key={e.id}
              style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, cursor: "pointer" }}
              onClick={() => {
                setSelectedIntern(e.internId);
                setCheckpointWeek(e.checkpointWeek);
              }}
            >
              <span>
                {/* raw uid 대신 이메일로 표시 — interns 목록에 없으면(배정 해제 등) uid로 폴백 */}
                {interns.find((i) => i.uid === e.internId)?.email ?? e.internId} · {e.checkpointWeek}주차 체크인
              </span>
              {e.scores && Object.keys(e.scores).length > 0 && (
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
