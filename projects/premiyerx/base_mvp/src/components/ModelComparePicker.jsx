/** After parallel multi-model generation, pick one draft to continue the workflow. */
export default function ModelComparePicker({ variants, onPick, busy }) {
  if (!variants?.length) return null

  return (
    <section className="model-compare-section" aria-label="Compare model drafts">
      <div className="model-compare-head">
        <h3 className="model-compare-title">Pick your favorite draft</h3>
        <p className="model-compare-sub">
          Same topic, same live headlines — three models. Scroll each card to read the full draft.{' '}
          <strong>Use this draft</strong> copies hook, body, CTA, and hashtags only (ready to paste — no internal labels).
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
                <div className="model-compare-scroll" tabIndex={0}>
                  <p className="model-compare-hook">{v.post?.hook || '—'}</p>
                  {v.post?.body ? <p className="model-compare-body">{v.post.body}</p> : null}
                  {v.post?.cta ? (
                    <p className="model-compare-cta" aria-label="Call to action">
                      {v.post.cta}
                    </p>
                  ) : null}
                  {v.post?.hashtags ? (
                    <p className="model-compare-hashtags" aria-label="Hashtags">
                      {v.post.hashtags}
                    </p>
                  ) : null}
                  {v.post?.firstComment ? (
                    <div className="model-compare-first-wrap">
                      <p className="model-compare-first-label">First comment (paste separately)</p>
                      <p className="model-compare-first-body">{v.post.firstComment}</p>
                    </div>
                  ) : null}
                </div>
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
