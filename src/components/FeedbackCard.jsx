export default function FeedbackCard({ feedbackText }) {
  return (
    <div className="card">
      <div className="label">AI 피드백</div>
      <div style={{ fontSize: 13 }}>{feedbackText}</div>
    </div>
  );
}
