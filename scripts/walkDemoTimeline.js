// 3개월/6개월 종합 해석(comprehensiveReview) 화면을 실제 Claude 응답으로 확인하려면
// 26주치 답변이 쌓인 계정이 있어야 하는데, 실제 26주를 기다릴 수는 없다.
//
// 그렇다고 api/score.js의 서버 사이드 주차 게이팅(리스크9 패치)을 잠깐이라도 꺼서
// 우회하면, 그 주석 처리를 배포 전에 되돌리는 걸 깜빡할 위험이 있다 — 실제로 이런
// "테스트용으로 잠깐 끈 보안 체크를 다시 안 켜서 사고 나는" 패턴은 흔하다.
//
// 그래서 이 스크립트는 게이팅을 그대로 둔 채로, 전용 데모 계정 하나의 joinedAt을
// 매 주차 제출 직전마다 그 주차에 맞게 백데이트해서 "지금 이 계정은 진짜 그 주차다"를
// 서버가 매번 확인하게 하면서 1주차부터 26주차까지 실제 /api/score를 순서대로
// 호출한다. 13주차(3개월)와 26주차(6개월)에는 /api/comprehensiveReview도 같이 호출해서
// 실제 AI 종합 해석까지 눈으로 확인할 수 있게 한다.
//
// intern@test.local(브라우저 수동 데모용 공용 계정)은 건드리지 않고, 이 스크립트
// 전용의 별도 계정을 쓴다 — 26주 다 걸어버리면 그 계정은 "이미 다 끝난 상태"가
// 되어버려서, 발표 때 매니저가 처음부터 미션을 눌러보는 시연에는 못 쓰기 때문.
//
// 사전 준비:
//   1. .env.local에 VITE_FIREBASE_*, FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY, ANTHROPIC_API_KEY 설정
//   2. 별도 터미널에서 vercel dev (또는 BASE_URL로 배포된 주소 지정)
//
// 실행(발표용 고정 데모 계정 — demo-timeline@test.local):
//   node --env-file=.env.local scripts/walkDemoTimeline.js
//   완료 후: demo-timeline@test.local / DemoTimeline1234! 로 로그인하면 26주 전체 타임라인 +
//   3개월/6개월 종합 해석을 브라우저에서 그대로 볼 수 있다.
//
// ⚠️ 이 계정은 한 번 26주를 다 걸으면 리스크9의 재제출 가드 때문에 다시 돌려도
// missionId마다 "이미 제출했습니다" 409만 난다(발표용으로 상태를 고정해두기 위해
// 의도된 동작). 프롬프트/톤 수정 같은 걸 다시 검증하고 싶으면 태그를 붙여서
// 매번 새 계정으로 걸어라(발표용 계정은 그대로 안 건드려짐):
//   node --env-file=.env.local scripts/walkDemoTimeline.js retest1
//   → demo-timeline-retest1@test.local 로 새로 생성됨
// 실행: node --env-file=.env.local scripts/walkDemoTimeline.js

import { initializeApp } from "firebase/app";
import { getAuth as getClientAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { MISSION_BANK } from "../api/missionBank.js";
import { generateDummyAnswer } from "./dummyAnswer.js";
import { loadCorpus } from "./corpusAnswer.js";
import { ensureAdminApp } from "./_adminApp.js";

const RUN_TAG = process.argv[2] ?? null;
const DEMO_EMAIL = RUN_TAG ? `demo-timeline-${RUN_TAG}@test.local` : "demo-timeline@test.local";
const DEMO_PASSWORD = "DemoTimeline1234!";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MID_REVIEW_WEEK = 13;
const FINAL_REVIEW_WEEK = 26;

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

// 최고 품질 답변을 우선 사용해서(코퍼스가 있으면 "high", 없으면 즉석 템플릿),
// 데모에서 보여줄 성장 서사가 실제로 긍정적인 흐름으로 나오게 한다.
function answerFor(mission, week) {
  const corpus = loadCorpus();
  const variants = corpus ? corpus[mission.id] : null;
  const best = variants?.find((v) => v.quality === "high") ?? variants?.[0];
  return best?.answerText ?? generateDummyAnswer(mission, week * 7919);
}

async function ensureDemoAccountAtWeek(adminAuth, adminDb, week) {
  let user;
  try {
    user = await adminAuth.getUserByEmail(DEMO_EMAIL);
  } catch {
    user = await adminAuth.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, emailVerified: true });
  }
  const joinedAt = new Date(Date.now() - (week - 1) * WEEK_MS);
  await adminDb.collection("users").doc(user.uid).set({ role: "intern", email: DEMO_EMAIL, joinedAt }, { merge: true });
  return user.uid;
}

async function callApi(path, idToken, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const clientAuth = getClientAuth(initializeApp(firebaseConfigFromEnv()));
  const adminApp = ensureAdminApp();
  const adminAuth = getAdminAuth(adminApp);
  const adminDb = getFirestore(adminApp);

  console.log(`데모 계정 준비: ${DEMO_EMAIL}`);
  await ensureDemoAccountAtWeek(adminAuth, adminDb, 1);
  const cred = await signInWithEmailAndPassword(clientAuth, DEMO_EMAIL, DEMO_PASSWORD);
  const idToken = await cred.user.getIdToken();

  for (const mission of MISSION_BANK) {
    const week = mission.id; // MISSION_BANK의 id가 곧 주차
    await ensureDemoAccountAtWeek(adminAuth, adminDb, week);

    const answerText = answerFor(mission, week);
    const scoreRes = await callApi("/api/score", idToken, { missionId: week, answerText });
    if (!scoreRes.ok) {
      console.log(`❌ ${week}주차 제출 실패: ${scoreRes.data.error ?? scoreRes.status}`);
    } else {
      console.log(`✅ ${week}주차 제출 완료${scoreRes.data.cached ? " (캐시)" : ""} — 피드백: ${scoreRes.data.feedback_text?.slice(0, 60)}...`);
    }

    if (week === MID_REVIEW_WEEK || week === FINAL_REVIEW_WEEK) {
      const reviewType = week === MID_REVIEW_WEEK ? "mid" : "final";
      const reviewRes = await callApi("/api/comprehensiveReview", idToken, { reviewType });
      console.log(`\n=== ${reviewType === "mid" ? "3개월" : "6개월"} 종합 해석 (${week}주차) ===`);
      if (!reviewRes.ok) console.log(`❌ 생성 실패: ${reviewRes.data.error ?? reviewRes.status}`);
      else console.log(reviewRes.data.narrative_text);
      console.log("");
    }
  }

  console.log(`\n완료. 브라우저에서 ${DEMO_EMAIL} / ${DEMO_PASSWORD} 로 로그인하면`);
  console.log("내 답변 타임라인, 3개월/6개월 종합 해석을 실제 화면으로 그대로 볼 수 있습니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
