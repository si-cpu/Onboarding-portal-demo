// ⚠️ 이 파일은 반드시 api/ (서버리스 함수) 쪽에만 존재해야 한다.
// src/ (프론트엔드 번들)에 두면 브라우저 개발자도구로 mapped_values가 노출되어
// 미션 블라인드 원칙(설계원칙 7번)이 깨진다.
//
// 6개월(26주) 온보딩 동안 매주 새 질문 하나씩, id가 곧 주차(week)다.
// 같은 질문을 여러 번 묻던 이전 방식과 달리 26개가 전부 서로 다른 질문이라, "같은
// 미션 2회 이상 답변 시 성장 서사 생성"하던 옛 TimelineView 기능은 정상 흐름에서
// 절대 트리거 안 되는 죽은 코드였다(growthNarrative.js와 함께 제거함) — 대신
// 3개월(13주)/6개월(26주) 시점의 종합 해석(comprehensiveReview.js)이 전체 성장
// 서사 역할을 전담한다.
//
// ⚠️ 질문 문구는 "~서술하세요" 지시문 대신 "~있었나요? 들려주세요" 같은 대화체로
// 통일했다(온보딩 과제의 정서적 톤을 따뜻하게 하려는 리프레이밍의 일부). 다만
// "구체적 사례/수치로 답하라"는 요청 자체는 그대로 유지한다 — score.js의 루브릭이
// 그 구체성을 근거로 채점하기 때문에, 톤만 바꾸고 질문이 요구하는 답변의 형태는
// 안 바꿨다.
//
// ⚠️ 이 파일을 고쳐도 신입 화면(missions 컬렉션)에는 자동 반영되지 않는다 —
// `npm run seed:missions`를 다시 실행해서 Firestore missions 컬렉션을
// 덮어써야 한다(scripts/seedMissions.js).

export const MISSION_BANK = [
  {
    id: 1,
    type: "사실형",
    question: "이번 주 예상과 다르게 흘러간 업무 상황이 있었나요? 그때 어떻게 대응했는지 편하게 들려주세요.",
    mapped: { primary: "집요한 끈기", secondary: ["미래낙관적 도전", "근본적 비판 사고"] },
  },
  {
    id: 2,
    type: "사실형",
    question: "이번 주 세운 목표, 실제로는 어땠나요? 비교해서 들려주세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 3,
    type: "사실형",
    question: "이번 주 새롭게 알게 돼서 실제로 적용해본 게 있나요? 어떤 거였는지 들려주세요.",
    mapped: { primary: "강박적 호기심", secondary: ["자발적 성장동기", "혁신 프로세스 가속화"] },
  },
  {
    id: 4,
    type: "사실형",
    question: "이번 주 받은 피드백 중 하나를 골라서, 어떻게 반영했는지 들려주세요.",
    mapped: { primary: "성장지향 피드백", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 5,
    type: "사실형",
    question: "이번 주 협업하면서 상대방 입장을 고려해 조율했던 경험이 있었나요? 들려주세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 6,
    type: "사실형",
    question: '이번 주 업무 중 "왜 이렇게 하지?"라는 의문이 들었던 순간이 있었나요? 그때 스스로 생각한 대안도 함께 들려주세요.',
    mapped: { primary: "근본적 비판 사고", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 7,
    type: "사실형",
    question: "이번 주 시간이 부족했던 순간이 있었다면, 무엇을 우선순위에 뒀는지 들려주세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 8,
    type: "정서형",
    question: "이번 주 가장 힘 빠졌던 순간이 있었나요? 그럼에도 다시 움직이게 된 계기가 있었다면 들려주세요.",
    mapped: { primary: "미래낙관적 도전", secondary: ["집요한 끈기"] },
  },
  {
    id: 9,
    type: "정서형",
    question: "이번 주 일하면서 가장 몰입했던 순간이 있었나요? 왜 그랬다고 생각하는지 편하게 들려주세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["강박적 호기심"] },
  },
  {
    id: 10,
    type: "사실형",
    question: "이번 주 여러 업무가 한꺼번에 몰렸던 적이 있었나요? 그때 어떤 기준으로 순서를 정했는지 들려주세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 11,
    type: "사실형",
    question: "이번 주 동료나 타 부서와 협업하면서 의견 차이가 있었나요? 어떻게 풀어갔는지 들려주세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 12,
    type: "사실형",
    question: "이번 주 반복되던 비효율을 발견하고 개선을 시도해본 경험이 있었나요? 들려주세요.",
    mapped: { primary: "혁신 프로세스 가속화", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 13,
    type: "사실형",
    question: "입사 후 지금까지(3개월)를 돌아보면, 스스로 가장 달라졌다고 느끼는 부분은 무엇인가요? 편하게 들려주세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["성장지향 피드백"] },
  },
  {
    id: 14,
    type: "사실형",
    question: "이번 주 예상 밖의 결과가 나온 업무가 있었나요? 원인을 어디까지 파고들어봤는지 들려주세요.",
    mapped: { primary: "근본적 비판 사고", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 15,
    type: "사실형",
    question: "이번 주 새로운 도구나 방법을 스스로 찾아서 써본 경험이 있었나요? 들려주세요.",
    mapped: { primary: "강박적 호기심", secondary: ["혁신 프로세스 가속화"] },
  },
  {
    id: 16,
    type: "사실형",
    question: "이번 주 팀이나 조직의 목표와 본인의 업무를 어떻게 연결 지어 생각해봤는지 들려주세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["관계기반 전략소통"] },
  },
  {
    id: 17,
    type: "사실형",
    question: "이번 주 스스로 기준을 더 높게 잡고 다시 시도해본 경험이 있었나요? 들려주세요.",
    mapped: { primary: "최고수준의 결과지향", secondary: ["집요한 끈기"] },
  },
  {
    id: 18,
    type: "사실형",
    question: "이번 주 받은 피드백 중 가장 받아들이기 어려웠던 게 있었나요? 그걸 어떻게 소화했는지 들려주세요.",
    mapped: { primary: "성장지향 피드백", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 19,
    type: "정서형",
    question: "이번 주 스스로에게 실망했던 순간이 있었나요? 그 이후 마음을 다잡게 된 계기가 있었다면 들려주세요.",
    mapped: { primary: "집요한 끈기", secondary: ["미래낙관적 도전"] },
  },
  {
    id: 20,
    type: "사실형",
    question: "이번 주 문제를 해결하면서 여러 대안 중 하나를 고른 기준이 있었나요? 들려주세요.",
    mapped: { primary: "가치중심적 문제해결", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 21,
    type: "사실형",
    question: "이번 주 계획에 없던 일이 생겼던 적이 있었나요? 그때 우선순위를 어떻게 다시 조정했는지 들려주세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 22,
    type: "사실형",
    question: "이번 주 스스로 관성적으로 하던 방식에 의문을 품고 바꿔본 경험이 있었나요? 들려주세요.",
    mapped: { primary: "근본적 비판 사고", secondary: ["혁신 프로세스 가속화"] },
  },
  {
    id: 23,
    type: "사실형",
    question: "이번 주 협업 상대의 입장을 먼저 고려해서 접근 방식을 바꿔본 경험이 있었나요? 들려주세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 24,
    type: "정서형",
    question: "이번 주 스스로 동기부여가 잘 안 됐던 순간이 있었나요? 무엇 덕분에 다시 몰입할 수 있었는지 들려주세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["강박적 호기심"] },
  },
  {
    id: 25,
    type: "사실형",
    question: "지금까지의 성과를 스스로 점검해보면 어떤가요? 다음 목표는 어떻게 다시 세웠는지 들려주세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 26,
    type: "정서형",
    question: "지난 6개월을 돌아보면, 입사 초와 비교해 가장 크게 성장했다고 느끼는 부분은 무엇인가요? 편하게 들려주세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["성장지향 피드백"] },
  },
];

// 신입에게 내려줄 때는 question/type/id만 남기고 mapped는 반드시 제거한다.
export function getPublicMissionList() {
  return MISSION_BANK.map(({ id, type, question }) => ({ id, type, question }));
}
