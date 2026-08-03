# 온보딩 포털 프로토타입 (인터엑스 AX 채용 오디션)

## 스택
- Frontend: React (Vite) → Vercel 배포
- Backend: Vercel Serverless Functions (`/api`)
- DB/Auth: Firebase (Firestore + Auth)
- AI 채점: Anthropic Claude API (`claude-sonnet-4-6`)

## PC에서 시작하는 순서

1. **Node.js 설치 확인** (`node -v`, 18 이상 권장)
2. 이 폴더에서 `npm install`
3. **Firebase 프로젝트 생성**
   - console.firebase.google.com → 프로젝트 추가
   - Authentication → 이메일/비밀번호 활성화
   - Firestore Database → 테스트 모드로 생성 (이후 `firestore.rules` 적용)
   - 웹 앱 추가 → 설정값을 `.env.local`에 복사 (`VITE_FIREBASE_*`)
4. **Anthropic API 키 발급**
   - console.anthropic.com → API Keys
   - `.env.local`의 `ANTHROPIC_API_KEY`에 넣기 (⚠️ VITE_ 접두어 붙이면 안 됨 — 브라우저에 노출됨)
5. **Firebase Admin 서비스 계정 발급** (서버리스 함수가 idToken 검증 + Firestore 쓰기에 사용)
   - 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → JSON 다운로드
   - `project_id`/`client_email`/`private_key`를 `.env.local`의 `FIREBASE_*` 값에 복사
     (`private_key`는 JSON에 있는 `\n` 이스케이프 그대로 붙여넣으면 코드에서 복원한다)
   - ⚠️ 다운로드한 JSON 파일 자체는 프로젝트 폴더 밖에 두거나 값 복사 후 바로 삭제할 것
6. `firebase deploy --only firestore:rules,firestore:indexes` 로 보안규칙 + 색인 적용
   (firebase-tools 설치 필요: `npm install -g firebase-tools` → `firebase login`)
7. **테스트 계정 생성**: `npm run seed:role-accounts` — `intern@test.local` / `manager@test.local` /
   `hr@test.local` 3개 계정을 role까지 세팅해서 자동 생성 (비밀번호는 스크립트 출력 참고)
   ⚠️ 생성 직후엔 신입-매니저 배정이 안 돼 있어 매니저 화면에 신입이 안 보인다 — `hr@test.local`로
   로그인 후 `/hr/assignments`에서 `intern@test.local`을 `manager@test.local`에게 배정할 것
8. **`missions` 컬렉션 시딩**: `npm run seed:missions` — `api/missionBank.js`의 26개 미션을
   `id`/`type`/`question`만 공개 컬렉션에 자동으로 넣는다 (mapped 값은 절대 여기 안 들어감 — 미션 블라인드 원칙)
9. **로컬 실행**: `npm run dev`(프론트만) 또는 `npm run dev:api`(Vercel dev 포함, `/api/*` 필요할 때는 반드시
   이걸로 — `vite`만으로는 서버리스 함수가 안 뜬다. 최초 1회는 `vercel link`로 프로젝트 연결 필요)
10. GitHub 저장소 push → Vercel에서 저장소 import → 자동 배포
    - Vercel 프로젝트 설정 > Environment Variables 에 `.env.local`의 모든 값 동일하게 등록

## 구현 현황

- ✅ 인증/역할 3분기(intern/manager/hr), 로그인 후 자동 리다이렉트, Context 기반 상태 공유(중복 조회 없음)
- ✅ **26주(6개월) 순차 미션 플로우** — 매주 서로 다른 질문 1개, `joinedAt` 기준 실제 달력 주차(월요일 오픈·
  일요일 마감)로 게이팅, 5분 주기로 재계산(탭 오래 열어놔도 반영)
- ✅ 제출 확인 모달(예/아니오), 빈 답변·500자 초과 방어, 제출 완료 배너
- ✅ Claude 채점 + 점수대별 앵커 예시(일관성 보강) + 해시 기반 캐시(재현성) + round 계산 트랜잭션화(동시
  제출 레이스 방지)
- ✅ 점수 비공개 원칙을 API 레이어에서 강제(`/api/score`, `/api/checkCache`는 scores를 절대 응답에 안 담음),
  신입 전용 API에 role 서버 검증 추가(매니저/HR 계정으로 호출 불가)
- ✅ 넛지 생성(최근 응답 대비 상대적 약점을 가치명 노출 없이 문장화)
- ✅ **3개월(13주)/6개월(26주) 종합 해석** — 신입: 그동안 답변을 모은 AI 성장 서사(점수/가치명 비공개,
  캐싱). 인사팀: 같은 서사 + 주차별 점수 추이 그래프 + 약점 분야 순위 + 미제출 주차 목록 + 면담 결과 기록
  (신입에게는 비공개, `interviews` 컬렉션)
- ✅ HR 대시보드(N+1 쿼리 없이 2번으로 고정, `hr_comment`만 수정 가능, 서술형/관찰형 점수를
  신뢰도 그룹별로 분리 표시) / 매니저 비공개 피드백(신입 read 불가)
- ✅ **HR 신입-매니저 배정 화면**(`/hr/assignments`, `users.managerId`) — 매니저는 본인에게
  배정된 신입만 보고 관찰을 남길 수 있음(`firestore.rules`도 배정 관계로 스코핑)
- ✅ 주차 계산(`getCurrentWeek`)을 실행 환경 타임존과 무관하게 KST 고정 오프셋으로 계산 —
  서버(Vercel, 기본 UTC)와 클라이언트(브라우저, KST)가 월요일 경계에서 다른 주차를
  계산하던 문제 해소
- ✅ `/api/score` 동시 제출 레이스 완전 차단(트랜잭션 내부에서 중복제출 재검증) — 같은 계정으로
  동시에 다른 답변 2건을 쏴서 하나만 성공하는 것까지 실측 검증 완료
- ✅ 루브릭 앵커에 중간대(50~65점대) 추가 — 고점/저점 앵커만 있어 실제 답변이 몰리는 중간대가
  비어있던 문제 보강, `qa:scores`로 26개 미션 재검증(25/26 PASS)
- ✅ `/api/score` JSON 파싱이 `feedback_text` 안 인용부호에 깨지던 버그 수정(`comprehensiveReview.js`/
  `growthNarrative.js`와 같은 원인 — `scores`는 JSON, `feedback_text`는 마커로 분리한 자유 텍스트)
- ✅ 점수 해상도 경고(`ScoreCaveat`) — HR 대시보드/응답 상세에 "근소한 점수 차이는 실제 우열이
  아니라 채점 해상도 한계"라는 안내를 상시 노출
- ✅ 구조화 로그(`log`/`alert` 분리, requestId로 한 요청 추적)
- ✅ 시딩·부하테스트·QA 스크립트(`scripts/`) — 더미 계정/미션, 품질별 코퍼스, 동시 배치 호출, 앵커 검증
  (⚠️ 실행할 때마다 실제 Firebase 계정이 쌓이므로, 끝나면 `npm run cleanup:test-accounts -- --yes`로
  정리할 것 — 안 하면 HR 대시보드가 더미 계정으로 뒤덮인다)
- ⚠️ 모델 교체는 검토만 하고 보류 — 여전히 Claude(`claude-sonnet-4-6`) 사용 (의도적 결정)
- ⚠️ `TimelineView`의 "같은 미션 2회 이상 → 성장 서사" 기능은 26개가 전부 다른 질문이라 정상 흐름에서는
  트리거 안 됨(죽은 경로, 버그 아님) — 3/6개월 종합 해석이 그 역할을 대신함
- ⚠️ 실제 프로덕션 배포(Vercel prod)·20명 규모 실제 부하테스트는 아직 미실행(로컬 검증까지만 완료)

## ⚠️ 알아두어야 할 구조적 한계

- **Firestore 보안규칙은 필드 단위 제한이 불가능하다.** `responses` 문서를 read하면 scores 필드까지
  같이 내려온다. 예전엔 "신입 본인 문서는 read 허용, 프론트가 안 쓸 뿐"이었는데, 이건 devtools로
  누구나 우회할 수 있는 가짜 통제였다(외부 리뷰로 발견). 지금은 `firestore.rules`가 `responses`의
  client SDK `create`/`read` 자체를 신입에게 전부 막는다 — 생성은 Admin SDK(`api/score.js`)만,
  조회는 반드시 `/api` 서버리스 함수(checkCache 등)만 가능하다.
- **AI 채점(`temperature: 0`)은 재현성을 최대한 확보했지만 100% 결정적이지 않을 수 있다.**
  실제 재현성은 답변 해시 기반 캐시(동일 답변 → 저장된 결과 재사용)로 보장한다.
- React 에러 바운더리, API 요청 빈도 제한(rate limit), 계정 셀프서비스(비밀번호 재설정 등)는 범위 밖 —
  계정은 관리자 스크립트로만 생성.
