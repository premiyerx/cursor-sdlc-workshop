/**
 * Premium editorial AI infographics — varied high-end visual languages (not one repeated template).
 * Uses GPT image models only — never sends response_format.
 */
import { mulberry32 } from './generationVariety'
import { pickFromPool } from './freshnessRotation'
import { getTopicNarrative } from '../data/topicNarratives'
import { buildNewsroomAlgorithmLine } from '../data/linkedinAlgorithm2026'
import { generateCreativeHeadline, pickCreativeCatalogHeadline, BANNED_REPEAT } from './creativeHeadlines.js'
import { formatStatForPrompt, sanitizeHeadlineGrammar } from './factualClaims.js'
import { buildBreakingNewsVisualRules, registrySourceIsFreshEnough } from './dateFreshness.js'
import { getOpenAiKey } from './openaiKey'
import { getActiveBrandTheme, brandFooter, brandCarouselColors } from '../data/brandTokens.js'

/** Rotating “families” = quality bar (polish, hierarchy) without locking every image to the same newspaper trope. */
const EDITORIAL_FAMILIES = [
  {
    id: 'news-data-desk',
    label: 'Newsroom data spread',
    styleLines: [
      'VISUAL FAMILY: Premium newspaper / Upshot-style data desk — crisp modular grid, editorial serif + clean sans, generous whitespace.',
      'Light or soft newsprint background; charts feel researched and labeled, not decorative clipart.',
    ],
  },
  {
    id: 'annual-report',
    label: 'Executive annual report',
    styleLines: [
      'VISUAL FAMILY: Top-tier annual report / strategy memo — wide margins, restrained color, confident typography, “one idea per spread”.',
      'Favor narrative flow with 1–2 strong visuals rather than a wall of small charts.',
    ],
  },
  {
    id: 'magazine-feature',
    label: 'Magazine feature layout',
    styleLines: [
      'VISUAL FAMILY: Long-form magazine feature (think Wired, Rest of World, Monocle) — asymmetric columns, bold display type, editorial illustration accents.',
      'Mix typographic hooks with abstract shapes or isometric hints; avoid stock-photo humans.',
    ],
  },
  {
    id: 'keynote-minimal',
    label: 'Keynote clarity',
    styleLines: [
      'VISUAL FAMILY: Apple-style keynote clarity — very few elements, huge focal number or short headline, subtle depth, museum-like restraint.',
      'If you use a chart, make it singular and iconic; otherwise let type and one diagram carry the story.',
    ],
  },
  {
    id: 'swiss-poster',
    label: 'Swiss poster system',
    styleLines: [
      'VISUAL FAMILY: Swiss / International Typographic poster — strong grid, mono or grotesk sans, one dominant accent color, geometric blocks.',
      'Data can appear as bold figures and simple geometric charts (bars, rings, steps), not busy dashboards.',
    ],
  },
  {
    id: 'financial-editorial',
    label: 'Financial editorial',
    styleLines: [
      'VISUAL FAMILY: Financial / business editorial (Bloomberg Businessweek energy, FT weekend) — confident headlines, sharp contrast, ink-like graphics.',
      'Background may be off-white, soft gray, or deep navy with light type if contrast stays luxury-grade.',
    ],
  },
  {
    id: 'diagram-editorial',
    label: 'Explainer diagram',
    styleLines: [
      'VISUAL FAMILY: Explainer / schematic editorial — one clear “system diagram”, pipeline, layered stack, or before→after story with callouts.',
      'Labels are short and legible; whitespace guides the eye; avoid duplicating the same Sankey trope unless it truly fits.',
    ],
  },
]

const LAYOUT_RECIPES = [
  {
    id: 'flow-story',
    name: 'Flow story',
    brief: 'one primary flow story (Sankey, waterfall, funnel, or stage ribbon) — only if it fits the stats; otherwise use a stepped timeline or pipeline schematic',
  },
  {
    id: 'split-panel',
    name: 'Split thesis',
    brief: 'two-panel “then vs now” or “cost vs value” composition with a strong central hinge or dividing rule',
  },
  {
    id: 'hero-figure',
    name: 'Hero figure',
    brief: 'typographic hero: one dominant KPI or ROI figure with supporting micro-stats in a quiet secondary band',
  },
  {
    id: 'small-multiples',
    name: 'Small multiples',
    brief: 'row or grid of 3–5 small matching charts (spark strips, slope mini-panels, or paired bars) sharing one scale language',
  },
  {
    id: 'radar-polar',
    name: 'Radar summary',
    brief: 'single polar / radar / petal chart summarizing dimensions — keep labels minimal and elegant',
  },
  {
    id: 'isometric-schematic',
    name: 'Isometric stack',
    brief: 'isometric or layered “stack” diagram (platform layers, value stack, or toolchain) with short callouts',
  },
  {
    id: 'narrative-columns',
    name: 'Editorial columns',
    brief: 'multi-column editorial layout with pull quote, one medium chart, and a kicker rail — magazine, not slide deck',
  },
  {
    id: 'big-chart-deck',
    name: 'Single hero chart',
    brief: 'one large, impeccably styled chart (grouped bars, area, dot plot, or donut cluster) plus annotation callouts — no mandatory second chart',
  },
  {
    id: 'timeline-arc',
    name: 'Timeline arc',
    brief: 'horizontal timeline or journey arc with milestones and one cumulative or payoff visualization',
  },
  {
    id: 'waterfall-narrative',
    name: 'Waterfall narrative',
    brief: 'waterfall or bridge chart as the spine of the story, with short annotations tied to verified figures',
  },
]

const EDITORIAL_PALETTES = [
  'white and warm cream background, black serif headlines, navy subheads, muted blue/green/gold accents',
  'off-white newsprint, charcoal type, burgundy rule lines, teal and slate chart colors',
  'soft gray field, deep indigo headlines, copper accent, restrained chart palette',
  'deep navy background, warm off-white type, single electric blue or mint accent — luxury contrast, no neon',
  'near-black charcoal, ivory headlines, gold foil accent, sparse ink-style graphics',
  'paper white, single bold spot color (coral or kelly green) plus black and cool gray',
  'frosted light gradient, glassy subtle panels, dark graphite text — modern premium UI-adjacent but still editorial',
]

const SECTION_KICKERS = [
  'The Business of AI',
  'Data Desk',
  'Enterprise Analysis',
  'Signal & Noise',
  'By the Numbers',
  'Field Notes',
  'The Thesis',
  'What Changed',
  'Lens: ROI',
]

function resolveInfographicTitle(creativeHeadline, topicId, postTheme, refreshSeed) {
  let title = (creativeHeadline || '').trim()
  if (!title || BANNED_REPEAT.test(title) || /where capital is flowing in ai software/i.test(title)) {
    title = pickCreativeCatalogHeadline({
      topicId,
      refreshSeed: refreshSeed >>> 0,
      headlineGuard: new Set(),
      postSnippet: postTheme || '',
    })
  }
  return sanitizeHeadlineGrammar(title)
}

function formatBreakingWireBlock(infographicModel) {
  const lead = infographicModel?.leadHeadline
  if (!lead?.title) {
    return 'No wire headline available — use TODAY\'s date in the kicker and avoid inventing historical year labels.'
  }
  return [
    `WIRE ANCHOR (build the visual around this — paraphrase, do not copy verbatim):`,
    `"${lead.title}" — ${lead.source}${lead.date ? `, published ${lead.date}` : ''}`,
    'All chart labels and callouts must relate to this week\'s story, not 2023/2024 retrospectives.',
  ].join('\n')
}

/** Each run picks a few of these — not every image needs Sankey + sidebar + five KPIs. */
const VIZ_ELEMENT_POOL = [
  'One hero data visualization (choose what fits: waterfall, grouped bars, slope chart, stream segment, donut cluster, funnel, or a restrained flow — avoid defaulting to Sankey unless the story is genuinely about flows).',
  'A typographic anchor: one oversized figure or 2–4 word headline stat that carries the visual weight.',
  'Either a compact icon-led metric row OR clean typographic KPI rows — not both unless space allows.',
  'Optional narrow rail or callout for one sharp takeaway (can merge into the main column instead of a boxed cliché).',
  'At most one secondary mini-chart or spark row — omit if it would duplicate the hero story.',
  'Optional timeline that ENDS in the current month/year (never stop at 2023 or 2024), or a before/after strip without obsolete year labels.',
  'Optional abstract metaphor (isometric blocks, layers, pipeline nodes) — schematic, not cheesy 3D clipart.',
  'Generous whitespace and a single clear focal path; resist filling every inch with charts and tables.',
]

function shufflePick(pool, rng, count) {
  const idx = pool.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, Math.min(count, pool.length)).map((i) => pool[i])
}

export function pickInfographicRecipe(refreshSeed, attempt = 0) {
  const rng = mulberry32((refreshSeed ^ (attempt * 0x9e3779b9)) >>> 0)
  const family = EDITORIAL_FAMILIES[Math.floor(rng() * EDITORIAL_FAMILIES.length) % EDITORIAL_FAMILIES.length]
  const layout = LAYOUT_RECIPES[Math.floor(rng() * LAYOUT_RECIPES.length) % LAYOUT_RECIPES.length]
  const palette = pickFromPool(EDITORIAL_PALETTES, refreshSeed + attempt * 3, 'palette')
  const kicker = pickFromPool(SECTION_KICKERS, refreshSeed + attempt * 5, 'kicker')
  const vizOrdered = shufflePick(VIZ_ELEMENT_POOL, rng, VIZ_ELEMENT_POOL.length)
  const vizFull = vizOrdered.slice(0, 4)
  const vizCompact = vizOrdered.slice(0, 3)
  return { family, layout, palette, kicker, vizFull, vizCompact }
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
  const fresh = (stats || []).filter((s) => registrySourceIsFreshEnough(s.source))
  if (!fresh.length) {
    return [
      'No statistics with sources from the last 30 days — use abstract KPI shapes only.',
      'Do NOT invent dollar amounts, percents, or year labels (especially 2023/2024).',
      'Let the headline wire and today\'s date carry the story.',
    ].join('\n')
  }
  return fresh
    .slice(0, 5)
    .map((s, i) => formatStatForPrompt(s, i))
    .join('\n')
}

function buildPrompt({
  infographicModel,
  topicId,
  topicLabel,
  refreshSeed,
  postTheme,
  recipe,
  tier = 'full',
  creativeHeadline = '',
}) {
  const fullRecipe = recipe || pickInfographicRecipe(refreshSeed)
  const { family, layout, palette, kicker, vizFull, vizCompact } = fullRecipe
  const brand = getActiveBrandTheme()
  const footer = brand.footer
  const narrative = getTopicNarrative(topicId)
  const stats = (infographicModel?.verifiedStats || []).slice(0, 5)
  const theme = (postTheme || infographicModel?.hook || narrative.coreThesis || '').slice(0, 120)
  const headline = resolveInfographicTitle(creativeHeadline, topicId, theme, refreshSeed)
  const leadLine = infographicModel?.leadHeadline?.title?.slice(0, 90) || theme
  const statsBlock = formatStatsBlock(stats)
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const breakingRules = buildBreakingNewsVisualRules()
  const wireBlock = formatBreakingWireBlock(infographicModel)

  const qualityPreamble = [
    'QUALITY BAR: Publication-grade LinkedIn infographic (landscape ~16:9, 1536×1024).',
    'TEXT DISCIPLINE (CRITICAL — image models garble long text into gibberish): Render ONLY very short, large, correctly-spelled text. Headline = 3–6 words MAX. Each number gets a label of 4 words MAX. Absolutely NO sentences, NO paragraphs, NO body copy, NO captions, NO fine print, NO multi-line descriptions. If the Title provided below is longer than 6 words, shorten it yourself to the 3–6 most important words. When in doubt, show fewer words and let one big number carry the story. Every rendered character must be large enough to read on a phone and spelled perfectly — a long garbled headline kills engagement.',
    'MOBILE-FIRST: Phone feed (~390px wide). Default visual story = ONE dominant number or ONE simple chart — not a dashboard collage. Headline type must dominate; axis labels large enough to read without zoom.',
    'Prioritize clarity, typography, and believable visual hierarchy — *high-end fidelity*, not the same layout every time.',
    'Vary composition, chart species, and graphic language between generations; avoid cookie-cutter “ROI dashboard” sameness (identical Sankey + sidebar + metric strip).',
    ...family.styleLines,
    `BRAND PALETTE (keep consistent across all my posts): ${brand.palettePrompt}.`,
    `Optional secondary mood cue (stay within the brand palette above): ${palette}.`,
  ].join('\n')

  if (tier === 'minimal') {
    const prios = (vizCompact || []).slice(0, 2)
    return [
      qualityPreamble,
      breakingRules,
      wireBlock,
      `Headline: "${headline}". Section kicker: "${kicker}". Date: ${today}.`,
      `Topic angle: ${narrative.label}. ${leadLine}.`,
      `Primary composition: ${layout.name} — ${layout.brief}.`,
      prios.length ? ['', 'VISUAL PRIORITIES (this run):', ...prios.map((v, i) => `${i + 1}. ${v}`)].join('\n') : '',
      `Verified numbers ONLY:\n${statsBlock}`,
      `One clear focal insight from the stats (callout, big figure, or simple chart — designer's choice).`,
      `Small footer only: ${footer}. No version codes, build IDs, hashes, or deploy stamps.`,
      buildNewsroomAlgorithmLine(),
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (tier === 'compact') {
    const prios = vizCompact || []
    return [
      qualityPreamble,
      breakingRules,
      wireBlock,
      `Create a landscape LinkedIn infographic titled "${headline}".`,
      `Kicker: "${kicker}" · ${today}.`,
      `Story angle: ${narrative.coreThesis}`,
      `Hook line (paraphrase, do not copy): ${leadLine}`,
      '',
      'STRUCTURE (adapt to the visual family — omit sections that would clutter):',
      `• Title + kicker`,
      `• Hero: ${layout.name} — ${layout.brief}`,
      '• Verified figures integrated cleanly (short labels, no walls of text)',
      '',
      'VISUAL PRIORITIES (this run):',
      ...prios.map((v, i) => `${i + 1}. ${v}`),
      '',
      'VERIFIED NUMBERS (use ONLY these — do not invent others):',
      statsBlock,
      '',
      'RULES: intentional hierarchy, legible labels, credible tone; no invented statistics.',
      `Footer only: ${footer}. No version codes or build IDs.`,
      'Dates on charts: use the current month/year only, or a timeline that includes the current year — never a lone 2024/2025 stat as “this week”.',
      buildNewsroomAlgorithmLine(),
    ].join('\n')
  }

  const prios = vizFull || []
  return [
    qualityPreamble,
    breakingRules,
    wireBlock,
    `Title: "${headline}"`,
    `Kicker: "${kicker}" · ${today}`,
    '',
    `AUDIENCE: ${narrative.audience}`,
    `CORE THESIS: ${narrative.coreThesis}`,
    `THIS WEEK'S ANGLE: ${leadLine}`,
    '',
    `PRIMARY COMPOSITION: ${layout.name} — ${layout.brief}`,
    '',
    'VISUAL PRIORITIES (this run — lean into these; drop dashboard clichés that are not implied above):',
    ...prios.map((v, i) => `${i + 1}. ${v}`),
    '',
    'VERIFIED DATA (use ONLY these numbers and sources):',
    statsBlock,
    '',
    'FORBIDDEN: invented statistics, illegible micro-labels, stock photos of people, tacky neon gamer UI, clip-art icons, or samey template filler.',
    'FORBIDDEN: "500+" or any count above 500 paired with "Fortune 500" — the F500 list has exactly 500 companies. Use the percentage from VERIFIED DATA, or "majority of Fortune 500".',
    'GRAMMAR: headlines must use "back to the terminal" (with "the"), not "back terminal".',
    `Credit line only: ${footer}. No version codes, build IDs, or hex stamps.`,
    'Any year labels must be current or an explicit multi-year timeline — not a random 2024/2025 datapoint.',
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
  const key = (apiKey || getOpenAiKey() || '').trim()
  if (!key) {
    return { ok: false, error: 'Add your OpenAI key under API Keys (welcome area) first.' }
  }

  const postThemeText = postTheme || model?.hook || ''
  const creativeHeadline = await generateCreativeHeadline({
    topicId,
    topicLabel: topicLabel || model?.topicLabel,
    postText: postThemeText,
    leadHeadlineTitle: model?.leadHeadline?.title || '',
    refreshSeed,
    variantKey: 'newsroom',
  })

  const errors = []
  for (let i = 0; i < ATTEMPT_PLAN.length; i++) {
    const cfg = ATTEMPT_PLAN[i]
    const stage =
      i === 0
        ? 'Creating your infographic…'
        : i < 3
          ? 'Trying a different visual angle…'
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
      creativeHeadline,
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
        styleName: `${recipe.family.label} · ${recipe.layout.name}`,
        styleId: `${recipe.family.id}-${recipe.layout.id}`,
        creativeHeadline,
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

/**
 * Prompt for a single carousel “platform” slide image — meaningful diagram/chart only
 * (not the old decorative THEMES/SCOPE strip + anonymous sparkline).
 */
export function buildCarouselPlatformSlidePrompt({
  topicLabel,
  titleMain,
  titleAccent,
  bodyText,
  trioHints = [],
}) {
  const body = String(bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 520)
  const trio = (trioHints || []).filter(Boolean).slice(0, 3).join(' | ')
  const c = brandCarouselColors()
  return [
    'Create ONE infographic image for a single slide in a LinkedIn PDF carousel (portrait 4:5 page; this art sits in a WIDE horizontal band ~980×700px).',
    `Visual framing (match my brand exactly): background ${c.bg}, typography ${c.ink}, accent ${c.accent} for highlights and connectors — high-contrast editorial or financial print style.`,
    '',
    `Topic label: ${topicLabel || 'AI × software delivery'}.`,
    `Slide headline (capture the idea, do not paste as a dense wall of text): ${String(titleMain || '').slice(0, 200)} — ${String(titleAccent || '').slice(0, 140)}.`,
    `Supporting copy (paraphrase into chart labels; do NOT invent $ or % figures unless they appear here): ${body}`,
    trio ? `Three beats as ONE left-to-right flow (3 equal stages, short labels under each icon): ${trio}` : '',
    '',
    'DRAW ONE horizontal flow or comparison: exactly 3 stages (Plan → Ship → Prove style) with LARGE 2–4 word labels and 1 short line each — every label fully inside the frame with generous padding (nothing clipped at edges).',
    'Landscape composition (~3:2): icons + arrows in one row; no paragraphs; no text below the diagram band.',
    '',
    'DO NOT: fake dashboards, meaningless sparklines, tiny unreadable text, stock photos of people, generic clipart, duplicate caption columns under the art, or any 8-tab “THEMES / SCOPE / …” navigation strip.',
    'DO NOT invent KPIs. Never label "500+ Fortune 500" — use the percentage from VERIFIED DATA, or "majority of Fortune 500", only if the supporting copy includes it.',
    '',
    `Small footer: ${brandFooter()}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** One-shot GPT image for the carousel platform slide (uses saved OpenAI key + /api/generate-image proxy when deployed). */
export async function generateCarouselPlatformGraphic({
  topicId: _topicId = '',
  topicLabel,
  titleMain,
  titleAccent,
  body,
  trio,
  apiKey,
} = {}) {
  const key = (apiKey || getOpenAiKey() || '').trim()
  if (!key) {
    return { ok: false, error: 'Add your OpenAI key under API Keys (welcome area) first.' }
  }
  const hints = Array.isArray(trio)
    ? trio.map((t) => `${t?.title || ''}: ${String(t?.sub || '').replace(/\s+/g, ' ').trim().slice(0, 140)}`)
    : []
  const prompt = buildCarouselPlatformSlidePrompt({
    topicLabel,
    titleMain,
    titleAccent,
    bodyText: body,
    trioHints: hints,
  })
  const result = await requestImage({
    apiKey: key,
    prompt,
    model: 'gpt-image-1.5',
    size: '1536x1024',
    quality: 'medium',
  })
  if (result.ok) return { ok: true, url: result.url, model: result.model, via: result.via }
  return { ok: false, error: result.error || 'Image generation failed', status: result.status }
}

export { buildPrompt, ATTEMPT_PLAN, requestImage }
