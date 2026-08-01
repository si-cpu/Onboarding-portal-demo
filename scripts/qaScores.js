// 앵커(기준점 예시)를 넣은 루브릭이 실제로 품질 순서(high > medium > low/evasive)를
// 지키는지 확인하는 QA 스크립트. dummyCorpus.json의 품질별 답변을 실제로 채점시키고,
// Firestore에서 점수를 직접 읽어 비교한다 (score.js는 보안상 점수를 클라이언트에
// 안 내려주므로 Admin SDK로 우회 조회 — QA 전용 예외).
//
// 사전 준비:
//   1. npm run gen:dummy-corpus (dummyCorpus.json이 아직 없으면)
//   2. npm run dev:api (vercel dev가 떠 있어야 함)
// 실행: node --env-file=.env.local scripts/qaScores.js

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase-admin/firestore";
import { MISSION_BANK } from "../api/missionBank.js";
import { loadCorpus } from "./corpusAnswer.js";
import { ensureAdminApp } from "./_adminApp.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "intern@test.local";
const TEST_PASSWORD = "RoleTest1234!";

function firebaseConfigFromEnv() {
  const required = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`.env.local에 다음 값이 필요합니다: ${missing.join(", ")}`);
    process.exit(1);
  }
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };
}

async function main() {
  const corpus = loadCorpus();
  if (!corpus) {
    console.error("dummyCorpus.json이 없습니다. 먼저 `npm run gen:dummy-corpus`를 실행하세요.");
    process.exit(1);
  }

  const app = initializeApp(firebaseConfigFromEnv());
  const auth = getAuth(app);
  const cred = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
  const idToken = await cred.user.getIdToken();
  const uid = cred.user.uid;

  const adminDb = getFirestore(ensureAdminApp());
  const salt = Date.now(); // 매 실행마다 답변을 고유하게 만들어 해시 캐시를 우회(진짜로 다시 채점되게)

  const rows = [];

  for (const [missionIdStr, variants] of Object.entries(corpus)) {
    const missionId = Number(missionIdStr);
    const mission = MISSION_BANK.find((m) => m.id === missionId);
    if (!mission) continue;

    for (const variant of variants) {
      const answerText = `${variant.answerText} (qa-${salt})`;
      process.stdout.write(`미션 #${missionId} [${variant.quality}] 채점 중...\n`);

      const res = await fetch(`${BASE_URL}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ missionId, answerText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        rows.push({ missionId, type: mission.type, quality: variant.quality, error: data.error ?? `HTTP ${res.status}` });
        continue;
      }

      const snap = await adminDb
        .collection("responses")
        .where("userId", "==", uid)
        .where("missionId", "==", missionId)
        .orderBy("round", "desc")
        .limit(1)
        .get();
      const doc = snap.docs[0]?.data();
      const scores = doc?.scores ?? {};
      const values = Object.values(scores);
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
      rows.push({ missionId, type: mission.type, quality: variant.quality, avg, scores });
    }
  }

  console.log("\n=== QA 결과: 미션별 품질(quality) vs 실제 평균 점수 ===");
  const byMission = {};
  rows.forEach((r) => (byMission[r.missionId] ??= []).push(r));

  let failCount = 0;
  for (const [missionId, group] of Object.entries(byMission)) {
    console.log(`\n미션 #${missionId} (${group[0].type})`);
    group.forEach((r) => {
      if (r.error) console.log(`  ${r.quality.padEnd(8)} ERROR: ${r.error}`);
      else console.log(`  ${r.quality.padEnd(8)} 평균 ${r.avg}점  ${JSON.stringify(r.scores)}`);
    });

    const high = group.find((r) => r.quality === "high")?.avg;
    const low = group.find((r) => r.quality === "low" || r.quality === "evasive")?.avg;
    if (high != null && low != null) {
      const pass = high > low;
      if (!pass) failCount++;
      console.log(`  ${pass ? "✅ PASS" : "❌ FAIL"} — high(${high}) vs low/evasive(${low})`);
    }
  }

  console.log(
    failCount === 0
      ? "\n✅ 모든 미션에서 high > low/evasive 순서 유지됨"
      : `\n❌ ${failCount}개 미션에서 순서가 역전됨 — 루브릭/앵커 조정이 필요할 수 있습니다`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
