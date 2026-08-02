// 앵커(기준점 예시)를 넣은 루브릭이 실제로 품질 순서(high > medium > low/evasive)를
// 지키는지 확인하는 QA 스크립트. dummyCorpus.json의 품질별 답변을 실제로 채점시키고,
// Firestore에서 점수를 직접 읽어 비교한다 (score.js는 보안상 점수를 클라이언트에
// 안 내려주므로 Admin SDK로 우회 조회 — QA 전용 예외).
//
// api/score.js의 서버 사이드 주차 게이팅(리스크9 패치) 때문에 계정 하나로 26개
// 미션을 한 번에 채점시킬 수 없다(그 계정의 "이번 주"가 아닌 missionId는 403).
// 그래서 미션마다 전용 QA 계정을 두고, joinedAt을 (missionId-1)주 전으로 백데이트해서
// "지금이 바로 이 계정의 그 주차"가 되도록 맞춘다 — intern@test.local(수동 데모용
// 공용 계정)은 건드리지 않는다.
//
// ⚠️ 계정은 missionId뿐 아니라 quality(high/medium/low/evasive)별로도 분리해야 한다
// (`qa-mission-{missionId}-{quality}-{runId}@test.local`). score.js는 "같은 계정 +
// 같은 missionId 재제출"을 409로 막는데(리스크9 패치의 일부), 계정을 missionId로만
// 나누면 같은 계정으로 high/medium/low를 연달아 제출하다가 두 번째 제출부터
// 전부 409로 막힌다 — salt는 answerHash 캐시만 우회할 뿐 이 재제출 가드는
// 못 피한다.
//
// ⚠️ 실행마다 고유한 runId(스크립트 시작 시각)를 이메일에 붙인다. 안 붙이면
// 같은 주 안에 qa:scores를 두 번째 돌릴 때 이전 실행에서 쓴 계정들이 이미
// "이번 주 제출 완료" 상태라 전부 409로 막힌다 — 실제로 이 문제가 한 번
// 발생해서, 76/78건이 전부 에러였는데도 판정 로직이 에러를 "검사 대상 없음"으로
// 스킵하는 바람에 "✅ 모든 미션 순서 유지됨"이라는 가짜 초록불이 떴었다.
// (그 판정 버그도 아래에서 별도로 고쳤다 — 에러는 이제 스킵이 아니라 실패로 집계된다.)
//
// 사전 준비:
//   1. npm run gen:dummy-corpus (dummyCorpus.json이 아직 없으면)
//   2. npm run dev:api (vercel dev가 떠 있어야 함)
// 실행: node --env-file=.env.local scripts/qaScores.js
//   ⚠️ joinedAt 백데이트는 실행 시점 기준이라 매번 계정을 다시 맞춘 뒤 바로 이어서 채점한다.
//   ⚠️ 매 실행마다 새 Firebase Auth 계정(78개)이 생긴다 — QA 전용 더미 계정이라
//      누적돼도 무방하지만, 참고로 알아둘 것.

import { initializeApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { MISSION_BANK } from "../api/missionBank.js";
import { loadCorpus } from "./corpusAnswer.js";
import { ensureAdminApp } from "./_adminApp.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const QA_PASSWORD = "QaScore1234!";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function qaEmailFor(missionId, quality, runId) {
  return `qa-mission-${missionId}-${quality}-${runId}@test.local`;
}

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

// missionId×quality×runId 전용 QA 계정을 만들고(항상 이번 실행에서 신규 생성),
// joinedAt을 이 실행 시점 기준으로 (missionId-1)주 전으로 맞춘 뒤 uid를 반환한다.
async function ensureQaAccount(adminAuth, adminDb, missionId, quality, runId) {
  const email = qaEmailFor(missionId, quality, runId);
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch {
    user = await adminAuth.createUser({ email, password: QA_PASSWORD, emailVerified: true });
  }
  const joinedAt = new Date(Date.now() - (missionId - 1) * WEEK_MS);
  await adminDb.collection("users").doc(user.uid).set({ role: "intern", email, joinedAt }, { merge: true });
  return user.uid;
}

async function main() {
  const corpus = loadCorpus();
  if (!corpus) {
    console.error("dummyCorpus.json이 없습니다. 먼저 `npm run gen:dummy-corpus`를 실행하세요.");
    process.exit(1);
  }

  const clientAuth = getClientAuth(initializeApp(firebaseConfigFromEnv()));
  const adminApp = ensureAdminApp();
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getFirestore(adminApp);

  const runId = Date.now(); // 실행마다 고유 계정을 써서 "이번 주 이미 제출" 충돌을 원천 차단
  const salt = runId; // 답변 텍스트도 고유하게 만들어 해시 캐시를 우회(진짜로 다시 채점되게)
  const rows = [];

  for (const [missionIdStr, variants] of Object.entries(corpus)) {
    const missionId = Number(missionIdStr);
    const mission = MISSION_BANK.find((m) => m.id === missionId);
    if (!mission) continue;

    for (const variant of variants) {
      try {
        const uid = await ensureQaAccount(adminAuth, adminDb, missionId, variant.quality, runId);
        const cred = await signInWithEmailAndPassword(clientAuth, qaEmailFor(missionId, variant.quality, runId), QA_PASSWORD);
        const idToken = await cred.user.getIdToken();

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
      } catch (e) {
        // 이 한 건이 예외로 죽어도(예: Firestore 인덱스 미비) 나머지 77건은 계속
        // 진행한다 — 하나가 죽었다고 전체 QA 결과가 통째로 안 나오는 것보다,
        // 이 건만 ERROR로 남기고 끝까지 도는 게 낫다.
        rows.push({ missionId, type: mission.type, quality: variant.quality, error: e.message });
      }
    }
  }

  console.log("\n=== QA 결과: 미션별 품질(quality) vs 실제 평균 점수 ===");
  const byMission = {};
  rows.forEach((r) => (byMission[r.missionId] ??= []).push(r));

  // ⚠️ 에러는 "검사 대상 없음"으로 조용히 넘기지 않는다 — 예전 버전은 high/low가
  // null이면(에러난 경우 포함) 그냥 순서 비교 자체를 스킵했는데, 그 결과 대부분이
  // 에러난 실행에서도 failCount=0이 나와 "✅ 전부 통과"라는 가짜 초록불이 떴다.
  // 에러가 하나라도 있는 미션은 반드시 problemCount에 잡히게 한다.
  let orderReversedCount = 0;
  let errorMissionCount = 0;
  for (const [missionId, group] of Object.entries(byMission)) {
    console.log(`\n미션 #${missionId} (${group[0].type})`);
    group.forEach((r) => {
      if (r.error) console.log(`  ${r.quality.padEnd(8)} ERROR: ${r.error}`);
      else console.log(`  ${r.quality.padEnd(8)} 평균 ${r.avg}점  ${JSON.stringify(r.scores)}`);
    });

    if (group.some((r) => r.error)) {
      errorMissionCount++;
      console.log("  ⚠️ ERROR — 이 미션은 채점 자체가 실패해서 순서 비교를 신뢰할 수 없음 (스킵이 아니라 실패로 집계됨)");
      continue;
    }

    const high = group.find((r) => r.quality === "high")?.avg;
    const low = group.find((r) => r.quality === "low" || r.quality === "evasive")?.avg;
    if (high != null && low != null) {
      const pass = high > low;
      if (!pass) orderReversedCount++;
      console.log(`  ${pass ? "✅ PASS" : "❌ FAIL"} — high(${high}) vs low/evasive(${low})`);
    }
  }

  const totalProblems = orderReversedCount + errorMissionCount;
  console.log(
    totalProblems === 0
      ? "\n✅ 모든 미션에서 high > low/evasive 순서 유지됨 (에러 0건, 전부 실제로 채점됨)"
      : `\n❌ 문제 ${totalProblems}건 — 순서 역전 ${orderReversedCount}건, 채점 자체 실패 ${errorMissionCount}건 (전부 확인 필요)`
  );

  // 문제가 있으면 exit code로도 드러낸다 — 스크립트를 이어붙여 쓸 때(예: CI)
  // 콘솔 로그를 안 보고 종료 코드만 봐도 "조용히 넘어간 실패"가 없게 한다.
  if (totalProblems > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
