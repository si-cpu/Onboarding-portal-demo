// Vercel 서버리스 함수: POST /api/checkCache
// Headers: Authorization: Bearer <firebase idToken>
// body: { missionId? }
//
// 신입 화면(MissionPage/FeedbackPage/TimelinePage)은 Firestore SDK로 responses를
// 직접 읽지 않는다(README 참고: 문서를 통째로 읽으면 scores 필드까지 같이 내려온다).
// 대신 이 엔드포인트를 거쳐 answerText/feedback_text/nudge_text 등 안전한 필드만
// 받는다 — scores/evidence_density는 절대 포함하지 않는다(점수 비공개 원칙).
//
// - missionId가 있으면: 해당 미션의 가장 최근 제출 1건 (없으면 exists:false)
// - missionId가 없으면: 모든 미션에 대해 각각 가장 최근 제출 1건씩 (피드백 히스토리 화면용)

import { adminDb, requireUid, requireIntern } from "./_firebaseAdmin.js";
import { newRequestId, log, alert } from "./_logger.js";

function toSafeEntry(doc) {
  const d = doc.data();
  return {
    missionId: d.missionId,
    round: d.round,
    answerText: d.answerText,
    feedback_text: d.feedback_text,
    nudge_text: d.nudge_text ?? null,
    submittedAt: d.createdAt?.toMillis?.() ?? null,
  };
}

export default async function handler(req, res) {
  const requestId = newRequestId();
  if (req.method !== "POST") return res.status(405).end();

  let uid;
  try {
    uid = await requireUid(req);
    await requireIntern(uid);
  } catch (e) {
    alert(requestId, "checkCache.auth_failed", { status: e.status, message: e.message });
    return res.status(e.status ?? 401).json({ error: e.status === 403 ? "신입 전용 기능입니다." : "인증이 필요합니다." });
  }

  const { missionId } = req.body ?? {};
  log(requestId, "checkCache.request_received", { uid, missionId: missionId ?? "all" });
  const responses = adminDb.collection("responses");

  try {
    if (missionId) {
      const snap = await responses
        .where("userId", "==", uid)
        .where("missionId", "==", missionId)
        .orderBy("round", "asc")
        .get();

      if (snap.empty) return res.status(200).json({ exists: false, history: [] });
      const history = snap.docs.map(toSafeEntry);
      return res.status(200).json({ exists: true, ...history[history.length - 1], history });
    }

    const allSnap = await responses.where("userId", "==", uid).orderBy("round", "desc").get();
    const latestByMission = new Map();
    allSnap.forEach((doc) => {
      const d = doc.data();
      if (!latestByMission.has(d.missionId)) latestByMission.set(d.missionId, toSafeEntry(doc));
    });

    return res.status(200).json({ entries: Array.from(latestByMission.values()) });
  } catch (e) {
    alert(requestId, "checkCache.query_failed", { uid, missionId, message: e.message });
    return res.status(500).json({ error: "조회 중 오류가 발생했습니다." });
  }
}
