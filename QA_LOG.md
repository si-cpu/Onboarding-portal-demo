# QA 로그 — 리스크9 패치 이후 검증 (2026-08-02)

이 문서는 `CHARTER.md` 리스크9(주차 게이팅 부재) 패치 이후, 실제로 로컬/Mac
환경(Dispatch)에서 `loadtest`·`qa:scores`·`gen:dummy-corpus`를 돌려가며 발견하고
고친 문제들을 시간 순으로 정리한다. 목적은 두 가지: (1) 다음에 같은 종류의 실행을
할 때 같은 함정에 또 빠지지 않게 하는 것, (2) 발표에서 "재현성·신뢰성을 실제로
검증했는가"를 물으면 근거로 보여줄 기록.

## 배경

`api/score.js`에 서버 사이드 주차 게이팅(`missionId === currentWeek(joinedAt)`)과
재제출 차단(같은 계정+같은 미션 재제출 시 409)을 추가하면서(커밋 `98c540d`),
이 두 가드에 의존하던 여러 스크립트가 연쇄적으로 깨졌다. 아래는 그 연쇄를
발견-진단-수정 순서 그대로 기록한 것이다.

## 타임라인

| # | 증상 | 근본 원인 | 수정 | 커밋 |
|---|---|---|---|---|
| 1 | `runLoadTest.js`가 계정 하나로 여러 라운드를 몰아 제출하던 방식이 게이팅 도입 후 라운드 2부터 전부 403 | 계정 하나가 여러 주차를 동시에 대표할 수 없음(주차는 `joinedAt` 하나로 고정) | (유저,라운드) 조합마다 별도 계정 + `joinedAt`을 라운드만큼 백데이트. `seedTestUsers.js`/`runLoadTest.js`/`qaScores.js` 동시 수정 | `1011a0d` |
| 2 | `qa:scores` 실행 시 Firestore "인덱스 없음" 에러로 중간에 멈춤 | `qaScores.js`가 새로 쓰게 된 `where(userId==).where(missionId==).orderBy(round,"desc")` 쿼리에 맞는 복합 인덱스가 `firestore.indexes.json`에 없었음(`round ASC` 버전만 있었음) | 복합 인덱스 정의 추가 (`firebase deploy --only firestore:indexes`로 배포) | `62dc2f2` |
| 3 | 인덱스 배포 후 재실행하니 미션 #1·#2의 `high`까지 409로 막힘 | `qa-mission-{missionId}@test.local` 계정 하나로 high/medium/low 3개 품질을 연달아 제출 → 첫 제출(high) 이후 같은 계정+같은 missionId 재제출은 리스크9의 409 가드에 막힘. `salt`는 answerHash 캐시만 우회할 뿐 이 가드는 못 피함 | 계정을 missionId뿐 아니라 quality별로도 분리 (`qa-mission-{missionId}-{quality}@test.local`), 각 계정이 정확히 1회만 제출 | `825615f` |
| 4 | 계정 분리 후 78건 전부 정상 채점, 25/26 PASS, **미션 #21만 3개 품질 전부 0점** | `generateDummyCorpus.js`가 `temperature:1`로 다양성을 주다 보니 드물게 `answerText`가 빈 문자열로 나오는 확률적 글리치가 있었는데, JSON 파싱 자체는 성공하니 검증 없이 그대로 `dummyCorpus.json`에 저장됨. 빈 답변을 채점하면 당연히 0점 → 루브릭 문제처럼 보였지만 실은 코퍼스 데이터 결함 | `generateForMission`에 답변 길이/빈 문자열 검증 + 최대 3회 재시도 가드 추가. `node scripts/generateDummyCorpus.js 21`처럼 특정 missionId만 저비용 재생성할 수 있게 CLI 인자 추가 | `efaca00` |
| 5 | #21 코퍼스 재생성 후 재확인차 `qa:scores`를 다시 돌렸더니 76/78건이 409 에러, 그런데 최종 판정은 **"✅ 모든 미션 순서 유지됨"** | 이중 결함: (a) 같은 주 안에 `qa:scores`를 두 번째 돌리면 직전 실행에서 쓴 계정들이 이미 "이번 주 제출 완료" 상태라 리스크9 가드에 또 막힘. (b) 판정 로직이 `high`/`low` avg가 null(에러 포함)이면 순서 비교 자체를 스킵 → 에러난 미션이 "검사 대상 없음"으로 조용히 빠지면서 `failCount=0`이 되는 **가짜 초록불** | 계정 이메일에 실행마다 고유한 `runId`(`Date.now()`)를 붙여 재실행 충돌을 원천 차단. 판정 로직을 에러=스킵이 아니라 `errorMissionCount`로 명시 집계하도록 변경, 문제가 있으면 `process.exitCode=1` | `b773a6c` |

## 지금까지 확인된 것 / 아직 확인 안 된 것

**확인됨:**
- 리스크9 패치(`score.js` 주차 게이팅 + 재제출 차단)는 의도대로 동작 — `runLoadTest.js` 160/160 성공으로 검증
- 계정 분리 + 인덱스 추가 후 `qa:scores`가 78건 전부 실제로 채점됨(에러로 숨겨지지 않고) — 25/26 미션에서 루브릭이 high>low/evasive 순서를 명확히 지킴(예: 72 vs 22, 87 vs 20, 85 vs 15)

**아직 확인 안 됨 (다음 실행에서 봐야 함):**
- 위 표의 #4·#5 수정(코퍼스 재시도 가드 + qa 재실행 멱등성)이 **동시에 적용된 상태로 돌린 깨끗한 78/78 결과**는 아직 없음. 미션 #21이 실제로 high>low를 지키는지는 이 다음 실행에서 확정된다.
  - 만약 이번에도 #21에서 순서가 역전되면: 이건 더 이상 코퍼스/인프라 문제로 설명 안 되고, `api/score.js`의 `RUBRIC_FACTUAL` 앵커 자체를 봐야 하는 **제품 결함**으로 취급한다(QA 스크립트 버그로 치부하고 넘어가지 않는다).

## 남아있는 알려진 한계 (지금 당장 안 고침, 인지만 해둠)

- `runLoadTest.js`는 qaScores.js와 같은 재실행 충돌 가능성이 구조적으로 남아있다(같은 주에 두 번째로 돌리면 409). 다만 실패를 숨기지 않고 `실패: N건`으로 그대로 보여주므로 "가짜 초록불" 위험은 없다 — 필요해지면 같은 `runId` 방식으로 고친다.
- 이 QA용 계정들(`qa-mission-*`, `loadtest-intern-*`, `demo-timeline@test.local`)은 정리(삭제) 스크립트가 없어 실행할수록 Firebase Auth에 계정이 누적된다. 프로토타입 규모에서는 무해하지만, 정리가 필요해지면 별도로 처리한다.

## 다음 액션

1. `git pull` 후 `npm run qa:scores` 한 번 더 깨끗하게 실행 (재시딩/삭제 불필요, 매번 새 계정 사용)
2. 결과에서 78/78 전부 실제로 채점됐는지(에러 0건), 26개 미션 전부 high>low/evasive 순서가 지켜지는지 확인
3. #21이 여전히 실패하면 `api/score.js`의 `RUBRIC_FACTUAL` 앵커 예시를 다시 본다
4. 여기서 결론 나면 QA 트랙은 닫고, `CHARTER.md` 리스크1의 남은 항목(Vercel 프로덕션 배포)으로 넘어간다
