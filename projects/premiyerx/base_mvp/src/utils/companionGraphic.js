import { fetchRealtimeContext, invalidateRealtimeCache } from './realtimeData'
import { bumpRefreshSeed } from './freshnessRotation'
import { buildHeadlineInfographicModel } from './verifiedInfographic'
import { generateNewsroomImage } from './newsroomVisual'
import { hasOpenAiKey } from './aiPostGenerator'

/**
 * Build the companion graphic (newsroom DALL·E when key present, else verified SVG).
 * Progress callbacks reflect real pipeline steps only.
 */
export async function createCompanionGraphic({
  postText,
  topicId,
  topicLabel = '',
  realtimeData: existingRt = null,
  seed: existingSeed = null,
  preferNewsroom = true,
  forceNewsroom = false,
  bumpSeed = false,
  onProgress,
}) {
  const report = (pct, stage) => onProgress?.(pct, stage)

  let seed = existingSeed
  if (bumpSeed || seed == null) {
    seed = bumpRefreshSeed(topicId)
    if (bumpSeed) invalidateRealtimeCache(topicId)
  }

  let rt = existingRt
  if (!rt || bumpSeed) {
    report(12, bumpSeed ? 'Fetching fresh headlines…' : 'Loading headlines for graphic…')
    if (!existingRt || bumpSeed) invalidateRealtimeCache(topicId)
    try {
      rt = await fetchRealtimeContext(topicId, {
        forceRefresh: true,
        topicLabel,
      })
      report(32, 'Headlines ready')
    } catch {
      rt = existingRt
      report(28, 'Building graphic without live headlines…')
    }
  } else {
    report(35, 'Using headlines from your post…')
  }

  report(42, 'Matching verified stats…')
  const model = buildHeadlineInfographicModel({
    postText,
    topicId,
    topicLabel,
    realtimeData: rt,
    refreshSeed: seed,
  })

  const tryNewsroom = hasOpenAiKey() && (preferNewsroom || forceNewsroom)
  const lead = model.leadHeadline?.title?.slice(0, 48) || 'updated'

  if (tryNewsroom) {
    report(48, 'Designing infographic layout…')
    const postTheme = model.implications?.[0] || model.hook
    report(62, 'Rendering premium graphic with DALL·E…')
    const img = await generateNewsroomImage({
      model,
      topicLabel: topicLabel || model.topicLabel,
      refreshSeed: seed,
      postTheme,
    })

    if (img.ok) {
      report(100, 'Premium graphic ready')
      return {
        ok: true,
        mode: 'newsroom',
        newsroomImage: img.url,
        newsroomStyle: img.styleName,
        newsroomVariation: img.variationId,
        realtimeData: rt,
        seed,
        model,
        hint: `${img.styleName} · variation ${img.variationId} · ${model.verifiedCount} verified stats.`,
        newsroomError: null,
      }
    }

    if (forceNewsroom) {
      report(100, 'Newsroom failed')
      return {
        ok: false,
        mode: 'headline',
        error: img.error || 'Could not create newsroom graphic.',
        realtimeData: rt,
        seed,
        model,
        hint: null,
        newsroomError: img.error,
      }
    }

    report(78, 'Building verified SVG fallback…')
    report(100, 'SVG graphic ready')
    return {
      ok: true,
      mode: 'headline',
      newsroomImage: null,
      newsroomStyle: '',
      realtimeData: rt,
      seed,
      model,
      hint: `Verified SVG · "${lead}…" · layout ${model.layoutVariant + 1}/4`,
      newsroomError: img.error,
    }
  }

  report(85, 'Building verified SVG…')
  report(100, 'SVG graphic ready')
  return {
    ok: true,
    mode: 'headline',
    newsroomImage: null,
    newsroomStyle: '',
    realtimeData: rt,
    seed,
    model,
    hint: `Verified SVG · "${lead}…" · layout ${model.layoutVariant + 1}/4`,
    newsroomError: null,
  }
}
