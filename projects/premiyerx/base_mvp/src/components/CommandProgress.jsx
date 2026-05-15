import ProgressRing from './ProgressRing'

/**
 * Single progress panel shown under the generate button (post + graphic phases).
 */
export default function CommandProgress({
  progress = 0,
  stage = '',
  complete = false,
  sub = '',
}) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)))
  const label = complete ? 'Complete' : stage || 'Working…'

  return (
    <div className={`command-progress-panel command-generate-progress ${complete ? 'command-progress-panel--complete' : ''}`}>
      <ProgressRing
        progress={complete ? 100 : progress}
        size={80}
        strokeWidth={5}
        complete={complete}
        showPercent
      />
      <p className="command-progress-stage">{label}</p>
      <p className="command-progress-pct">{complete ? '100% ✓' : `${pct}%`}</p>
      {sub && !complete && <p className="command-progress-sub">{sub}</p>}
    </div>
  )
}
