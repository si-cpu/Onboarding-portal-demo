// 로드테스트용 가짜 인턴 계정을 Firebase Auth + Firestore users/{uid}에 생성한다.
// 이미 존재하는 이메일은 건너뛴다 (여러 번 실행해도 안전).
//
// api/score.js의 서버 사이드 주차 게이팅(리스크9 패치) 때문에, 계정 하나가 "이번 주"가
// 아닌 missionId를 제출하면 403을 받는다. 그래서 한 유저가 여러 라운드를 한 번에
// 흉내 내려면 유저 하나가 여러 주차에 동시에 걸쳐 있는 척할 수 없고, (유저, 라운드)
// 조합마다 별도 계정을 만들어 joinedAt을 그만큼 과거로 백데이트해서 "지금이 바로 그
// 계정의 r주차"가 되도록 해야 한다. 매 실행마다 joinedAt을 다시 계산해서 덮어쓰므로
// (멱등적), runLoadTest.js 실행 직전에 항상 다시 시딩해야 주차 계산이 어긋나지 않는다.
//
// 실행: node --env-file=.env.local scripts/seedTestUsers.js [인원수(기본 20)] [라운드수(기본 8)]

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "./_adminApp.js";

const COUNT = Number(process.argv[2] ?? 20);
const ROUNDS = Number(process.argv[3] ?? 8);
export const TEST_PASSWORD = "LoadTest1234!";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// r=1은 이번 주 갓 입사한 것처럼, r=N은 (N-1)주 전에 입사한 것처럼 joinedAt을 맞춘다.
export function emailFor(u, r = 1) {
  return `loadtest-intern-${u}-r${r}@test.local`;
}

async function main() {
  const app = ensureAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  let created = 0;
  let updated = 0;

  for (let u = 1; u <= COUNT; u++) {
    for (let r = 1; r <= ROUNDS; r++) {
      const email = emailFor(u, r);
      let user;
      let isNew = false;
      try {
        user = await auth.getUserByEmail(email);
      } catch {
        user = await auth.createUser({ email, password: TEST_PASSWORD, emailVerified: true });
        isNew = true;
      }
      if (isNew) created++;
      else updated++;

      // getCurrentWeek(joinedAt)이 정확히 r을 반환하도록 (r-1)주 전으로 백데이트한다.
      const joinedAt = new Date(Date.now() - (r - 1) * WEEK_MS);
      await db.collection("users").doc(user.uid).set({ role: "intern", email, joinedAt }, { merge: true });
    }
  }

  console.log(
    `완료: 신규 생성 ${created}개, joinedAt 갱신 ${updated}개 (총 ${COUNT * ROUNDS}개 계정, 비밀번호: ${TEST_PASSWORD})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
