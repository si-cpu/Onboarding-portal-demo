// scripts/*.js가 공통으로 쓰는 Firebase Admin 앱 초기화 (api/_firebaseAdmin.js와 동일한 자격증명).

import { initializeApp, getApps, cert } from "firebase-admin/app";

export function ensureAdminApp() {
  if (getApps().length) return getApps()[0];
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error("FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY가 필요합니다.");
    console.error("node --env-file=.env.local scripts/... 형태로 실행하세요.");
    process.exit(1);
  }
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
