import { CORE_VALUE_STORIES } from "../../lib/coreValues";

// 신입이 매주 미션에 답하기 전에, "내가 왜 이걸 하고 있는가"를 먼저 만나는 화면.
// 미션-가치 매핑(어떤 질문이 어떤 가치를 측정하는지)은 여전히 서버 전용이라 여기엔
// 없다 — 이 화면은 개별 미션이 아니라 인터엑스가 일하는 방식 자체를 소개한다.
export default function CoreValuesPage() {
  return (
    <div>
      <div className="hero">
        <div className="label">인터엑스 핵심가치</div>
        <h1 className="hero-title">우리가 함께 일하는 방식</h1>
        <p className="hero-subtitle">
          매주 만나는 회고 미션은 이 12가지 태도에서 출발합니다. 정답을 맞히는 문제가 아니라, 실제로 겪은
          한 주를 편하게 들려주는 것으로 충분합니다 — 나머지는 시간이 쌓이면서 자연스럽게 드러납니다.
        </p>
      </div>

      <div className="value-grid">
        {CORE_VALUE_STORIES.map((v, i) => (
          <div key={v.name} className="value-card">
            <div className="value-index">{String(i + 1).padStart(2, "0")}</div>
            <div className="value-name">{v.name}</div>
            <div className="value-tagline">{v.tagline}</div>
            <div className="value-desc">{v.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
