# 온보딩 포털 프로토타입 (인터엑스 AX 채용 오디션)

## 스택
- Frontend: React (Vite) → Vercel 배포
- Backend: Vercel Serverless Functions (`/api`)
- DB/Auth: Firebase (Firestore + Auth)
- AI 채점: Anthropic Claude API

## PC에서 시작하는 순서

1. **Node.js 설치 확인** (`node -v`, 18 이상 권장)
2. 이 폴더에서 `npm install`
3. **Firebase 프로젝트 생성**
   - console.firebase.google.com → 프로젝트 추가
   - Authentication → 이메일/비밀번호 활성화
   - Firestore Database → 테스트 모드로 생성 (이후 `firestore.rules` 적용)
   - 웹 앱 추가 → 설정값을 `.env.local`에 복사 (`.env.local.example` 참고)
4. **Anthropic API 키 발급**
   - console.anthropic.com → API Keys
   - `.env.local`의 `ANTHROPIC_API_KEY`에 넣기 (⚠️ VITE_ 접두어 붙이면 안 됨 — 브라우저에 노출됨)
5. `firebase deploy --only firestore:rules` 로 보안규칙 적용
   (firebase-tools 설치 필요: `npm install -g firebase-tools` → `firebase login` → `firebase init`)
6. **Firebase Admin 서비스 계정 발급** (서버리스 함수가 idToken 검증 + Firestore 쓰기에 사용)
   - 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → JSON 다운로드
   - `project_id`/`client_email`/`private_key`를 `.env.local`의 `FIREBASE_*` 값에 복사
     (`private_key`는 JSON에 있는 `\n` 이스케이프 그대로 붙여넣으면 코드에서 복원한다)
7. 테스트 계정 3개 생성 (Firebase Auth 콘솔 또는 스크립트로):
   - intern@test.com / manager@test.com / hr@test.com
   - 각 계정의 `users/{uid}` 문서에 `role` 필드 수동 세팅 (intern/manager/hr), `email` 필드도 같이 넣으면
     HR/매니저 화면에 이메일이 표시된다
8. **`missions` 컬렉션 시딩** — 신입 화면은 이 컬렉션에서 공개 질문 목록을 읽는다(`src/lib/missionBank.js`).
   `api/missionBank.js`의 `getPublicMissionList()` 결과(id/type/question만, mapped 없음)를 Firestore 콘솔에서
   `missions/{id}` 문서로 하나씩 넣어준다 (mapped 값은 절대 이 컬렉션에 넣지 말 것 — 미션 블라인드 원칙).
9. `npm run dev` 로 로컬 확인 (Vercel dev 서버가 아니면 `/api/*` 서버리스 함수는 응답하지 않는다 —
   로컬에서 API까지 같이 확인하려면 `vercel dev`를 쓴다)
10. GitHub 저장소 생성 → push → Vercel에서 저장소 import → 자동 배포
    - Vercel 프로젝트 설정 > Environment Variables 에 `.env.local`의 모든 값 동일하게 등록
      (`FIREBASE_PRIVATE_KEY`는 줄바꿈이 포함되므로 Vercel의 멀티라인 입력을 사용하거나 `\n` 이스케이프 형태 그대로 등록)

## 구현 현황

- ✅ 인증/역할 분기(intern·manager·hr), 미션 제출 → Claude 채점 → 캐시(해시 기반 재현성) → Firestore 저장
- ✅ 점수 비공개 원칙을 API 레이어에서 강제(`/api/score`, `/api/checkCache`는 scores를 절대 응답에 담지 않음)
- ✅ 넛지 생성(`api/nudge.js`, 최근 응답 대비 상대적 약점을 가치명 노출 없이 문장화)
- ✅ 성장 서사(`/api/growthNarrative`, 서버가 Firestore에서 직접 라운드별 답변을 조회해 조작 불가)
- ✅ HR 대시보드(점수 열람, `hr_comment`만 수정 가능) / 매니저 비공개 피드백(신입 read 불가)
- ⚠️ 9개 미션 전부 동일한 루브릭 엔진으로 동작은 하지만, 실제 프레젠테이션에서는 README 원안대로
  일부(사실형 2~3개 + 정서형 1개)만 답변을 채워 시연하고 나머지는 "확장 가능한 구조"로 설명 추천
- ⚠️ `round`만 추적하고 "Week N" 라벨은 제출 시각(날짜)으로 대체함 — 온보딩 시작일 기반 주차 계산은
  범위 밖으로 남겨둠

## ⚠️ 알아두어야 할 구조적 한계

- **Firestore 보안규칙은 필드 단위 제한이 불가능하다.** `responses` 문서를 신입이 직접 read하면
  scores 필드까지 같이 내려온다. 따라서 신입용 화면은 반드시 Cloud Function(또는 `/api` 서버리스 함수)을
  경유해 `feedback_text`만 추출해서 내려주는 방식으로 구현해야 한다 — 프론트에서 Firestore SDK로
  직접 조회하지 말 것.
- **AI 채점(`temperature: 0`)은 재현성을 최대한 확보했지만 100% 결정적이지 않을 수 있다.**
  발표 시 "완벽한 재현성"이 아니라 "캐싱을 통한 사실상의 고정"으로 설명하는 것이 정직하다.
- 현재 스캐폴드는 프로토타입 시연 수준이며, 9개 질문 중 2~3개 사실형 + 1개 정서형 정도만
  실제로 작동하게 구현하고 나머지는 "확장 가능한 구조"로 발표에서 설명하는 것을 권장한다.
