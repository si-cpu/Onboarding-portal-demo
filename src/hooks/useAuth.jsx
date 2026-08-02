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
    // React.StrictMode(main.jsx)는 개발 모드에서 이 effect를 "마운트 → 클린업 →
    // 재마운트"로 일부러 두 번 실행한다. 클린업으로 구독을 끊어도 그 안에서 이미
    // 시작된 비동기 프로필 조회는 계속 실행되다가 나중에 끝나면서 상태를 다시
    // 덮어쓸 수 있다 — 이 effect의 "이번 실행"이 이미 정리됐으면 그 뒤에 도착하는
    // 비동기 결과는 전부 무시하도록 막는다(표준적인 stale-effect 가드).
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      // 로그인/로그아웃으로 auth 상태가 바뀔 때마다 다시 loading을 true로
      // 돌려야 한다 — 이게 없으면 로그인 직후 user는 이미 갱신됐는데 role은
      // 아직 Firestore에서 못 불러온 그 짧은 순간에, RoleHome 같은 라우트가
      // "role 없음"으로 오판해서 로그인 화면으로 되돌려보낼 수 있다(로그인
      // 버튼을 눌러도 화면이 안 넘어가고 새로고침해야만 되는 것처럼 보이는
      // 증상의 원인). loading은 최초 1번만 false가 되고 그 뒤로 다시 true로
      // 안 돌아가던 게 버그였다.
      setLoading(true);
      setUser(nextUser);
      if (nextUser) {
        // 프로필 조회가 실패해도(Firestore 규칙 미배포 등) loading이 영원히
        // true로 남아있으면 안 되므로 반드시 잡아준다.
        try {
          const profile = await getCurrentUserProfile();
          if (!active) return;
          setRole(profile.role);
          setJoinedAt(profile.joinedAt);
        } catch (e) {
          if (!active) return;
          console.error("프로필 조회 실패:", e.message);
          setRole(null);
          setJoinedAt(null);
        }
      } else {
        setRole(null);
        setJoinedAt(null);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
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
