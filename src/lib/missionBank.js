import { db } from "./firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

// 프론트엔드는 공개 질문 텍스트만 담긴 Firestore 'missions' 컬렉션을 읽는다.
// mapped(핵심가치 매핑) 필드는 이 컬렉션에 애초에 저장하지 않는다 — 그건
// api/missionBank.js에만 존재하는 서버 전용 데이터다 (미션 블라인드 원칙).
export async function fetchPublicMissions() {
  const q = query(collection(db, "missions"), orderBy("id", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}
