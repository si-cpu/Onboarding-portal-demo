import { auth } from "./firebase";

// /api/* 서버리스 함수 호출 공통 헬퍼. 항상 현재 로그인된 사용자의 idToken을
// Authorization 헤더에 실어 보낸다 (서버가 uid를 토큰에서 뽑아 쓰도록).
export async function callApi(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  const idToken = await user.getIdToken();

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data;
}
