/**
 * Premium LinkedIn infographic image generation via OpenAI GPT image models.
 * Never sends response_format — that parameter is rejected by the current API.
 */
import { mulberry32 } from './generationVariety'
import { pickFromPool } from './freshnessRotation'

const LAYOUT_TEMPLATES = [
  { id: 'impact-dashboard', name: 'Impact Dashboard', brief: 'hero stat blocks, donut charts, icon row' },
  { id: 'comparison-vs', name: 'Comparison', brief: 'split VS panels, circles with percentages' },
  { id: 'storytelling-modules', name: 'Story Modules', brief: 'stacked modules, mixed chart types' },
  { id: 'feature-grid', name: 'Feature Grid', brief: 'icon grid, ring chart, chevron flow' },
  { id: 'engagement-story', name: 'Engagement Story', brief: 'hero metrics, pictograph, insight block' },
]

const COLOR_PALETTES = [
  'black background, white type, green #3EDC81 accents',
  'charcoal background, off-white type, green and gold accents',
  'navy background, white headlines, green and blue accents',
  'deep purple background, white type, teal accents',
  'dark slate background, cream type, emerald accents',
]

const VISUAL_MOODS = [
  'editorial annual-report aesthetic',
  'modern SaaS product marketing style',
  'McKinsey-style data storytelling',
  'bold tech keynote slide quality',
  'premium financial infographic polish',
]

export function pickInfographicRecipe(refreshSeed, attempt = 0) {
  const rng = mulberry32((refreshSeed ^ (attempt * 0x9e3779b9)) >>> 0)
  const layout = LAYOUT_TEMPLATES[Math.floor(rng() * LAYOUT_TEMPLATES.length) % LAYOUT_TEMPLATES.length]
  const palette = pickFromPool(COLOR_PALETTES, refreshSeed + attempt, 'palette')
  const mood = pickFromPool(VISUAL_MOODS, refreshSeed + attempt * 3, 'mood')
  return { layout, palette, mood }
}

export function humanizeImageError(raw = '') {
  const msg = String(raw || '').trim()
  if (!msg) return 'OpenAI did not return a reason. Tap New graphic angle to try again.'
  if (/unknown parameter.*response_format/i.test(msg)) {
    return 'Picture API mismatch — please hard-refresh the page and try again.'
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return `Connection problem reaching OpenAI. Check signal or Wi‑Fi, then try again.`
  }
  if (/billing|quota|credit|payment|insufficient|exceeded|hard limit/i.test(msg)) {
    return `Billing issue: ${msg}`
  }
  if (/invalid.*api.*key|incorrect api key|authentication|invalid_api_key/i.test(msg)) {
    return `API key issue: ${msg}`
  }
  if (/does not have access|model_not_found|not available|permission/i.test(msg)) {
    return `Your OpenAI plan may not include image creation via API. ${msg}`
  }
  if (/content.policy|safety|blocked|moderation/i.test(msg)) {
    return `OpenAI blocked this picture. Tap New graphic angle for a different layout.`
  }
  if (/rate.limit|too many requests/i.test(msg)) {
    return `OpenAI is busy — wait 30 seconds and try again.`
  }
  return msg
}

function buildPrompt({ model, topicLabel, refreshSeed, postTheme, recipe, tier = 'full' }) {
  const { layout, palette, mood } = recipe || pickInfographicRecipe(refreshSeed)
  const stats = (model?.verifiedStats || []).slice(0, 3)
  const statsLine = stats.map((s) => s.value).join(', ')
  const theme = (postTheme || model?.hook || topicLabel || 'technology leadership').slice(0, 60)
  const variationId = `v${((refreshSeed >>> 0) + (tier === 'minimal' ? 99 : tier === 'compact' ? 55 : 0)).toString(16).slice(0, 6)}`

  if (tier === 'minimal') {
    return [
      `Professional LinkedIn landscape infographic, 16:9 wide format.`,
      `Dark ${palette}. ${layout.brief}. Mood: ${mood}.`,
      `Topic: ${topicLabel || theme}.`,
      statsLine ? `Numbers to show: ${statsLine}.` : 'Abstract icons only, no numbers.',
      `Donut charts, icon cards, modular sections. No plain bar chart.`,
      `Footer text: Prem Iyer. Unique variation ${variationId}.`,
    ].join(' ')
  }

  if (tier === 'compact') {
    return [
      `Create a premium LinkedIn landscape infographic (wide 16:9).`,
      `Layout: ${layout.name} — ${layout.brief}.`,
      `Colors: ${palette}. Style: ${mood}.`,
      `Topic: ${topicLabel}. Theme: ${theme}.`,
      statsLine ? `Verified metrics only: ${statsLine}.` : 'No numbers — abstract shapes only.',
      `Use donut charts, icon rows, comparison panels, callout cards.`,
      `Avoid simple 3-bar charts. Dark editorial design.`,
      `Small footer: Prem Iyer · AI Software Transformation · ${variationId}.`,
    ].join('\n')
  }

  return [
    `Create a stunning premium LinkedIn landscape infographic, wide 16:9 format.`,
    `Layout: ${layout.name} — ${layout.brief}.`,
    `Palette: ${palette}. Visual mood: ${mood}.`,
    `Topic: ${topicLabel}. Story theme: ${theme}.`,
    statsLine ? `Include ONLY these verified numbers: ${statsLine}.` : 'No numeric text — use abstract icons and shapes.',
    `Composition: donut charts, icon grids, pictographs, modular sections, comparison panels.`,
    `Forbidden: plain vertical bar chart, people photos, invented statistics, long paragraphs.`,
    `Quality: high-end Visme/Piktochart data storytelling. Crisp typography, generous whitespace.`,
    `Footer: Prem Iyer · AI Software Transformation · variation ${variationId}.`,
  ].join('\n')
}

function buildGptImageBody({ model, prompt, size, quality }) {
  return {
    model,
    prompt: prompt.slice(0, 32000),
    n: 1,
    size,
    quality: quality || 'medium',
    output_format: 'png',
    moderation: 'low',
  }
}

function imageFromResponse(data) {
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) return null
  return `data:image/png;base64,${b64}`
}

async function requestImageProxy({ apiKey, prompt, model, size, quality }) {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, prompt, model, size, quality }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    return {
      ok: false,
      error: data.error || `Proxy HTTP ${res.status}`,
      status: data.status || res.status,
      model,
    }
  }
  return {
    ok: true,
    url: `data:image/png;base64,${data.b64}`,
    model: data.model || model,
    via: 'proxy',
  }
}

async function requestImageDirect({ apiKey, prompt, model, size, quality }) {
  const body = buildGptImageBody({ model, prompt, size, quality })
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data.error?.message || `Image API HTTP ${res.status}`, status: res.status, model }
  }
  const url = imageFromResponse(data)
  if (!url) return { ok: false, error: 'OpenAI returned no image data.', status: 500, model }
  return { ok: true, url, model, via: 'direct' }
}

async function requestImage(opts) {
  let proxyFail = null
  try {
    const proxy = await requestImageProxy(opts)
    if (proxy.ok) return proxy
    proxyFail = proxy
  } catch (err) {
    proxyFail = { ok: false, error: err?.message || 'Proxy unavailable', status: 0, model: opts.model }
  }

  try {
    const direct = await requestImageDirect(opts)
    if (direct.ok) return direct
    return direct.error ? direct : proxyFail || direct
  } catch (err) {
    return {
      ok: false,
      error: err?.message || proxyFail?.error || 'Network error calling OpenAI.',
      status: 0,
      model: opts.model,
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ATTEMPT_PLAN = [
  { model: 'gpt-image-1.5', size: '1536x1024', quality: 'medium', tier: 'compact', attempt: 0 },
  { model: 'gpt-image-1.5', size: '1536x1024', quality: 'low', tier: 'minimal', attempt: 1 },
  { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', tier: 'compact', attempt: 2 },
  { model: 'gpt-image-1', size: '1024x1024', quality: 'medium', tier: 'minimal', attempt: 3 },
  { model: 'gpt-image-1-mini', size: '1536x1024', quality: 'medium', tier: 'minimal', attempt: 4 },
  { model: 'gpt-image-1.5', size: '1024x1024', quality: 'high', tier: 'full', attempt: 5 },
]

export async function generateNewsroomImage({
  model,
  topicLabel,
  refreshSeed,
  postTheme,
  apiKey,
  onProgress,
}) {
  const key = (apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('openai_key') : '') || '').trim()
  if (!key) {
    return { ok: false, error: 'Add your OpenAI key in Settings first.' }
  }

  const errors = []
  for (let i = 0; i < ATTEMPT_PLAN.length; i++) {
    const cfg = ATTEMPT_PLAN[i]
    const stage =
      i === 0
        ? 'Creating your LinkedIn picture…'
        : i < 3
          ? 'Trying a different picture style…'
          : 'Trying alternate image model…'
    onProgress?.(10 + i * 14, stage)

    const recipe = pickInfographicRecipe(refreshSeed, cfg.attempt)
    const prompt = buildPrompt({
      model,
      topicLabel,
      refreshSeed,
      postTheme,
      recipe,
      tier: cfg.tier,
    })

    const result = await requestImage({
      apiKey: key,
      prompt,
      model: cfg.model,
      size: cfg.size,
      quality: cfg.quality,
    })

    if (result.ok) {
      onProgress?.(95, 'Picture ready')
      return {
        ok: true,
        url: result.url,
        styleName: recipe.layout.name,
        styleId: recipe.layout.id,
        variationId: ((refreshSeed >>> 0) + cfg.attempt).toString(16).slice(0, 6),
        imageModel: cfg.model,
        via: result.via,
      }
    }

    errors.push(`[${cfg.model} ${cfg.size}] ${result.error}`)
    if (result.status === 429) await sleep(4000)
    else if (i > 0) await sleep(800)
  }

  const lastRaw = errors[errors.length - 1] || 'Unknown error'
  const detail = errors.join(' · ')

  return {
    ok: false,
    error: humanizeImageError(lastRaw.replace(/^\[[^\]]+\]\s*/, '')),
    rawError: detail,
    allErrors: errors,
  }
}

export { buildPrompt, ATTEMPT_PLAN, requestImage }
