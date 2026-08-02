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
| 6 | `runId` 픽스 이후 실제로 78/78 전부 에러 0건, 최종 "✅ 모든 미션 순서 유지됨" — 그런데 자세히 보니 **미션 #19는 evasive 1개만 채점되고 high/medium 자체가 없었음(판정 줄도 없이 조용히 통과 취급)**, **미션 #23은 high(17) < medium(49)로 순서가 뒤집혔는데 high(17)>low(15)만 봐서 "PASS"로 잘못 표시** | (a) `generateForMission`이 응답 배열의 "개수"·"품질 태그 존재 여부"는 검증 안 하고 "있는 항목의 텍스트 길이"만 검증해서, 품질 항목이 통째로 빠진 응답(#19)을 못 잡았음. (b) `qaScores.js` 판정 로직이 high vs low만 비교하고 medium을 안 봐서, high<medium인 완전히 뒤집힌 케이스(#23)를 "PASS"로 오판 | `generateForMission`에 배열 길이(`levels.length`)·품질 태그 누락 검증 추가. `qaScores.js` 판정을 "품질 항목 3개 다 있는지 확인(없으면 에러로 집계)" + "high>medium>low/evasive 전부 확인"으로 강화 | `20ecdf8` |

## 실제 QA 실행 기록 (Mac/Dispatch에서 돌린 `qa:scores` 결과)

버그를 고치고 나서 실제로 돌려본 것과, 코드만 고쳐두고 아직 안 돌려본 것을
구분하기 위해 "정식으로 결과를 받은 실행"만 여기 번호를 붙여 기록한다
(스테일 코드로 잘못 돈 시도, 인덱스/계정충돌로 중간에 죽은 시도는 위 타임라인
표의 근본원인 항목으로만 남기고 여기 번호에는 안 넣는다).

### QA 실행 #1 (계정 분리 직후, 커밋 `825615f` 기준)
- 78건 전부 정상 채점(에러 0건)
- 25/26 미션 PASS
- 미션 #21만 3개 품질 전부 0점 → 타임라인 #4에서 원인 규명(코퍼스 빈 답변)

### QA 실행 #2 (`runId` 멱등성 픽스 후, 커밋 `b773a6c` 기준 — 오늘 2026-08-02)
- 78건 전부 정상 채점(에러 0건) — 재실행 충돌(409) 완전히 해소 확인
- 겉보기 판정: "✅ 모든 미션에서 high > low/evasive 순서 유지됨"
- **자세히 보니 실제로는 24/26만 진짜 PASS**:
  - 미션 #19: high/medium 데이터 자체가 없이 evasive 1개만 존재 — 판정 로직이 비교 대상 없음을 "문제 없음"으로 조용히 넘김
  - 미션 #23: high(17) < medium(49) < 그 외로 순서 완전히 뒤집힘 — 판정 로직이 high vs low(17 vs 15)만 봐서 "PASS"로 오판
- 이 두 건은 타임라인 #6에서 판정 로직·코퍼스 검증을 강화하는 것으로 대응(커밋 `20ecdf8`)

### QA 실행 #3 (최종 — #19·#23 재생성 후, 2026-08-02)
- `node scripts/generateDummyCorpus.js 19`, `node scripts/generateDummyCorpus.js 23`으로 재생성 후 `npm run qa:scores` 재실행
- **26/26 미션 전부 PASS, 78/78 에러 0건, 품질 누락 0건**
- 미션 #19: high(80) > medium(45) > evasive(25) — 정상 확인
- 미션 #23: high(85) > medium(55) > low(20) — 재생성 전 high=17이던 게 85로 정상화됨. **코퍼스 생성 글리치였음이 확정**(루브릭/앵커 문제 아니었음)
- 이걸로 **QA 트랙 완전히 종료** — 26개 미션 전부 실제 Claude 채점으로 high>medium>low/evasive 순서가 유지되는 것을 확인함

## 최종 결론

- 리스크9 패치(주차 게이팅 + 재제출 차단) 정상 동작 확인 (`runLoadTest.js` 160/160, `qa:scores` 78/78 무에러)
- 26개 미션 전부(사실형/정서형, AI채점형/관찰형 값 섞어서) 루브릭이 high>medium>low/evasive 순서를 명확히 지킴 — 앵커·루브릭 자체는 신뢰할 만한 것으로 확인됨
- 발견됐던 문제 전부 코퍼스 생성 단계(`generateDummyCorpus.js`, temperature:1 확률적 글리치)의 결함이었고, `api/score.js`의 실제 채점 로직 자체에는 결함이 발견되지 않음

## 남아있는 알려진 한계 (지금 당장 안 고침, 인지만 해둠)

- `runLoadTest.js`는 qaScores.js와 같은 재실행 충돌 가능성이 구조적으로 남아있다(같은 주에 두 번째로 돌리면 409). 다만 실패를 숨기지 않고 `실패: N건`으로 그대로 보여주므로 "가짜 초록불" 위험은 없다 — 필요해지면 같은 `runId` 방식으로 고친다.
- 이 QA용 계정들(`qa-mission-*`, `loadtest-intern-*`, `demo-timeline@test.local`)은 정리(삭제) 스크립트가 없어 실행할수록 Firebase Auth에 계정이 누적된다. 프로토타입 규모에서는 무해하지만, 정리가 필요해지면 별도로 처리한다.

## 다음 액션

QA 트랙은 닫혔다. 다음은 `CHARTER.md` 리스크1의 남은 항목 — **Vercel 프로덕션 배포 + 20명 규모 실부하테스트 실행**으로 넘어간다.
