export default function AnswerCard({ answerText }) {
  return (
    <div className="card">
      <div className="label">내 답변</div>
      <div style={{ fontSize: 13 }}>{answerText}</div>
    </div>
  );
}
