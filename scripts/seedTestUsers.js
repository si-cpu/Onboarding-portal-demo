// 로드테스트용 가짜 인턴 계정 N명을 Firebase Auth + Firestore users/{uid}에 생성한다.
// 이미 존재하는 이메일은 건너뛴다 (여러 번 실행해도 안전).
//
// 실행: node --env-file=.env.local scripts/seedTestUsers.js [인원수(기본 20)]

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "./_adminApp.js";

const COUNT = Number(process.argv[2] ?? 20);
export const TEST_PASSWORD = "LoadTest1234!";

export function emailFor(i) {
  return `loadtest-intern-${i}@test.local`;
}

async function main() {
  const app = ensureAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= COUNT; i++) {
    const email = emailFor(i);
    let user;
    let isNew = false;
    try {
      user = await auth.getUserByEmail(email);
      skipped++;
    } catch {
      user = await auth.createUser({ email, password: TEST_PASSWORD, emailVerified: true });
      created++;
      isNew = true;
    }
    const docData = { role: "intern", email };
    if (isNew) docData.joinedAt = new Date();
    await db.collection("users").doc(user.uid).set(docData, { merge: true });
  }

  console.log(`완료: 생성 ${created}명, 기존 ${skipped}명 (총 ${COUNT}명, 비밀번호: ${TEST_PASSWORD})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
