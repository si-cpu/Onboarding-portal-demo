import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useAuth } from "./hooks/useAuth";
import AppRoutes from "./router";
import Logo from "./components/Logo";

const NAV_BY_ROLE = {
  intern: [
    { to: "/intern/values", label: "핵심가치 둘러보기" },
    { to: "/intern/missions", label: "미션" },
    { to: "/intern/feedback", label: "피드백 히스토리" },
    { to: "/intern/timeline", label: "내 타임라인" },
    { to: "/intern/help", label: "도움 요청" },
  ],
  hr: [
    { to: "/hr", label: "인사팀 뷰" },
    { to: "/hr/assignments", label: "매니저 배정" },
    { to: "/hr/help-requests", label: "소통 요청함" },
  ],
  manager: [{ to: "/manager", label: "매니저 뷰" }],
};

export default function App() {
  const { user, role } = useAuth();
  const location = useLocation();

  const showNav = user && location.pathname !== "/login";
  const navItems = NAV_BY_ROLE[role] ?? [];

  return (
    <div className="page">
      {showNav && (
        <div className="app-header">
          <div className="app-header-top">
            <Link to="/" className="app-logo-link" aria-label="홈으로 이동">
              <Logo />
            </Link>
            <button className="tab tab-logout" onClick={() => signOut(auth)}>
              로그아웃
            </button>
          </div>
          <div className="tabs">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`tab ${location.pathname === item.to ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <AppRoutes />
    </div>
  );
}
