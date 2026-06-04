import { useState, useCallback } from 'react'
import { getCadenceStatus, markPosted, undoLastPosted } from '../utils/cadence'

/**
 * Cadence card — Move 3 of the LinkedIn distribution playbook.
 *
 * 2-4 posts/week is the reach sweet spot; daily posting drops avg reach/post
 * ~26%. The author marks when they actually publish; this shows the rolling
 * 7-day count and a recommendation.
 */
export default function CadenceCard() {
  const [status, setStatus] = useState(() => getCadenceStatus())

  const onPosted = useCallback(() => setStatus(markPosted()), [])
  const onUndo = useCallback(() => setStatus(undoLastPosted()), [])

  return (
    <section className={`cadence-card cadence-card--${status.tone}`} aria-label="Posting cadence">
      <div className="cadence-card-main">
        <span className="cadence-card-dot" aria-hidden="true" />
        <div className="cadence-card-text">
          <p className="cadence-card-headline">{status.headline}</p>
          <p className="cadence-card-detail">{status.detail}</p>
        </div>
      </div>
      <div className="cadence-card-actions">
        <button type="button" className="cadence-card-btn" onClick={onPosted}>
          I posted one
        </button>
        {status.weekCount > 0 && (
          <button type="button" className="cadence-card-btn cadence-card-btn--ghost" onClick={onUndo}>
            Undo
          </button>
        )}
      </div>
    </section>
  )
}
