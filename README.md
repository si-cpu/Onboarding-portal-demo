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
  캐싱). 인사팀: 같은 서사 + 가치별 평균·측정 횟수 + 미제출 주차 목록 + 면담 결과 기록
  (신입에게는 비공개, `interviews` 컬렉션). 예전엔 "주차별 평균 점수"를 하나의 선 그래프로 이었는데,
  매주 서로 다른 가치를 측정하는 구조라 그 평균선이 통계적으로 의미가 없었다(외부 리뷰로 발견 —
  예: 1주차 "끈기" 점수와 2주차 "목표의식" 점수를 이어서 성장선으로 읽을 수 없음). 그래프를 없애고
  가치별 평균·측정 횟수로 대체
- ✅ HR 대시보드(N+1 쿼리 없이 2번으로 고정, `hr_comment`만 수정 가능, 서술형/관찰형 점수를
  신뢰도 그룹별로 분리 표시) / 매니저 비공개 피드백(신입 read 불가)
- ✅ **매니저 관찰 체크인 6회(월 1회, 4·8·12·16·20·25주차)** — 예전엔 3/6개월 심사 직전
  2번뿐이었던 걸 CHARTER 문구("주1회 or 월1회")에 맞게 분리, 값별 "관찰 못 함" 체크박스로
  안 본 항목은 50점 기본값 없이 아예 기록 안 함. HR 비교 패널도 mid/final 이원화 대신
  지금까지 쌓인 체크인 전체를 누적 비교
- ✅ **HR 신입-매니저 배정 화면**(`/hr/assignments`, `users.managerId`) — 매니저는 본인에게
  배정된 신입만 보고 관찰을 남길 수 있음(`firestore.rules`도 배정 관계로 스코핑)
- ✅ 주차 계산(`getCurrentWeek`)을 실행 환경 타임존과 무관하게 KST 고정 오프셋으로 계산 —
  서버(Vercel, 기본 UTC)와 클라이언트(브라우저, KST)가 월요일 경계에서 다른 주차를
  계산하던 문제 해소
- ✅ `/api/score` 동시 제출 레이스 완전 차단(트랜잭션 내부에서 중복제출 재검증) — 같은 계정으로
  동시에 다른 답변 2건을 쏴서 하나만 성공하는 것까지 실측 검증 완료
- ✅ 루브릭 앵커에 중간대(50~65점대) 추가 — 고점/저점 앵커만 있어 실제 답변이 몰리는 중간대가
  비어있던 문제 보강. 이후 `feedback_text` 인용부호 파싱 버그(아래) 수정을 거쳐, 최신 `main`
  기준 `qa:scores` 최종 재검증 결과는 **26/26 PASS, 에러 0건**(과거 25/26·파싱 에러 1건은
  발견 당시 기록으로 `QA_LOG.md`에 남겨둠)
- ✅ `/api/score` JSON 파싱이 `feedback_text` 안 인용부호에 깨지던 버그 수정(`comprehensiveReview.js`/
  `growthNarrative.js`와 같은 원인 — `scores`는 JSON, `feedback_text`는 마커로 분리한 자유 텍스트)
- ✅ 점수 해상도 경고(`ScoreCaveat`) — HR 대시보드/응답 상세에 "근소한 점수 차이는 실제 우열이
  아니라 채점 해상도 한계"라는 안내를 상시 노출
- ✅ 구조화 로그(`log`/`alert` 분리, requestId로 한 요청 추적)
- ✅ 시딩·부하테스트·QA 스크립트(`scripts/`) — 더미 계정/미션, 품질별 코퍼스, 동시 배치 호출, 앵커 검증
  (⚠️ 실행할 때마다 실제 Firebase 계정이 쌓이므로, 끝나면 `npm run cleanup:test-accounts -- --yes`로
  정리할 것 — 안 하면 HR 대시보드가 더미 계정으로 뒤덮인다)
- ⚠️ 모델 교체는 검토만 하고 보류 — 여전히 Claude(`claude-sonnet-4-6`) 사용 (의도적 결정)
- ✅ **내 답변 타임라인(`/intern/timeline`) 26주차 실제 잠금** — 예전엔 표기만 "6개월 후 공개"였고
  실제 게이팅이 없어서 1주차부터 접근 가능했다(외부 리뷰로 발견). `currentWeek`로 실제 잠금을
  강제하고, 잠금 해제 후엔 주차별 본인 답변·피드백·넛지 + 6개월 종합 서사를 함께 보여준다.
  "같은 미션 2회 이상 → 성장 서사" 죽은 코드(`growthNarrative.js`)는 제거.
- ✅ `/api/score` + `/api/comprehensiveReview` 프롬프트 인젝션 방어 — 채점/종합서사 규칙(system)과
  신입 답변(user, `<untrusted_answer>`로 격리 + `<`/`>`/`&` 이스케이프로 태그 조기 종료 공격 차단)을
  분리하고, 출력에 핵심가치명·"N점" 패턴이 새어나오면 재생성 후 안전 문구로 대체하는 검증도 추가
  (`api/_leakCheck.js` 공유 헬퍼). 공격형 QA 스크립트(`npm run qa:injection`)로 점수조작 유도·가짜
  SYSTEM 메시지·시스템 프롬프트 탈취·태그 조기 종료 등 최신 `main` 기준 **9/9건 전부 실측 PASS**
  (조작·유출 0건)
- ✅ HR 응답 상세의 AI-팀장 괴리 플래그(임계값 20)를 방향별로 다른 문구로 분리 — AI가 높으면
  "자기서술 포장 가능성", 팀장이 높으면 "AI 과소평가 또는 답변 근거 부족 가능성"(예전엔
  `Math.abs(gap)`만 보고 방향 무관하게 같은 문구를 붙였음)
- ✅ **최종 통합 QA (main `47ebf2d` 기준)** — `npm run build`(성공) → `npm run qa:scores`
  (26/26 PASS, 에러 0건) → `npm run qa:injection`(score.js 6건 + comprehensiveReview.js 3건 =
  9/9 PASS) → `npm run cleanup:test-accounts -- --yes`(테스트 계정 78개 정리)까지 한 번에
  순서대로 실제 실행해서 확인. 이전까지 나뉘어 있던 26/26·25/26·6/6 등의 개별 실행 기록은
  발견 과정으로 `QA_LOG.md`에 남겨두고, 이 항목을 최신 `main` 전체의 대표 수치로 삼는다.
- ✅ **실제 Vercel 프로덕션 배포 완료** — 라이브 URL: https://onboarding-portal-e2c22.vercel.app . 배포 직후 `/login`·`/intern/values` 등 SPA 클라이언트 라우트가 전부 404 나는 걸 발견했다(로컬은 `vite`/`vercel dev`가 history fallback을 자동으로 해줘서 안 드러났던 구멍) — `vercel.json`에 `/api/*`를 제외한 나머지 경로를 `index.html`로 돌리는 `rewrites` 규칙을 추가해 해소. 이후 Playwright로 라이브 URL 기준 로그인 → 신입 뷰(과거 제출 데이터·AI 피드백 정상 표시) → 핵심가치 화면까지 실제 왕복 확인, 콘솔 에러 0건.
- ✅ **20명 규모 실부하테스트, 프로덕션 기준 완료** — `BASE_URL`을 라이브 URL로 지정해 `npm run loadtest` 재실행(20명 × 8라운드 = 160건, 동시 10개씩). **160/160 성공, 실패 0건**, 평균 응답 11.6초, 전부 캐시 아닌 실제 Claude 채점. 테스트 계정 160개는 `cleanup:test-accounts`로 정리 완료.
- ✅ **신입 홈 화면(`/intern/home`) 신설, 로그인 후 기본 진입점 변경** — 예전엔 로그인하면 바로 `/intern/missions`(제출/채점 화면)로 떨어져서 첫인상이 온보딩보다 평가 시스템에 가까웠다(외부 피드백으로 지적). 이번 주 미션 상태·최근 AI 피드백·오늘의 핵심가치·다음 체크인 안내를 모은 홈으로 교체(새 데이터 없이 기존 API 재사용).
- ✅ **신입 → HR 소통 요청 채널(`/intern/help` + `/hr/help-requests`)** — 리스크8("인사팀과의 유기적 소통" 미충족)을 최소 범위로 해소. 컨디션 상태 트래킹은 의도적으로 넣지 않고 순수 자유서술 요청/질문만 받는 채널로 한정해, 평가 파이프라인·정보 잠금 원칙과 섞이지 않게 했다. HR은 `responses.hr_comment`와 같은 패턴(client SDK 직접 update)으로 앱 안에서 답장. `help_requests` 컬렉션 신설(`firestore.rules`/`firestore.indexes.json` 갱신, `firebase deploy` 완료). Playwright로 신입 제출 → HR 답장 → 신입 확인까지 로컬+프로덕션 양쪽 왕복 확인, 콘솔 에러 0건.
- ✅ **신입 화면에 본인 답변 표시(`AnswerCard`)** — `/api/checkCache`는 이미 `answerText`를 내려주고 있었는데 `MissionPage`(과거 주차)·`FeedbackPage`(피드백 히스토리)는 질문+AI 피드백만 보여주고 본인 답변은 6개월 뒤 타임라인에서만 다시 볼 수 있었다. AI 피드백 바로 위에 "내 답변"을 표시하도록 두 화면 모두 수정.
- ✅ **nav 헤더 레이아웃 정리** — 로고+탭+로그아웃이 한 줄에 섞여 있어 탭이 늘어나며 줄바꿈이 지저분해지던 문제 해소. 헤더를 2단(위: 로고+로그아웃, 아래: 나비게이션 탭)으로 분리하고 로고를 `/`로 이동하는 홈 링크로 변경 — intern nav의 중복 "홈" 탭 제거로 탭 5개가 한 줄에 정렬됨. "신입 뷰" 탭 라벨도 "미션"으로 변경.
- ✅ **HR 대시보드 미답변 요청 요약 패널** — `help_requests`에서 `status == "open"` 개수 + 최근 3건 미리보기 + 요청함 이동 버튼을 대시보드 상단에 추가(미답변 0건이면 패널 자체가 안 보임). 새 API 없이 기존 쿼리 하나(`status`+`createdAt` 복합 색인)만 추가.

## 발표 자료

- `deck/InterX_온보딩포털_발표.pdf` — 16장 발표 PPT (`deck/deck.html`이 원본, Playwright `page.pdf()`로 렌더링)
- `deck/output/InterX_온보딩포털_시연영상.mp4` — 백업 시연 영상(60초, H.264, 실사용자 녹화를 crop+2.6배속으로 편집)
- `npm run demo:walkthrough`(`scripts/walkDemoTimeline.js`) — 발표·심사용 고정 데모 계정(`demo-timeline@test.local` / `DemoTimeline1234!`)을 만들어 26주 전체를 실제 `/api/score` 호출로 채우고 13/26주차 종합 해석까지 미리 생성해둔다. 로그인하면 3/6개월 성장 서사를 바로 볼 수 있음(주차 게이팅 우회 없이, `joinedAt`을 실제로 백데이트).

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
