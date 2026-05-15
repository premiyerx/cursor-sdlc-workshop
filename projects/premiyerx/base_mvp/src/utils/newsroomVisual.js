/**
 * Premium LinkedIn infographic image generation via OpenAI.
 * Tries multiple models, sizes, and prompt lengths. Surfaces real API errors.
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
  'black background, white type, green accents',
  'charcoal background, off-white type, green and gold accents',
  'navy background, white headlines, green and blue accents',
]

export function pickInfographicRecipe(refreshSeed, attempt = 0) {
  const rng = mulberry32((refreshSeed ^ (attempt * 0x9e3779b9)) >>> 0)
  const layout = LAYOUT_TEMPLATES[Math.floor(rng() * LAYOUT_TEMPLATES.length) % LAYOUT_TEMPLATES.length]
  const palette = pickFromPool(COLOR_PALETTES, refreshSeed + attempt, 'palette')
  return { layout, palette }
}

export function humanizeImageError(raw = '') {
  const msg = String(raw || '').trim()
  if (!msg) {
    return 'OpenAI did not return a reason. Tap New graphic angle to try again.'
  }
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return `Connection problem reaching OpenAI. Check signal or Wi‑Fi, then try again. (${msg})`
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
    return `OpenAI blocked this picture. Tap New graphic angle for a different layout. ${msg}`
  }
  if (/rate.limit|too many requests/i.test(msg)) {
    return `OpenAI is busy — wait 30 seconds and try again. ${msg}`
  }
  return msg
}

function buildPrompt({ model, topicLabel, refreshSeed, postTheme, recipe, tier = 'full' }) {
  const { layout, palette } = recipe || pickInfographicRecipe(refreshSeed)
  const stats = (model?.verifiedStats || []).slice(0, 3)
  const statsLine = stats.map((s) => s.value).join(', ')
  const theme = (postTheme || model?.hook || topicLabel || 'technology leadership').slice(0, 60)
  const variationId = `v${((refreshSeed >>> 0) + (tier === 'minimal' ? 99 : 0)).toString(16).slice(0, 6)}`

  if (tier === 'minimal') {
    return [
      `Professional LinkedIn infographic, landscape 16:9.`,
      `Dark ${palette}. ${layout.brief}.`,
      `Topic: ${topicLabel || theme}.`,
      statsLine ? `Show these numbers only: ${statsLine}.` : 'Use abstract icons, no numbers.',
      `Donut charts, icons, callout cards. No plain bar chart.`,
      `Footer: Prem Iyer. Variation ${variationId}.`,
    ].join(' ')
  }

  if (tier === 'compact') {
    return [
      `Premium LinkedIn landscape infographic.`,
      `Layout: ${layout.name} (${layout.brief}). Colors: ${palette}.`,
      `Topic: ${topicLabel}. Theme: ${theme}.`,
      statsLine ? `Verified metrics only: ${statsLine}.` : 'Abstract shapes only, no invented numbers.',
      `Donut charts, icon rows, comparison panels. No boring 3-bar chart.`,
      `Dark editorial design. Small footer: Prem Iyer · AI Software Transformation.`,
    ].join(' ')
  }

  return [
    `Create a premium LinkedIn landscape infographic, wide 16:9 format.`,
    `Layout style: ${layout.name} — ${layout.brief}.`,
    `Color palette: ${palette}.`,
    `Topic: ${topicLabel}. Visual theme: ${theme}.`,
    statsLine ? `Include ONLY these verified numbers: ${statsLine}.` : 'No numbers — use abstract icons and shapes only.',
    `Use donut charts, icon rows, pictographs, modular sections.`,
    `Do not use a simple vertical bar chart. No people photos. No invented statistics.`,
    `High-end data storytelling infographic quality. Footer: Prem Iyer · AI Software Transformation. Variation ${variationId}.`,
  ].join('\n')
}

async function requestImage({ apiKey, prompt, model, size, quality, style }) {
  try {
    const body = {
      model,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      response_format: 'b64_json',
    }
    if (model === 'dall-e-3') {
      body.quality = quality || 'standard'
      if (style) body.style = style
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data.error?.message || `Image API HTTP ${res.status}`
      return { ok: false, error: message, status: res.status, model }
    }

    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return { ok: false, error: 'OpenAI returned no image data.', status: 500, model }
    }

    return {
      ok: true,
      url: `data:image/png;base64,${b64}`,
      model,
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Network error calling OpenAI.',
      status: 0,
      model,
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Try several models, sizes, and prompt tiers until one succeeds.
 */
export async function generateNewsroomImage({
  model,
  topicLabel,
  refreshSeed,
  postTheme,
  apiKey,
  onProgress,
}) {
  const key = (apiKey || localStorage.getItem('openai_key') || '').trim()
  if (!key) {
    return { ok: false, error: 'Add your OpenAI key in Settings first.' }
  }

  const attempts = [
    { model: 'dall-e-3', size: '1024x1024', quality: 'standard', style: 'vivid', tier: 'minimal', attempt: 0 },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', style: 'vivid', tier: 'compact', attempt: 1 },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', style: 'natural', tier: 'compact', attempt: 2 },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', style: null, tier: 'full', attempt: 3 },
    { model: 'gpt-image-1', size: '1536x1024', quality: null, style: null, tier: 'minimal', attempt: 4 },
    { model: 'gpt-image-1', size: '1024x1024', quality: null, style: null, tier: 'compact', attempt: 5 },
  ]

  const errors = []
  for (let i = 0; i < attempts.length; i++) {
    const cfg = attempts[i]
    const stage =
      i === 0
        ? 'Creating your LinkedIn picture…'
        : i < 4
          ? 'Trying a different picture style…'
          : 'Trying alternate image model…'
    onProgress?.(12 + i * 14, stage)

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
      style: cfg.style,
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
      }
    }

    errors.push(`[${cfg.model} ${cfg.size}] ${result.error}`)
    if (result.status === 429) await sleep(3000)
  }

  const lastRaw = errors[errors.length - 1] || 'Unknown error'
  const detail = errors.slice(-3).join(' · ')

  return {
    ok: false,
    error: humanizeImageError(lastRaw.replace(/^\[[^\]]+\]\s*/, '')),
    rawError: detail,
    allErrors: errors,
  }
}
