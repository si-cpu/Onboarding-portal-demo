import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/intern/HomePage";
import CoreValuesPage from "./pages/intern/CoreValuesPage";
import MissionPage from "./pages/intern/MissionPage";
import FeedbackPage from "./pages/intern/FeedbackPage";
import TimelinePage from "./pages/intern/TimelinePage";
import HelpPage from "./pages/intern/HelpPage";
import DashboardPage from "./pages/hr/DashboardPage";
import ResponseDetailPage from "./pages/hr/ResponseDetailPage";
import AssignmentsPage from "./pages/hr/AssignmentsPage";
import HelpRequestsPage from "./pages/hr/HelpRequestsPage";
import MetaFeedbackPage from "./pages/manager/MetaFeedbackPage";

const HOME_BY_ROLE = {
  intern: "/intern/home",
  manager: "/manager",
  hr: "/hr",
};

function RequireRole({ role, children }) {
  const { user, role: myRole, loading } = useAuth();
  if (loading) return <div className="muted">확인 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (myRole !== role) return <Navigate to={HOME_BY_ROLE[myRole] ?? "/login"} replace />;
  return children;
}

function RoleHome() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="muted">확인 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[role] ?? "/login"} replace />;
}

// /login에 그냥 <LoginPage/>만 두면, 로그인에 성공해서 auth 상태가 바뀌어도
// 이 라우트 자체는 아무도 리다이렉트를 트리거하지 않아 화면이 로그인 폼에
// 멈춰있게 된다. 로그인된 사용자가 /login에 머물러 있으면 홈으로 보낸다.
function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="muted">확인 중...</div>;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/" element={<RoleHome />} />

      <Route path="/intern/home" element={<RequireRole role="intern"><HomePage /></RequireRole>} />
      <Route path="/intern/values" element={<RequireRole role="intern"><CoreValuesPage /></RequireRole>} />
      <Route path="/intern/missions" element={<RequireRole role="intern"><MissionPage /></RequireRole>} />
      <Route path="/intern/feedback" element={<RequireRole role="intern"><FeedbackPage /></RequireRole>} />
      <Route path="/intern/timeline" element={<RequireRole role="intern"><TimelinePage /></RequireRole>} />
      <Route path="/intern/help" element={<RequireRole role="intern"><HelpPage /></RequireRole>} />

      <Route path="/hr" element={<RequireRole role="hr"><DashboardPage /></RequireRole>} />
      <Route
        path="/hr/responses/:internId"
        element={<RequireRole role="hr"><ResponseDetailPage /></RequireRole>}
      />
      <Route path="/hr/assignments" element={<RequireRole role="hr"><AssignmentsPage /></RequireRole>} />
      <Route path="/hr/help-requests" element={<RequireRole role="hr"><HelpRequestsPage /></RequireRole>} />

      <Route path="/manager" element={<RequireRole role="manager"><MetaFeedbackPage /></RequireRole>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
