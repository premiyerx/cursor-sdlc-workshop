import { fetchRealtimeContext, invalidateRealtimeCache } from './realtimeData'
import { bumpRefreshSeed } from './freshnessRotation'
import { buildHeadlineInfographicModel } from './verifiedInfographic'
import { generateNewsroomImage } from './newsroomVisual'
import { getOpenAiKey } from './openaiKey'

/**
 * Build the companion graphic.
 *
 * Default = the legible, client-rendered SVG "news infographic" (always crisp
 * text). The AI image (GPT-Image newsroom) is only produced when a caller
 * explicitly opts in via `preferNewsroom`/`forceNewsroom`, because GPT-Image
 * frequently garbles long headlines — which tanks dwell/engagement on LinkedIn.
 */
export async function createCompanionGraphic({
  postText,
  topicId,
  topicLabel = '',
  realtimeData: existingRt = null,
  seed: existingSeed = null,
  apiKey: providedKey = '',
  preferNewsroom = false,
  forceNewsroom = false,
  bumpSeed = false,
  onProgress,
}) {
  const report = (pct, stage) => onProgress?.(pct, stage)
  const apiKey = (providedKey || getOpenAiKey()).trim()

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

  // Only generate an AI image when explicitly requested. Having an OpenAI key
  // no longer auto-forces it — the crisp SVG infographic is the default.
  const tryAiImage = !!apiKey && (forceNewsroom || preferNewsroom)

  if (tryAiImage) {
    report(45, 'Planning infographic layout…')
    const postTheme = model.implications?.[0] || model.hook
    const img = await generateNewsroomImage({
      model,
      topicId,
      topicLabel: topicLabel || model.topicLabel,
      refreshSeed: seed,
      postTheme,
      apiKey,
      onProgress: (pct, stage) => report(Math.min(95, pct), stage),
    })

    if (img.ok) {
      report(100, 'Infographic ready')
      return {
        ok: true,
        mode: 'newsroom',
        newsroomImage: img.url,
        newsroomStyle: img.styleName,
        creativeHeadline: img.creativeHeadline || '',
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

  report(85, 'Composing news infographic…')
  report(100, 'News infographic ready')
  return {
    ok: true,
    mode: 'headline',
    newsroomImage: null,
    newsroomStyle: '',
    realtimeData: rt,
    seed,
    model,
    hint: model.hasNews
      ? `${model.verifiedCount} verified stat${model.verifiedCount === 1 ? '' : 's'} · crisp text, ready for LinkedIn`
      : `Clean infographic ready — crisp text, ready for LinkedIn`,
    error: null,
  }
}
