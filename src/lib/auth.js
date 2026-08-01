import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

// users/{uid} 문서에서 role(intern/manager/hr)과 joinedAt(온보딩 시작일,
// 주차 게이팅에 사용)을 함께 읽는다.
export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return { role: null, joinedAt: null };

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return { role: null, joinedAt: null };

  const data = snap.data();
  return {
    role: data.role ?? null,
    joinedAt: data.joinedAt?.toDate?.() ?? (data.joinedAt ? new Date(data.joinedAt) : null),
  };
}
