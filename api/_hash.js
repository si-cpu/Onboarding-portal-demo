// src/lib/hash.js와 동일한 알고리즘(SHA-256 hex)의 서버 측(Node crypto) 구현.
// 클라이언트가 보낸 해시를 신뢰하지 않고 서버가 answerText로부터 직접 재계산한다.

import { createHash } from "node:crypto";

export function hashAnswer(text) {
  return createHash("sha256").update(text.trim()).digest("hex");
}
