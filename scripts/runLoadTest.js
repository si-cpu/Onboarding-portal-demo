// 로드테스트: 더미 인턴 N명 × 라운드 R회씩 /api/score를 동시 CONCURRENCY개씩
// 배치로 호출한다. 실제 Claude(또는 교체한 모델) 호출 횟수·비용을 실측하기 위한 스크립트다.
//
// 사전 준비:
//   1. .env.local에 VITE_FIREBASE_*, FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY, ANTHROPIC_API_KEY 설정
//   2. node --env-file=.env.local scripts/seedTestUsers.js  (더미 인턴 계정 생성)
//   3. 별도 터미널에서 vercel dev  (api/*.js가 로컬에서 응답하려면 필요 — `vite`만으로는 /api가 없음)
//
// 실행: node --env-file=.env.local scripts/runLoadTest.js
// 환경변수로 조절: NUM_USERS(기본 20) ROUNDS(기본 8) CONCURRENCY(기본 10) BASE_URL(기본 http://localhost:3000)

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { MISSION_BANK } from "../api/missionBank.js";
import { generateDummyAnswer } from "./dummyAnswer.js";
import { loadCorpus, pickFromCorpus } from "./corpusAnswer.js";
import { emailFor, TEST_PASSWORD } from "./seedTestUsers.js";

const NUM_USERS = Number(process.env.NUM_USERS ?? 20);
const ROUNDS = Number(process.env.ROUNDS ?? 8);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS ?? 500);

function firebaseConfigFromEnv() {
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ];
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

async function getIdTokens(auth) {
  const tokens = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    const email = emailFor(i);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, TEST_PASSWORD);
      tokens.push(await cred.user.getIdToken());
    } catch (e) {
      console.error(`로그인 실패 (${email}): ${e.message} — 먼저 seedTestUsers.js를 실행했는지 확인하세요.`);
      process.exit(1);
    }
  }
  return tokens;
}

function buildTasks(idTokens) {
  const tasks = [];
  for (let u = 0; u < NUM_USERS; u++) {
    for (let r = 1; r <= ROUNDS; r++) {
      const mission = MISSION_BANK[(r - 1) % MISSION_BANK.length];
      const seed = u * 100000 + r * 1000 + mission.id;

      // dummyCorpus.json이 있으면(generateDummyCorpus.js로 미리 생성) 품질별
      // 실제 답변을 쓰고, 없으면 즉석 템플릿 생성기로 폴백한다.
      const corpusPick = pickFromCorpus(mission, seed);
      const answerText = corpusPick?.answerText ?? generateDummyAnswer(mission, seed);
      const quality = corpusPick?.quality ?? "template";

      tasks.push({ idToken: idTokens[u], missionId: mission.id, answerText, quality, label: `user${u + 1}-round${r}` });
    }
  }
  return tasks;
}

async function callScore(task) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${task.idToken}` },
      body: JSON.stringify({ missionId: task.missionId, answerText: task.answerText }),
    });
    const data = await res.json().catch(() => ({}));
    const ms = Date.now() - start;
    if (!res.ok) return { ...task, ok: false, ms, error: data.error ?? `HTTP ${res.status}` };
    return {
      ...task,
      ok: true,
      ms,
      cached: data.cached === true,
      feedback_text: data.feedback_text ?? null,
      nudge_text: data.nudge_text ?? null,
    };
  } catch (e) {
    return { ...task, ok: false, ms: Date.now() - start, error: e.message };
  }
}

async function runInBatches(tasks) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(callScore));
    results.push(...batchResults);
    const done = Math.min(i + CONCURRENCY, tasks.length);
    console.log(`진행: ${done}/${tasks.length}`);
    if (done < tasks.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  return results;
}

async function main() {
  const corpus = loadCorpus();
  console.log(
    corpus
      ? "dummyCorpus.json 발견 — 품질별(high/medium/low/evasive) 실제 답변으로 채점 품질을 테스트합니다."
      : "dummyCorpus.json 없음 — 즉석 템플릿 답변으로 진행합니다 (품질 차이를 보려면 먼저 `npm run gen:dummy-corpus`를 실행하세요)."
  );

  const app = initializeApp(firebaseConfigFromEnv());
  const auth = getAuth(app);

  console.log(`${NUM_USERS}명 로그인 중...`);
  const idTokens = await getIdTokens(auth);

  const tasks = buildTasks(idTokens);
  console.log(`총 ${tasks.length}건 호출 시작 (동시 ${CONCURRENCY}개씩, ${BASE_URL})`);

  const started = Date.now();
  const results = await runInBatches(tasks);
  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

  const succeeded = results.filter((r) => r.ok);
  const cached = succeeded.filter((r) => r.cached);
  const failed = results.filter((r) => !r.ok);
  const avgMs = succeeded.length ? Math.round(succeeded.reduce((a, r) => a + r.ms, 0) / succeeded.length) : 0;

  console.log("\n=== 결과 ===");
  console.log(`총 호출: ${results.length}건 · 성공: ${succeeded.length} · 실패: ${failed.length} · 캐시 응답: ${cached.length}`);
  console.log(`소요 시간: ${elapsedSec}초 · 평균 응답시간: ${avgMs}ms`);
  console.log(`실제 채점(캐시 아님, Claude 호출 발생): ${succeeded.length - cached.length}건`);
  if (failed.length) {
    console.log("\n실패 샘플 (최대 5건):");
    failed.slice(0, 5).forEach((f) => console.log(`  ${f.label}: ${f.error}`));
  }

  if (corpus) {
    console.log("\n=== 품질별 AI 피드백 샘플 (루브릭이 실제로 차이를 잡아내는지 확인용) ===");
    const byQuality = {};
    for (const r of succeeded) {
      if (r.cached) continue; // 캐시 응답은 새로 채점된 게 아니라 스킵
      (byQuality[r.quality] ??= []).push(r);
    }
    for (const quality of Object.keys(byQuality).sort()) {
      const sample = byQuality[quality][0];
      console.log(`\n[${quality}] (${sample.label}, 미션 #${sample.missionId})`);
      console.log(`  피드백: ${sample.feedback_text}`);
      if (sample.nudge_text) console.log(`  넛지: ${sample.nudge_text}`);
    }
  }

  console.log("\n실제 토큰/비용은 console.anthropic.com 사용량 대시보드에서 확인하세요 (score.js가 usage를 클라이언트로 내려주지 않음).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
