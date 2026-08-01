import { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

export default function AnswerForm({ onSubmit, loading }) {
  const [answer, setAnswer] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emptyError, setEmptyError] = useState(false);

  const handleSubmitClick = () => {
    if (loading) return;
    if (!answer.trim()) {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onSubmit(answer);
    setAnswer("");
  };

  return (
    <div className="card">
      <textarea
        className="textarea"
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          if (emptyError) setEmptyError(false);
        }}
        placeholder="300자 이내로 적어주세요"
        maxLength={500}
      />
      {emptyError && <div className="error" style={{ marginTop: 6 }}>내용을 작성해 주세요.</div>}
      <button className="btn" onClick={handleSubmitClick} disabled={loading}>
        {loading ? "채점 중..." : "제출하기"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        message={"제출하면 이후에는 답변을 수정할 수 없습니다.\n제출하시겠습니까?"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
