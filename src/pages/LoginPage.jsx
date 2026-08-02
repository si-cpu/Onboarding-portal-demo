import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // useAuth()의 onAuthStateChanged 리스너가 결국 user를 갱신해서 LoginRoute가
      // 알아서 리다이렉트하긴 하지만, 그 반영 타이밍에 따라 로그인 버튼을 눌러도
      // 화면이 로그인 폼에 그대로 멈춰있는 것처럼 보일 수 있었다(새로고침해야
      // 넘어가는 것처럼 보이는 증상). 로그인 성공 직후 명시적으로 이동시켜서
      // 그 타이밍에 기대지 않게 한다.
      navigate("/", { replace: true });
    } catch (e) {
      setError("로그인 실패: 이메일/비밀번호를 확인해 주세요.");
    }
    setLoading(false);
  }

  return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card">
        <div className="label">온보딩 포털 로그인</div>
        <input
          className="input"
          style={{ marginBottom: 8 }}
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
