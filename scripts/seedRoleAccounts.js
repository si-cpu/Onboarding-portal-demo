// 역할별(신입/매니저/인사팀) 화면 분기를 브라우저에서 직접 눈으로 확인하기 위한
// 대표 계정 3개를 생성한다. 여러 번 실행해도 안전(이미 있으면 role만 갱신, joinedAt은
// 최초 생성 시에만 세팅해서 재실행해도 신입의 주차 진행이 리셋되지 않는다).
//
// 실행: node --env-file=.env.local scripts/seedRoleAccounts.js [intern주차조작:몇주전에입사했는지]
// 예) node --env-file=.env.local scripts/seedRoleAccounts.js 12   → intern 계정이 13주차(3개월 리뷰)로 시작

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "./_adminApp.js";

export const ROLE_TEST_PASSWORD = "RoleTest1234!";

export const ROLE_ACCOUNTS = [
  { email: "intern@test.local", role: "intern" },
  { email: "manager@test.local", role: "manager" },
  { email: "hr@test.local", role: "hr" },
];

const internWeeksAgo = process.argv[2] !== undefined ? Number(process.argv[2]) : null;

async function main() {
  const app = ensureAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  for (const { email, role } of ROLE_ACCOUNTS) {
    let user;
    let isNew = false;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({ email, password: ROLE_TEST_PASSWORD, emailVerified: true });
      isNew = true;
    }

    const docData = { role, email };
    if (role === "intern" && internWeeksAgo !== null) {
      docData.joinedAt = new Date(Date.now() - internWeeksAgo * 7 * 24 * 60 * 60 * 1000);
    } else if (isNew) {
      docData.joinedAt = new Date();
    }

    await db.collection("users").doc(user.uid).set(docData, { merge: true });
    console.log(`${role.padEnd(7)} ${email}${docData.joinedAt ? " (joinedAt 갱신됨)" : ""}`);
  }

  console.log(`\n완료. 3개 계정 모두 비밀번호: ${ROLE_TEST_PASSWORD}`);
  console.log("브라우저에서 이 계정들로 로그인하면 역할별로 다른 화면(신입 뷰 / 매니저 뷰 / 인사팀 뷰)이 나옵니다.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
