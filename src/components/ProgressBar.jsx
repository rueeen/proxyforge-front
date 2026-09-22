import "./ProgressBar.css";

export default function ProgressBar({ completed = 0, total = 0, failed = 0 }) {
  const safeTotal = Math.max(Number(total) || 0, 0);
  const safeCompleted = Math.min(Math.max(Number(completed) || 0, 0), safeTotal || Infinity);
  const safeFailed = Math.min(Math.max(Number(failed) || 0, 0), safeTotal || Infinity);
  const completedPercent = safeTotal ? (safeCompleted / safeTotal) * 100 : 0;
  const failedPercent = safeTotal ? (safeFailed / safeTotal) * 100 : 0;

  return (
    <div className="progress-wrap" aria-live="polite">
      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax={safeTotal} aria-valuenow={safeCompleted}>
        <span className="progress-completed" style={{ width: `${completedPercent}%` }} />
        {safeFailed > 0 && <span className="progress-failed" style={{ width: `${failedPercent}%` }} />}
        <strong>{safeCompleted} / {safeTotal}</strong>
      </div>
      {safeFailed > 0 && <span className="failed-label">{safeFailed} fallidas</span>}
    </div>
  );
}
