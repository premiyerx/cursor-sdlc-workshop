import { useEffect, useRef } from 'react'

function gradeClass(grade) {
  if (grade === 'A' || grade === 'B') return 'reach-grade--good'
  if (grade === 'C') return 'reach-grade--mid'
  return 'reach-grade--low'
}

/**
 * Compact reach-score panel inside a variant card (not a modal).
 */
export default function ReachScoreBreakdown({ id, breakdown, boundaryRef, onClose }) {
  const panelRef = useRef(null)

  useEffect(() => {
    function onPointerDown(e) {
      if (boundaryRef?.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      onClose?.()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, boundaryRef])

  if (!breakdown) return null

  const { algorithmScore, algorithmGrade, penalties, penaltySum, reachScore, reachGrade, algorithmRules } =
    breakdown

  return (
    <div
      ref={panelRef}
      id={id}
      className="reach-breakdown"
      role="region"
      aria-label="Reach score breakdown"
    >
      <div className="reach-breakdown-head">
        <span className="reach-breakdown-title">Reach score</span>
        <button type="button" className="reach-breakdown-close" onClick={onClose} aria-label="Close breakdown">
          ×
        </button>
      </div>

      <div className="reach-breakdown-net">
        <span className="reach-breakdown-net-score">{reachScore}</span>
        <span className={`reach-grade ${gradeClass(reachGrade)}`}>{reachGrade}</span>
        <span className="reach-breakdown-formula">
          {algorithmScore} base − {penaltySum} penalties
        </span>
      </div>

      <ul className="reach-breakdown-list">
        <li className="reach-breakdown-row reach-breakdown-row--base">
          <span className="reach-breakdown-label">Algorithm fit</span>
          <span className="reach-breakdown-meta">
            <span className={`reach-grade ${gradeClass(algorithmGrade)}`}>{algorithmGrade}</span>
            <span className="reach-breakdown-pts">{algorithmScore}</span>
          </span>
          <span className="reach-breakdown-desc">Weighted LinkedIn rules: hook, dwell, scannability, comments, hashtags.</span>
        </li>
        {penalties.map((p) => (
          <li key={p.id} className="reach-breakdown-row">
            <span className="reach-breakdown-label">{p.label}</span>
            <span className="reach-breakdown-meta">
              <span className={`reach-grade ${gradeClass(p.grade)}`}>{p.grade}</span>
              <span className={`reach-breakdown-pts ${p.points > 0 ? 'is-penalty' : ''}`}>
                {p.points > 0 ? `−${p.points}` : '0'}
              </span>
            </span>
            <span className="reach-breakdown-desc">{p.description}</span>
          </li>
        ))}
      </ul>

      <details className="reach-breakdown-rules">
        <summary>Algorithm subscores ({algorithmRules?.length || 0})</summary>
        <ul className="reach-breakdown-rules-list">
          {(algorithmRules || []).map((rule) => (
            <li key={rule.id} className="reach-breakdown-rule">
              <span className="reach-breakdown-rule-name">{rule.label}</span>
              <span className="reach-breakdown-meta">
                <span className={`reach-grade ${gradeClass(rule.grade)}`}>{rule.grade}</span>
                <span className="reach-breakdown-pts">{rule.score}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
