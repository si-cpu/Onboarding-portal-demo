// 서버리스 함수 공통 로거.
// - log(): 평상시 흐름 추적용 (요청 수신, 캐시 히트, Claude 호출 시작/종료 등) — console.log
// - alert(): 바로 확인이 필요한 이상 신호용 (인증 실패, 파싱 실패, Firestore 오류 등) — console.error
// console.log/console.error로 갈라두면 Vercel 함수 로그에서 severity(Error)로
// 바로 필터링되고, 나중에 Slack/이메일 알림을 연동할 때도 alert() 호출부만 훅킹하면 된다.
// requestId로 한 요청 안의 로그 라인들을 서로 엮어서 추적할 수 있다.

import { randomUUID } from "node:crypto";

export function newRequestId() {
  return randomUUID().slice(0, 8);
}

function write(level, requestId, event, data) {
  const line = {
    ts: new Date().toISOString(),
    level,
    requestId,
    event,
    ...data,
  };
  if (level === "alert") {
    console.error(JSON.stringify(line));
  } else {
    console.log(JSON.stringify(line));
  }
}

export function log(requestId, event, data = {}) {
  write("info", requestId, event, data);
}

export function alert(requestId, event, data = {}) {
  write("alert", requestId, event, data);
}
