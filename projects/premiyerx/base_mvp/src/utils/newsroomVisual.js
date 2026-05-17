/**
 * Newspaper-style AI infographic generation (NYT / LAT / WaPo data journalism aesthetic).
 * Uses GPT image models only — never sends response_format.
 */
import { mulberry32 } from './generationVariety'
import { pickFromPool } from './freshnessRotation'
import { getTopicNarrative } from '../data/topicNarratives'
import { buildNewsroomAlgorithmLine } from '../data/linkedinAlgorithm2026'

const NEWSPAPER_LAYOUTS = [
  {
    id: 'sankey-roi',
    name: 'Sankey ROI Flow',
    brief: 'large Sankey/alluvial flow diagram showing investment flowing into benefit categories with dollar labels and percentages',
  },
  {
    id: 'executive-briefing',
    name: 'Executive Briefing',
    brief: 'left column narrative + right column "The Bottom Line" callout box with hero ROI number',
  },
  {
    id: 'metrics-grid',
    name: 'Key Metrics Grid',
    brief: 'vertical list of 5-6 KPI metrics with icons, plus small sparkline or area chart at bottom',
  },
  {
    id: 'dual-chart',
    name: 'Dual Chart Spread',
    brief: 'two coordinated charts side by side — e.g. productivity lift bar chart + cumulative benefit line chart',
  },
  {
    id: 'newspaper-columns',
    name: 'Newspaper Columns',
    brief: 'classic 3-column newspaper layout with headline, subheads, pull quote, and embedded charts',
  },
]

const NEWSPAPER_PALETTES = [
  'white and warm cream background, black serif headlines, navy subheads, muted blue/green/gold flow colors',
  'off-white newsprint background, charcoal text, burgundy accent lines, blue and teal chart colors',
  'light gray background, Times-style serif masthead, Washington Post blue accents, clean data colors',
]

const SECTION_KICKERS = [
  'The Business of AI',
  'Data Desk',
  'Enterprise Analysis',
  'The Bottom Line',
  'By the Numbers',
]

const TOPIC_HEADLINES = {
  roi: 'The ROI of AI in Software Development',
  cursor: 'The Business Case for AI-Native Software Development',
  investment: 'Where Capital Is Flowing in AI Software Development',
  cio: 'What Technology Leaders Must Know About AI in the SDLC',
}

export function pickInfographicRecipe(refreshSeed, attempt = 0) {
  const rng = mulberry32((refreshSeed ^ (attempt * 0x9e3779b9)) >>> 0)
  const layout = NEWSPAPER_LAYOUTS[Math.floor(rng() * NEWSPAPER_LAYOUTS.length) % NEWSPAPER_LAYOUTS.length]
  const palette = pickFromPool(NEWSPAPER_PALETTES, refreshSeed + attempt, 'palette')
  const kicker = pickFromPool(SECTION_KICKERS, refreshSeed + attempt * 5, 'kicker')
  return { layout, palette, kicker }
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

function formatStatsBlock(stats = []) {
  if (!stats.length) return 'Use abstract KPI shapes only — do not invent numbers.'
  return stats
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.value} — ${s.context?.slice(0, 40) || 'metric'} (source: ${s.source || 'verified registry'})`)
    .join('\n')
}

function buildPrompt({ infographicModel, topicId, topicLabel, refreshSeed, postTheme, recipe, tier = 'full' }) {
  const { layout, palette, kicker } = recipe || pickInfographicRecipe(refreshSeed)
  const narrative = getTopicNarrative(topicId)
  const stats = (infographicModel?.verifiedStats || []).slice(0, 5)
  const headline = TOPIC_HEADLINES[topicId] || `The ROI of ${topicLabel || narrative.label}`
  const theme = (postTheme || infographicModel?.hook || narrative.coreThesis || '').slice(0, 120)
  const leadLine = infographicModel?.leadHeadline?.title?.slice(0, 90) || theme
  const statsBlock = formatStatsBlock(stats)
  const variationId = `v${((refreshSeed >>> 0) + (tier === 'minimal' ? 99 : tier === 'compact' ? 55 : 0)).toString(16).slice(0, 6)}`
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const newspaperStyle = [
    'STYLE: Sophisticated newspaper data journalism infographic.',
    'Must feel like New York Times, LA Times, Chicago Tribune, or Washington Post — NOT a dark tech slide, NOT a simple 3-bar chart, NOT a Canva template.',
    'Light/white newsprint background, elegant serif headline font, clean sans-serif labels, professional grid layout, generous whitespace.',
    `Color palette: ${palette}.`,
  ].join('\n')

  if (tier === 'minimal') {
    return [
      newspaperStyle,
      `Headline: "${headline}". Section kicker: "${kicker}". Date: ${today}.`,
      `Topic angle: ${narrative.label}. ${leadLine}.`,
      `Hero visual: ${layout.brief}.`,
      `Verified numbers ONLY:\n${statsBlock}`,
      `Include "The Bottom Line" sidebar with one big ROI or impact number from the stats above.`,
      `Small footer: Prem Iyer · AI Software Transformation · ${variationId}.`,
      buildNewsroomAlgorithmLine(),
    ].join('\n')
  }

  if (tier === 'compact') {
    return [
      newspaperStyle,
      `Create a landscape LinkedIn infographic (1536x1024) titled "${headline}".`,
      `Section header: "${kicker}" · ${today}.`,
      `Story angle: ${narrative.coreThesis}`,
      `News hook (paraphrase, do not copy): ${leadLine}`,
      '',
      'LAYOUT SECTIONS:',
      `1. MASTHEAD — bold serif headline + thin rule line`,
      `2. HERO VIZ — ${layout.name}: ${layout.brief}`,
      '   If Sankey-style: show investment/cost on left flowing into 3-4 benefit streams on right with dollar amounts and % labels',
      `3. SIDEBAR — "The Bottom Line" box with large hero metric (e.g. ROI multiple or payback) derived from verified stats`,
      '4. KEY METRICS — vertical list of 5 metrics with small icons (clock, chart, shield, code, dollar)',
      '5. BOTTOM STRIP — two small charts: productivity lift + cumulative benefit over time',
      '6. SOURCE LINE — small italic source attributions under charts',
      '',
      'VERIFIED NUMBERS (use ONLY these — do not invent others):',
      statsBlock,
      '',
      'RULES: sophisticated flows and charts, strong visual hierarchy, accurate-looking data labels, no people photos, no walls of text.',
      `Footer: Prem Iyer · AI Software Transformation · ${variationId}.`,
      buildNewsroomAlgorithmLine(),
    ].join('\n')
  }

  return [
    newspaperStyle,
    `Generate an infographic that looks like premium newspaper data journalism for LinkedIn (landscape 16:9).`,
    `Title: "${headline}"`,
    `Kicker: "${kicker}" · ${today}`,
    '',
    `AUDIENCE: ${narrative.audience}`,
    `CORE THESIS: ${narrative.coreThesis}`,
    `THIS WEEK'S ANGLE: ${leadLine}`,
    '',
    'REQUIRED VISUAL ELEMENTS (all must appear):',
    '• Large Sankey or alluvial flow diagram — investment/cost flows into 3-4 benefit categories with $ and % labels',
    '• "The Bottom Line" callout — oversized hero number (ROI multiple, payback months, or net benefit)',
    '• "Key Metrics" sidebar — 5-6 metrics with clean icons and short labels',
    '• At least one additional chart (bar, line, or area) showing trend over time',
    '• Source attribution line in small italic type',
    `• Primary layout emphasis: ${layout.name} — ${layout.brief}`,
    '',
    'VERIFIED DATA (use ONLY these numbers and sources):',
    statsBlock,
    '',
    'QUALITY BAR: Match the sophistication of ChatGPT-generated NYT-style ROI infographics.',
    'Strong flows, multiple chart types, elegant typography, credible source lines.',
    'FORBIDDEN: dark background, neon colors, plain 3-bar chart as the only viz, invented statistics, stock photos.',
    `Small credit line: Prem Iyer · AI Software Transformation · ${variationId}.`,
    buildNewsroomAlgorithmLine(),
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
  { model: 'gpt-image-1.5', size: '1536x1024', quality: 'high', tier: 'full', attempt: 0 },
  { model: 'gpt-image-1.5', size: '1536x1024', quality: 'medium', tier: 'compact', attempt: 1 },
  { model: 'gpt-image-1', size: '1536x1024', quality: 'high', tier: 'full', attempt: 2 },
  { model: 'gpt-image-1.5', size: '1536x1024', quality: 'medium', tier: 'compact', attempt: 3 },
  { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', tier: 'minimal', attempt: 4 },
  { model: 'gpt-image-1-mini', size: '1536x1024', quality: 'medium', tier: 'minimal', attempt: 5 },
]

export async function generateNewsroomImage({
  model,
  topicId = '',
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
        ? 'Creating newspaper-style infographic…'
        : i < 3
          ? 'Trying a different layout…'
          : 'Trying alternate image model…'
    onProgress?.(10 + i * 14, stage)

    const recipe = pickInfographicRecipe(refreshSeed, cfg.attempt)
    const prompt = buildPrompt({
      infographicModel: model,
      topicId,
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
      onProgress?.(95, 'Infographic ready')
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
