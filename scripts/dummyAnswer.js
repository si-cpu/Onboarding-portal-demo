// 로드테스트용 더미 답변 생성기. 실제 신입 답변처럼 보이는 한국어 문장을
// 무작위 조합해서 매 호출마다 서로 다른 텍스트를 만든다 (answerHash 캐시에
// 걸려서 Claude 호출 없이 캐시 응답만 나오는 걸 방지하기 위함 — 실제 비용을
// 재려면 매번 실제로 채점이 일어나야 한다).

const SUBJECTS = ["신규 기능 개발", "온보딩 문서 정리", "고객사 데모 준비", "버그 트리아지", "리팩터링 작업", "API 연동", "성능 튜닝", "데이터 마이그레이션"];
const OBSTACLES = ["예상보다 요구사항이 자주 바뀌어서", "관련 담당자와 일정이 맞지 않아서", "레거시 코드 구조를 파악하는 데 시간이 걸려서", "테스트 환경이 불안정해서", "우선순위가 중간에 바뀌어서"];
const ACTIONS = ["체크리스트를 다시 짜서 우선순위를 재조정했다", "관련 팀원과 짧은 동기화 미팅을 잡았다", "작업을 더 작은 단위로 쪼개서 진행했다", "기존 문서를 직접 다시 정리하며 파악했다", "일단 되는 범위까지 먼저 마무리하고 나머지는 다음 라운드로 넘겼다"];
const LEARNINGS = ["다음에는 착수 전에 관련자와 먼저 정렬하는 게 낫겠다고 느꼈다", "일정보다 범위를 먼저 명확히 하는 습관을 들여야겠다고 생각했다", "혼자 판단하기보다 더 빨리 물어봤어야 했다는 걸 깨달았다", "작은 성공 단위로 쪼개는 방식이 꽤 효과적이었다"];
const FEELINGS = ["막막했지만", "답답했지만", "조급했지만", "지치는 느낌이었지만"];
const TRIGGERS = ["동료의 짧은 피드백 한마디", "예전에 비슷한 상황을 넘겼던 기억", "일단 하나라도 끝내보자는 생각", "잠깐 자리에서 벗어나 정리한 시간"];

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

// 시드 기반 의사난수 (동시 호출 시에도 결과가 겹치지 않도록 각 호출마다 다른 시드를 넘긴다)
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 사실형: 업무 상황 서술 + 대응 + 배운 점을 조합해 ~280~330자 분량으로 생성
function generateFactualAnswer(rand) {
  const subject = pick(SUBJECTS, rand);
  const obstacle = pick(OBSTACLES, rand);
  const action = pick(ACTIONS, rand);
  const learning = pick(LEARNINGS, rand);
  return (
    `이번 주 ${subject} 관련 작업을 진행하다가 ${obstacle} 계획대로 흘러가지 않았다. ` +
    `처음에는 그대로 밀어붙이려고 했지만 하루 정도 지나서 방향을 바꿔 ${action}. ` +
    `그 결과 완전히 원래 계획대로는 아니었지만 이번 주 안에 마무리할 수 있는 범위까지는 정리가 됐다. ` +
    `이 과정을 돌아보면서 ${learning}. 다음 라운드에는 비슷한 상황이 오면 더 빨리 대응 방식을 바꿔볼 생각이다.`
  );
}

// 정서형: 힘 빠졌던 순간과 다시 움직이게 된 계기를 서술
function generateEmotionalAnswer(rand) {
  const subject = pick(SUBJECTS, rand);
  const feeling = pick(FEELINGS, rand);
  const trigger = pick(TRIGGERS, rand);
  return (
    `이번 주 ${subject}을 진행하면서 중간에 생각만큼 진도가 안 나가는 순간이 있었다. ` +
    `그때는 ${feeling} 이걸 이번 주 안에 끝낼 수 있을지 스스로도 확신이 안 섰다. ` +
    `그러다가 ${trigger} 덕분에 다시 자리를 잡고 이어서 진행할 수 있었다. ` +
    `막상 다시 시작하니 생각보다 오래 걸리지 않았고, 그 이후로는 비슷한 상황이 와도 너무 오래 멈춰있지는 말자는 생각이 들었다.`
  );
}

// mission.type에 맞는 더미 답변을 생성한다. seed가 다르면 결과 텍스트도 달라진다
// (userIndex/round/missionId를 조합해서 넘기면 사실상 매 호출 유일한 문자열이 된다).
export function generateDummyAnswer(mission, seed) {
  const rand = mulberry32(seed);
  const base = mission.type === "정서형" ? generateEmotionalAnswer(rand) : generateFactualAnswer(rand);
  return `${base} (round-ref ${seed})`;
}
