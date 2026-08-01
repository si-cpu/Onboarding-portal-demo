export default function NudgeCard({ nudgeText }) {
  if (!nudgeText) return null;
  return <div className="locked nudge">💡 {nudgeText}</div>;
}
