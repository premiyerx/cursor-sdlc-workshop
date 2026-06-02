import { useState, useCallback, useRef } from 'react'
import DynamicGraphic from './DynamicGraphic'
import CarouselGenerator from './CarouselGenerator'
import CommandProgress from './CommandProgress'
import ActionFeedback from './ActionFeedback'
import ReachScoreBreakdown from './ReachScoreBreakdown'
import { copyToClipboard } from '../utils/clipboard'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import { livePostCharCount } from '../utils/humanizeLinkedInCopy'
import { POST_LENGTH } from '../data/contentStrategy'
import { getMaxPromisedCount, countNumberedListItems } from '../utils/postListIntegrity'
import { breakdownReachScore, REACH_PUBLISH_MIN } from '../utils/draftRecommendation'
import { describeNovelty } from '../utils/draftHistory'

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
  appendCitations,
  onGenerateGraphic,
  onGenerateCarousel,
  onGraphicAssetUpdate,
}) {
  const [copiedVariantId, setCopiedVariantId] = useState(null)
  const [openReachId, setOpenReachId] = useState(null)
  const reachPillRef = useRef(null)
  const { msg: copyMsg, flashOk, flashErr } = useFlashFeedback()

  const toggleReachPanel = useCallback((variantId, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget instanceof HTMLElement) {
      reachPillRef.current = e.currentTarget
    }
    setOpenReachId((id) => (id === variantId ? null : variantId))
  }, [])

  const copyVariantPost = useCallback(
    async (variant) => {
      if (!variant?.post) return false
      const text = variantPostToLiveText(variant.post, appendCitations)
      const res = await copyToClipboard(text)
      if (!res.ok) {
        flashErr(res.error || 'Could not copy — try selecting the text manually.')
        return false
      }
      setCopiedVariantId(variant.id)
      flashOk('Post copied — paste into LinkedIn (Ctrl+V).')
      setTimeout(() => {
        setCopiedVariantId((id) => (id === variant.id ? null : id))
      }, 3000)
      return true
    },
    [appendCitations, flashOk, flashErr],
  )

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
              The highlighted column ({recommendedVariant.label}) scored highest after Editors 2 & 3.
              Gold badge means reach is above {REACH_PUBLISH_MIN - 1}; you can still copy any draft.
            </>
          ) : (
            <>Editors 2 & 3 run on every draft. Copy any column — regenerate to chase a higher reach score.</>
          )}{' '}
          Copy a draft to LinkedIn with one tap, or use the combined buttons to copy the post and start an infographic or carousel at the same time.
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

          const isCopied = copiedVariantId === v.id
          const graphicBtnLabel =
            graphicCount === 0
              ? 'Copy post + generate infographic'
              : `Copy post + generate another infographic (${graphicCount} created)`
          const carouselBtnLabel =
            carouselCount === 0
              ? 'Copy post + generate carousel PDF'
              : `Copy post + generate another carousel PDF (${carouselCount} created)`

          const isWinner = Boolean((v.isRecommended || v.id === recommendedId) && !v.error)
          const reachClearedBar =
            v.reachClearedBar != null ? Boolean(v.reachClearedBar) : (v.reachScore ?? 0) >= REACH_PUBLISH_MIN
          const reachOpen = openReachId === v.id
          const pillLabel = isWinner
            ? reachClearedBar
              ? 'Best for reach'
              : 'Highest reach'
            : 'Reach score'

          return (
            <article
              key={v.id}
              className={[
                'model-workbench-card',
                v.error ? 'is-error' : '',
                isDimmed ? 'is-dimmed' : '',
                isFocused ? 'is-focused' : '',
                isWinner && reachClearedBar ? 'is-recommended' : '',
                isWinner && !reachClearedBar ? 'is-recommended-soft' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <header className="model-workbench-card-h">
                <span className="model-workbench-badge">{v.shortLabel || v.label}</span>
                <span className="model-workbench-name">{v.label}</span>
                {!v.error && typeof v.reachScore === 'number' && (
                  <div className={['model-workbench-reach-wrap', reachOpen ? 'is-open' : ''].filter(Boolean).join(' ')}>
                    <button
                      type="button"
                      className={[
                        'model-workbench-reach-pill',
                        isWinner && reachClearedBar ? '' : 'model-workbench-reach-pill--alt',
                        isWinner && !reachClearedBar ? 'model-workbench-reach-pill--soft' : '',
                        reachOpen ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-expanded={reachOpen}
                      aria-controls={`reach-breakdown-${v.id}`}
                      title="Tap to see how this reach score was calculated"
                      onClick={(e) => toggleReachPanel(v.id, e)}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {pillLabel}
                      {` · ${v.reachScore}`}
                      <span className="model-workbench-reach-chevron" aria-hidden="true">
                        {reachOpen ? '▴' : '▾'}
                      </span>
                    </button>
                  </div>
                )}
                {!v.error && typeof v.noveltyScore === 'number' && (() => {
                  const novelty = describeNovelty(v.noveltyScore, v.noveltyTopMatch)
                  const matchHook = v.noveltyTopMatch?.hook
                    ? `Closest prior draft: "${v.noveltyTopMatch.hook.slice(0, 110)}"`
                    : 'No prior drafts on file yet.'
                  return (
                    <span
                      className={`model-workbench-novelty-pill is-${novelty.tone}`}
                      title={matchHook}
                      aria-label={`Novelty: ${novelty.label}. ${matchHook}`}
                    >
                      {novelty.label}
                    </span>
                  )
                })()}
                {isFocused && assetBusy && (
                  <span className="model-workbench-focus-pill" aria-live="polite">
                    In progress
                  </span>
                )}
              </header>

              {v.error ? (
                <div className="model-workbench-err-wrap">
                  <p className="model-workbench-err">{v.error}</p>
                </div>
              ) : (
                <>
                  <div className={['model-workbench-main', reachOpen ? 'has-reach-panel' : ''].filter(Boolean).join(' ')}>
                    {reachOpen && (
                      <ReachScoreBreakdown
                        id={`reach-breakdown-${v.id}`}
                        variant="overlay"
                        anchorRef={reachPillRef}
                        breakdown={v.reachBreakdown || (v.post ? breakdownReachScore(v.post) : null)}
                        onClose={() => setOpenReachId(null)}
                        isWinner={isWinner}
                      />
                    )}
                    <div className="model-workbench-scroll">
                    {v.reachWarning ? (
                      <p className="model-workbench-reach-warning" role="status">
                        {v.reachWarning}
                      </p>
                    ) : null}
                    {v.post ? (
                      <p className="model-workbench-char-meta" aria-hidden="true">
                        {livePostCharCount(v.post)} chars
                        {(() => {
                          const text = variantPostToLiveText(v.post, null)
                          const promised = getMaxPromisedCount(text)
                          const have = countNumberedListItems(v.post.body || '')
                          if (promised > 0 && have > 0 && have < promised) {
                            return ` · list ${have}/${promised}`
                          }
                          return ''
                        })()}
                        {livePostCharCount(v.post) > POST_LENGTH.charSoftMax ? ' · over target' : ''}
                      </p>
                    ) : null}
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
                      className="model-workbench-btn model-workbench-btn--copy"
                      disabled={assetBusy || !v.post}
                      onClick={() => void copyVariantPost(v)}
                    >
                      {isCopied ? '✓ Copied to clipboard' : 'Copy post to clipboard'}
                    </button>
                    <button
                      type="button"
                      className="model-workbench-btn model-workbench-btn--graphic"
                      disabled={assetBusy || !v.post}
                      onClick={() => {
                        void (async () => {
                          await copyVariantPost(v)
                          onGenerateGraphic?.(v)
                        })()
                      }}
                    >
                      {graphicBtnLabel}
                    </button>
                    <button
                      type="button"
                      className="model-workbench-btn model-workbench-btn--carousel"
                      disabled={assetBusy || !v.post}
                      onClick={() => {
                        void (async () => {
                          await copyVariantPost(v)
                          onGenerateCarousel?.(v)
                        })()
                      }}
                    >
                      {carouselBtnLabel}
                    </button>
                  </div>
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
      <ActionFeedback msg={copyMsg} />
    </section>
  )
}
