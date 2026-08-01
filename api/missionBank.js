// ⚠️ 이 파일은 반드시 api/ (서버리스 함수) 쪽에만 존재해야 한다.
// src/ (프론트엔드 번들)에 두면 브라우저 개발자도구로 mapped_values가 노출되어
// 미션 블라인드 원칙(설계원칙 7번)이 깨진다.
//
// 6개월(26주) 온보딩 동안 매주 새 질문 하나씩, id가 곧 주차(week)다.
// 같은 질문을 여러 번 묻던 이전 방식과 달리 26개가 전부 서로 다른 질문이라
// TimelineView의 "같은 미션 2회 이상 답변 시 성장 서사 생성" 기능은 이 흐름에서는
// 자연스럽게 안 쓰이고, 대신 3개월(13주)/6개월(26주) 시점의 종합 해석이
// 전체 성장 서사 역할을 대신한다.

export const MISSION_BANK = [
  {
    id: 1,
    type: "사실형",
    question: "이번 주 예상과 다르게 흘러간 업무 상황과 대응을 서술하세요.",
    mapped: { primary: "집요한 끈기", secondary: ["미래낙관적 도전", "근본적 비판 사고"] },
  },
  {
    id: 2,
    type: "사실형",
    question: "이번 주 세운 목표와 실제 결과를 비교해서 서술하세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 3,
    type: "사실형",
    question: "이번 주 새롭게 알게 되어 실제로 적용해본 것을 서술하세요.",
    mapped: { primary: "강박적 호기심", secondary: ["자발적 성장동기", "혁신 프로세스 가속화"] },
  },
  {
    id: 4,
    type: "사실형",
    question: "이번 주 받은 피드백 중 하나를 고르고, 어떻게 반영했는지 서술하세요.",
    mapped: { primary: "성장지향 피드백", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 5,
    type: "사실형",
    question: "이번 주 협업 중 상대방 입장을 고려해 조율한 경험을 서술하세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 6,
    type: "사실형",
    question: '이번 주 업무 중 "왜 이렇게 하지?"라는 의문이 들었던 지점과, 본인이 낸 대안을 서술하세요.',
    mapped: { primary: "근본적 비판 사고", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 7,
    type: "사실형",
    question: "이번 주 시간이 부족했던 순간, 무엇을 우선순위에 뒀는지 서술하세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 8,
    type: "정서형",
    question: "이번 주 가장 힘 빠졌던 순간과, 그럼에도 다시 움직이게 만든 계기를 서술하세요.",
    mapped: { primary: "미래낙관적 도전", secondary: ["집요한 끈기"] },
  },
  {
    id: 9,
    type: "정서형",
    question: "이번 주 일하면서 가장 몰입했던 순간을 떠올려보고, 왜 그랬다고 생각하는지 적어주세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["강박적 호기심"] },
  },
  {
    id: 10,
    type: "사실형",
    question: "이번 주 여러 업무가 동시에 몰렸을 때 어떤 기준으로 순서를 정했는지 서술하세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 11,
    type: "사실형",
    question: "이번 주 동료나 타 부서와 협업하면서 생긴 의견 차이를 어떻게 풀었는지 서술하세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 12,
    type: "사실형",
    question: "이번 주 반복되던 비효율을 발견하고 개선을 시도한 경험을 서술하세요.",
    mapped: { primary: "혁신 프로세스 가속화", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 13,
    type: "사실형",
    question: "입사 후 지금까지(3개월차)를 돌아보며, 스스로 가장 달라졌다고 느끼는 지점을 서술하세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["성장지향 피드백"] },
  },
  {
    id: 14,
    type: "사실형",
    question: "이번 주 예상 밖의 결과가 나온 업무에서, 원인을 어디까지 파고들었는지 서술하세요.",
    mapped: { primary: "근본적 비판 사고", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 15,
    type: "사실형",
    question: "이번 주 새로운 도구나 방법을 스스로 찾아서 써본 경험을 서술하세요.",
    mapped: { primary: "강박적 호기심", secondary: ["혁신 프로세스 가속화"] },
  },
  {
    id: 16,
    type: "사실형",
    question: "이번 주 팀이나 조직의 목표와 본인의 업무를 어떻게 연결지어 생각했는지 서술하세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["관계기반 전략소통"] },
  },
  {
    id: 17,
    type: "사실형",
    question: "이번 주 스스로 기준을 더 높게 잡고 다시 시도한 경험을 서술하세요.",
    mapped: { primary: "최고수준의 결과지향", secondary: ["집요한 끈기"] },
  },
  {
    id: 18,
    type: "사실형",
    question: "이번 주 받은 피드백 중 가장 받아들이기 어려웠던 것과, 그걸 어떻게 소화했는지 서술하세요.",
    mapped: { primary: "성장지향 피드백", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 19,
    type: "정서형",
    question: "이번 주 스스로에게 실망했던 순간과, 그 이후 마음을 다잡은 계기를 서술하세요.",
    mapped: { primary: "집요한 끈기", secondary: ["미래낙관적 도전"] },
  },
  {
    id: 20,
    type: "사실형",
    question: "이번 주 문제 해결 과정에서 여러 대안 중 하나를 선택한 기준을 서술하세요.",
    mapped: { primary: "가치중심적 문제해결", secondary: ["근본적 비판 사고"] },
  },
  {
    id: 21,
    type: "사실형",
    question: "이번 주 계획에 없던 일이 생겼을 때 우선순위를 어떻게 재조정했는지 서술하세요.",
    mapped: { primary: "초효율적 시간관리", secondary: ["선도적/정량 목표의식"] },
  },
  {
    id: 22,
    type: "사실형",
    question: "이번 주 스스로 관성적으로 하던 방식에 의문을 제기하고 바꿔본 경험을 서술하세요.",
    mapped: { primary: "근본적 비판 사고", secondary: ["혁신 프로세스 가속화"] },
  },
  {
    id: 23,
    type: "사실형",
    question: "이번 주 협업 상대의 입장을 먼저 고려해서 접근 방식을 바꾼 경험을 서술하세요.",
    mapped: { primary: "관계기반 전략소통", secondary: ["가치중심적 문제해결"] },
  },
  {
    id: 24,
    type: "정서형",
    question: "이번 주 스스로 동기부여가 잘 안 됐던 순간과, 무엇으로 다시 몰입했는지 서술하세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["강박적 호기심"] },
  },
  {
    id: 25,
    type: "사실형",
    question: "지금까지의 성과를 스스로 점검하며, 다음 목표를 어떻게 다시 세웠는지 서술하세요.",
    mapped: { primary: "선도적/정량 목표의식", secondary: ["최고수준의 결과지향"] },
  },
  {
    id: 26,
    type: "정서형",
    question: "지난 6개월을 돌아보며, 입사 초와 비교해 가장 크게 성장했다고 느끼는 부분을 서술하세요.",
    mapped: { primary: "자발적 성장동기", secondary: ["성장지향 피드백"] },
  },
];

// 신입에게 내려줄 때는 question/type/id만 남기고 mapped는 반드시 제거한다.
export function getPublicMissionList() {
  return MISSION_BANK.map(({ id, type, question }) => ({ id, type, question }));
}
