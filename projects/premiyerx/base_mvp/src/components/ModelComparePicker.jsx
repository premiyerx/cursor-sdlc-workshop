/** After parallel multi-model generation, pick one draft to continue the workflow. */
export default function ModelComparePicker({ variants, onPick, busy }) {
  if (!variants?.length) return null

  return (
    <section className="model-compare-section" aria-label="Compare model drafts">
      <div className="model-compare-head">
        <h3 className="model-compare-title">Pick your favorite draft</h3>
        <p className="model-compare-sub">
          Same topic, same live headlines — three models. Choose one to edit, score, and (if you use Text + Image) generate the infographic.
        </p>
      </div>
      <div className="model-compare-grid">
        {variants.map((v) => (
          <article key={v.id} className={`model-compare-card ${v.error ? 'is-error' : ''}`}>
            <header className="model-compare-card-h">
              <span className="model-compare-badge">{v.shortLabel || v.label}</span>
              <span className="model-compare-name">{v.label}</span>
            </header>
            {v.error ? (
              <p className="model-compare-err">{v.error}</p>
            ) : (
              <div className="model-compare-preview">
                <p className="model-compare-hook">{v.post?.hook || '—'}</p>
                <p className="model-compare-body">{v.post?.body?.slice(0, 420) || ''}{v.post?.body?.length > 420 ? '…' : ''}</p>
              </div>
            )}
            <button
              type="button"
              className="model-compare-use-btn"
              disabled={busy || !v.post}
              onClick={() => onPick?.(v)}
            >
              Use this draft
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
