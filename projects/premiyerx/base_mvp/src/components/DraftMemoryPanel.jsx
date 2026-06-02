import { useEffect, useState } from 'react'
import { getDraftHistory, clearDraftHistory } from '../utils/draftHistory'

/**
 * Settings panel that surfaces the rolling draft-history buffer used for
 * novelty checking. Users can inspect what the anti-duplicate system is
 * comparing against and clear it when they want a clean slate.
 */
export default function DraftMemoryPanel() {
  const [entries, setEntries] = useState(() => getDraftHistory())
  const [expanded, setExpanded] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)

  useEffect(() => {
    // Refresh when the panel becomes visible — cheap and gives users a
    // sensible snapshot without subscribing to storage events.
    const onVis = () => setEntries(getDraftHistory())
    window.addEventListener('focus', onVis)
    return () => window.removeEventListener('focus', onVis)
  }, [])

  function handleClear() {
    clearDraftHistory()
    setEntries([])
    setConfirmingClear(false)
  }

  const visible = expanded ? entries : entries.slice(0, 3)

  return (
    <div className="draft-memory-panel">
      <div className="draft-memory-header">
        <div>
          <h4 className="draft-memory-title">Draft memory</h4>
          <p className="draft-memory-sub">
            Last {Math.min(entries.length, 30)} drafts used for novelty checks. The model is told to avoid these hooks
            and openers on every generation.
          </p>
        </div>
        <span className="draft-memory-count">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="draft-memory-empty">No drafts on file yet. Generate one and it'll show up here.</p>
      ) : (
        <ul className="draft-memory-list">
          {visible.map((entry) => {
            const day = new Date(entry.ts).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            return (
              <li key={entry.id} className="draft-memory-row">
                <div className="draft-memory-row-head">
                  <span className="draft-memory-row-date">{day}</span>
                  <span className="draft-memory-row-model">{entry.modelId}</span>
                  <span className="draft-memory-row-topic">{entry.topicId}</span>
                </div>
                <p className="draft-memory-row-hook">{entry.hook}</p>
              </li>
            )
          })}
        </ul>
      )}

      <div className="draft-memory-actions">
        {entries.length > 3 && (
          <button
            type="button"
            className="draft-memory-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show fewer' : `Show all ${entries.length}`}
          </button>
        )}
        {entries.length > 0 && (
          confirmingClear ? (
            <span className="draft-memory-confirm">
              <button type="button" className="draft-memory-confirm-yes" onClick={handleClear}>
                Yes, clear it
              </button>
              <button type="button" className="draft-memory-confirm-no" onClick={() => setConfirmingClear(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="draft-memory-clear" onClick={() => setConfirmingClear(true)}>
              Clear draft memory
            </button>
          )
        )}
      </div>
    </div>
  )
}
