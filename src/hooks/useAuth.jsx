import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { getCurrentUserProfile } from "../lib/auth";
import { getCurrentWeek } from "../lib/week";

// 로그인 상태 + role + joinedAt을 앱 전체에서 한 번만 구독한다. 예전에는 각 화면
// (App, RoleHome, RequireRole, LoginRoute...)이 useAuth()를 각자 호출해서
// onAuthStateChanged 구독과 users/{uid} Firestore 조회가 화면 수만큼 중복 발생했다.
const AuthContext = createContext(null);

const WEEK_RECHECK_MS = 5 * 60 * 1000; // 탭을 오래 열어둔 채로 주차 경계(월요일 자정)를 넘겨도 반영되도록 주기적으로 재계산

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = 아직 판별 전
  const [role, setRole] = useState(null);
  const [joinedAt, setJoinedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, forceRecheck] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        // 프로필 조회가 실패해도(Firestore 규칙 미배포 등) loading이 영원히
        // true로 남아있으면 안 되므로 반드시 잡아준다.
        try {
          const profile = await getCurrentUserProfile();
          setRole(profile.role);
          setJoinedAt(profile.joinedAt);
        } catch (e) {
          console.error("프로필 조회 실패:", e.message);
          setRole(null);
          setJoinedAt(null);
        }
      } else {
        setRole(null);
        setJoinedAt(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const id = setInterval(() => forceRecheck((n) => n + 1), WEEK_RECHECK_MS);
    return () => clearInterval(id);
  }, []);

  const value = {
    user: user ?? null,
    role,
    joinedAt,
    currentWeek: getCurrentWeek(joinedAt),
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth()는 <AuthProvider> 안에서만 쓸 수 있습니다.");
  return ctx;
}
