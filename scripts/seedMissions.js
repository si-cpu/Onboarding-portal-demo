// 신입 화면(MissionPage)이 읽는 Firestore `missions` 컬렉션을 채운다.
// api/missionBank.js의 getPublicMissionList()와 동일하게 id/type/question만 넣고
// mapped(핵심가치 매핑) 값은 절대 넣지 않는다 (미션 블라인드 원칙).
//
// 실행: node --env-file=.env.local scripts/seedMissions.js

import { getFirestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "./_adminApp.js";
import { getPublicMissionList } from "../api/missionBank.js";

async function main() {
  const app = ensureAdminApp();
  const db = getFirestore(app);

  const missions = getPublicMissionList();
  for (const mission of missions) {
    await db.collection("missions").doc(String(mission.id)).set(mission);
    console.log(`#${mission.id} (${mission.type}) ${mission.question}`);
  }

  console.log(`\n완료: missions 컬렉션에 ${missions.length}개 저장`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
