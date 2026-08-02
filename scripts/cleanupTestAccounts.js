// QA/부하테스트 스크립트(runLoadTest.js, qaScores.js, walkDemoTimeline.js --tag)가
// 실행할 때마다 만든 더미 계정이 HR 대시보드의 "미션별 점수" 목록에 실제 인턴처럼
// 그대로 섞여 나온다 — DashboardPage.jsx가 role=="intern"인 users 전부를 보여주기
// 때문이다. 실사용 전에 이 더미 데이터를 정리해야 한다.
//
// 지운다(Firebase Auth 계정 + Firestore users/{uid} + 그 uid의 responses +
// manager_feedback(internId 기준) 문서 전부): 아래 패턴에 매칭되는 이메일
//   - loadtest-intern-*
//   - qa-mission-*
//   - demo-timeline-*  (재테스트용 태그 붙은 것만 — demo-timeline@test.local 본체는
//     "-"로 시작하는 패턴에 안 걸려서 자동으로 보존됨)
//
// 보존한다(위 패턴에 안 걸림):
//   - intern@test.local, manager@test.local, hr@test.local (역할 데모 계정)
//   - demo-timeline@test.local (발표용 고정 데모 계정)
//
// 실행: node --env-file=.env.local scripts/cleanupTestAccounts.js         (미리보기만, 삭제 안 함)
//       node --env-file=.env.local scripts/cleanupTestAccounts.js --yes   (실제 삭제)

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "./_adminApp.js";

const DRY_RUN = !process.argv.includes("--yes");

const TEST_EMAIL_PATTERNS = [/^loadtest-intern-/, /^qa-mission-/, /^demo-timeline-/];

function isTestAccount(email) {
  return TEST_EMAIL_PATTERNS.some((re) => re.test(email ?? ""));
}

async function main() {
  const app = ensureAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const usersSnap = await db.collection("users").get();
  const targets = usersSnap.docs.filter((d) => isTestAccount(d.data().email));

  console.log(`전체 users 문서: ${usersSnap.size}개 / 삭제 대상(테스트 계정): ${targets.length}개`);

  if (DRY_RUN) {
    console.log("\n--- 미리보기 (아직 아무것도 안 지웠습니다) ---");
    targets.slice(0, 30).forEach((d) => console.log(`  - ${d.data().email}`));
    if (targets.length > 30) console.log(`  ... 외 ${targets.length - 30}개`);
    console.log(
      `\n보존되는 계정(패턴에 안 걸림): intern@test.local, manager@test.local, hr@test.local, demo-timeline@test.local`
    );
    console.log("\n실제로 지우려면: node --env-file=.env.local scripts/cleanupTestAccounts.js --yes");
    return;
  }

  let deletedUsers = 0;
  let deletedResponses = 0;
  let deletedFeedback = 0;
  let authDeleteFailures = 0;

  for (const userDoc of targets) {
    const uid = userDoc.id;
    const email = userDoc.data().email;

    const [responsesSnap, feedbackSnap] = await Promise.all([
      db.collection("responses").where("userId", "==", uid).get(),
      db.collection("manager_feedback").where("internId", "==", uid).get(),
    ]);

    const batch = db.batch();
    responsesSnap.forEach((d) => batch.delete(d.ref));
    feedbackSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(userDoc.ref);
    await batch.commit();

    deletedResponses += responsesSnap.size;
    deletedFeedback += feedbackSnap.size;

    try {
      await auth.deleteUser(uid);
      deletedUsers++;
    } catch (e) {
      authDeleteFailures++;
      console.warn(`  ⚠️ Auth 계정 삭제 실패 (${email}): ${e.message}`);
    }

    process.stdout.write(`\r진행: ${deletedUsers + authDeleteFailures}/${targets.length}`);
  }

  console.log(
    `\n\n완료: Auth 계정 삭제 ${deletedUsers}개(실패 ${authDeleteFailures}개), responses ${deletedResponses}건, manager_feedback ${deletedFeedback}건 삭제`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
