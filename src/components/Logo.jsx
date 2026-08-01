// InterX 브랜드 로고. 원본이 밝은 배경용이라(짙은 남색 "INTER" 텍스트가 어두운
// 앱 배경에서는 안 보임) 작은 흰색 패치 위에 얹어서 원래 색 그대로 보여준다.
export default function Logo() {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 6,
        padding: "4px 10px",
        display: "flex",
        alignItems: "center",
        lineHeight: 0,
      }}
    >
      <img src="/interx-logo-wordmark.webp" alt="InterX" style={{ height: 16, display: "block" }} />
    </div>
  );
}
