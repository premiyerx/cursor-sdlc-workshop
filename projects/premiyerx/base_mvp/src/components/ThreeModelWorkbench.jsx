import DynamicGraphic from './DynamicGraphic'
import CarouselGenerator from './CarouselGenerator'
import CommandProgress from './CommandProgress'

export function variantPostToLiveText(post, appendCitations) {
  if (!post) return ''
  const raw = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags}`
  return appendCitations ? appendCitations(raw) : raw
}

/**
 * Three parallel drafts — each column gets its own infographic and/or carousel on demand.
 */
export default function ThreeModelWorkbench({
  variants,
  recommendation,
  topicId,
  variantAssets,
  assetFocus,
  assetBusy,
  graphicProgress,
  graphicStage,
  phaseComplete,
  onGenerateGraphic,
  onGenerateCarousel,
  onGraphicAssetUpdate,
}) {
  if (!variants?.length) return null

  const focusId = assetFocus?.variantId || null
  const dimOthers = Boolean(focusId && assetBusy)
  const recommendedId =
    recommendation?.variantId || variants.find((v) => v.isRecommended)?.id || null
  const recommendedVariant = variants.find((v) => v.id === recommendedId)

  return (
    <section className="model-workbench" aria-label="Three model drafts">
      <div className="model-workbench-head">
        <h2 className="model-workbench-title">Three drafts — same topic, same headlines</h2>
        <p className="model-workbench-sub">
          Each model wrote its own version.{' '}
          {recommendedVariant ? (
            <>
              The highlighted column ({recommendedVariant.label}) scores highest for LinkedIn reach —
              dwell time, comments, and scannability — after stripping common AI tells.
            </>
          ) : (
            <>Pick the column that sounds most like you.</>
          )}{' '}
          Use the buttons below a draft to build an infographic or carousel PDF for that copy only.
        </p>
      </div>

      <div className="model-workbench-grid">
        {variants.map((v) => {
          const assets = variantAssets[v.id] || { graphics: [], carousels: [] }
          const graphicCount = assets.graphics?.length || 0
          const carouselCount = assets.carousels?.length || 0
          const isFocused = focusId === v.id
          const isDimmed = dimOthers && !isFocused
          const graphicLoading = assetBusy && assetFocus?.type === 'graphic' && isFocused
          const carouselLoading = assetBusy && assetFocus?.type === 'carousel' && isFocused

          const graphicBtnLabel =
            graphicCount === 0
              ? 'Generate infographic for this draft'
              : `Generate another infographic (${graphicCount} created)`
          const carouselBtnLabel =
            carouselCount === 0
              ? 'Generate carousel PDF for this draft'
              : `Generate another carousel PDF (${carouselCount} created)`

          return (
            <article
              key={v.id}
              className={[
                'model-workbench-card',
                v.error ? 'is-error' : '',
                isDimmed ? 'is-dimmed' : '',
                isFocused ? 'is-focused' : '',
                v.isRecommended || v.id === recommendedId ? 'is-recommended' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <header className="model-workbench-card-h">
                <span className="model-workbench-badge">{v.shortLabel || v.label}</span>
                <span className="model-workbench-name">{v.label}</span>
                {(v.isRecommended || v.id === recommendedId) && !v.error && (
                  <span className="model-workbench-reach-pill" title="Highest reach score among the three drafts">
                    Best for reach
                    {typeof v.algorithmScore === 'number' ? ` · ${v.algorithmScore}` : ''}
                  </span>
                )}
                {isFocused && assetBusy && (
                  <span className="model-workbench-focus-pill" aria-live="polite">
                    In progress
                  </span>
                )}
              </header>

              {v.error ? (
                <p className="model-workbench-err">{v.error}</p>
              ) : (
                <>
                  <div className="model-workbench-scroll" tabIndex={0}>
                    <p className="model-workbench-hook">{v.post?.hook || '—'}</p>
                    {v.post?.body ? <p className="model-workbench-body">{v.post.body}</p> : null}
                    {v.post?.cta ? <p className="model-workbench-cta">{v.post.cta}</p> : null}
                    {v.post?.hashtags ? <p className="model-workbench-hashtags">{v.post.hashtags}</p> : null}
                    {v.post?.firstComment ? (
                      <div className="model-workbench-first-wrap">
                        <p className="model-workbench-first-label">First comment (paste separately)</p>
                        <p className="model-workbench-first-body">{v.post.firstComment}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="model-workbench-actions">
                    <button
                      type="button"
                      className="model-workbench-btn model-workbench-btn--graphic"
                      disabled={assetBusy || !v.post}
                      onClick={() => onGenerateGraphic?.(v)}
                    >
                      {graphicBtnLabel}
                    </button>
                    <button
                      type="button"
                      className="model-workbench-btn model-workbench-btn--carousel"
                      disabled={assetBusy || !v.post}
                      onClick={() => onGenerateCarousel?.(v)}
                    >
                      {carouselBtnLabel}
                    </button>
                  </div>

                  {graphicLoading && (
                    <div className="model-workbench-progress">
                      <CommandProgress
                        progress={graphicProgress}
                        stage={graphicStage || 'Creating infographic…'}
                        complete={phaseComplete}
                        sub="Usually 20–45 seconds"
                      />
                    </div>
                  )}

                  {carouselLoading && (
                    <div className="model-workbench-progress">
                      <CommandProgress
                        progress={graphicProgress}
                        stage={graphicStage || 'Preparing carousel…'}
                        complete={phaseComplete}
                        sub="Building PDF from this draft"
                      />
                    </div>
                  )}

                  {(assets.graphics || []).map((g, idx) => (
                    <div key={g.id} className="model-workbench-asset">
                      <p className="model-workbench-asset-label">
                        Infographic {assets.graphics.length > 1 ? idx + 1 : ''} — {v.shortLabel}
                      </p>
                      <DynamicGraphic
                        postText={g.liveText}
                        topicId={topicId}
                        bundleGraphic={g.graphic}
                        graphicSessionId={g.sessionId}
                        onGraphicUpdate={(graphic) => onGraphicAssetUpdate?.(v.id, g.id, graphic)}
                        externalGraphicLoading={graphicLoading && idx === assets.graphics.length - 1}
                        externalGraphicProgress={graphicProgress}
                        externalGraphicStage={graphicStage}
                      />
                    </div>
                  ))}

                  {(assets.carousels || []).map((c, idx) => (
                    <div key={c.id} className="model-workbench-asset">
                      <p className="model-workbench-asset-label">
                        Carousel {assets.carousels.length > 1 ? idx + 1 : ''} — {v.shortLabel}
                      </p>
                      <CarouselGenerator postText={c.liveText} topicId={topicId} />
                    </div>
                  ))}
                </>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
