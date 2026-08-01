// 네이티브 window.confirm() 대신 쓰는 커스텀 확인 모달.
// fixed 오버레이라 뒤에 있는 페이지 레이아웃(텍스트 입력창 등)을 절대 흔들지 않는다.
export default function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 16, whiteSpace: "pre-line" }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ marginTop: 0 }} onClick={onConfirm}>
            네
          </button>
          <button className="btn btn-secondary" style={{ marginTop: 0 }} onClick={onCancel}>
            아니오
          </button>
        </div>
      </div>
    </div>
  );
}
