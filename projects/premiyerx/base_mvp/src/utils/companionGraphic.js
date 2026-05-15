import { fetchRealtimeContext, invalidateRealtimeCache } from './realtimeData'
import { bumpRefreshSeed } from './freshnessRotation'
import { buildHeadlineInfographicModel } from './verifiedInfographic'
import { generateNewsroomImage } from './newsroomVisual'
import { hasOpenAiKey } from './aiPostGenerator'

/**
 * Build the companion graphic. When OpenAI key is present, ONLY returns an AI image
 * or a clear failure — no silent bar-chart fallback.
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
    report(15, bumpSeed ? 'Loading fresh headlines for your picture…' : 'Preparing picture data…')
    if (!existingRt || bumpSeed) invalidateRealtimeCache(topicId)
    try {
      rt = await fetchRealtimeContext(topicId, {
        forceRefresh: true,
        topicLabel,
      })
      report(30, 'Headlines ready for picture')
    } catch {
      rt = existingRt
      report(25, 'Building picture from your post text…')
    }
  } else {
    report(28, 'Using data from your post…')
  }

  report(38, 'Matching verified stats…')
  const model = buildHeadlineInfographicModel({
    postText,
    topicId,
    topicLabel,
    realtimeData: rt,
    refreshSeed: seed,
  })

  const tryAiImage = hasOpenAiKey() && (preferNewsroom || forceNewsroom)

  if (tryAiImage) {
    report(45, 'Planning infographic layout…')
    const postTheme = model.implications?.[0] || model.hook
    const img = await generateNewsroomImage({
      model,
      topicLabel: topicLabel || model.topicLabel,
      refreshSeed: seed,
      postTheme,
      onProgress: (pct, stage) => report(Math.min(95, pct), stage),
    })

    if (img.ok) {
      report(100, 'Infographic ready')
      return {
        ok: true,
        mode: 'newsroom',
        newsroomImage: img.url,
        newsroomStyle: img.styleName,
        newsroomVariation: img.variationId,
        realtimeData: rt,
        seed,
        model,
        hint: `${img.styleName} layout · ready to save or post on LinkedIn`,
        error: null,
      }
    }

    report(100, 'Picture not created')
    return {
      ok: false,
      mode: 'failed',
      newsroomImage: null,
      newsroomStyle: '',
      realtimeData: rt,
      seed,
      model,
      hint: null,
      error: img.error || 'Could not create your infographic picture.',
      rawError: img.rawError,
    }
  }

  report(85, 'Building simple chart (add OpenAI key for premium pictures)…')
  report(100, 'Basic chart ready')
  const lead = model.leadHeadline?.title?.slice(0, 48) || 'updated'
  return {
    ok: true,
    mode: 'headline',
    newsroomImage: null,
    newsroomStyle: '',
    realtimeData: rt,
    seed,
    model,
    hint: `Basic chart · "${lead}…" · add OpenAI key for premium infographics`,
    error: null,
  }
}
