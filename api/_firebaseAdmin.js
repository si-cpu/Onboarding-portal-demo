// 서버 전용 Firebase Admin 초기화 (서비스 계정 사용, 클라이언트 firebase.js와 별개).
// score/checkCache/growthNarrative가 공유하는 인증 검증 + Firestore 접근 헬퍼.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function ensureApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
}

const app = ensureApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

// Authorization: Bearer <idToken> 헤더를 검증하고 uid를 반환한다.
// 신입 자신의 userId를 body에서 그대로 믿지 않고, 반드시 토큰에서 uid를 뽑아 사용한다.
export async function requireUid(req) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    const err = new Error("missing bearer token");
    err.status = 401;
    throw err;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    const err = new Error("invalid token");
    err.status = 401;
    throw err;
  }
}

// score/checkCache/growthNarrative는 신입 전용 기능이다 — 로그인만 되어 있으면
// 매니저/인사팀 계정으로도 호출할 수 있던 구멍을 막는다.
export async function requireIntern(uid) {
  const snap = await adminDb.collection("users").doc(uid).get();
  if (snap.data()?.role !== "intern") {
    const err = new Error("intern 권한이 필요합니다.");
    err.status = 403;
    throw err;
  }
}
