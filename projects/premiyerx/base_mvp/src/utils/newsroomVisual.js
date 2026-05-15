/**
 * Premium multi-section infographic prompts for DALL·E 3.
 * Visme / data-storytelling quality — NOT simple bar charts.
 */
import { fnv1a, mulberry32 } from './generationVariety'
import { pickFromPool } from './freshnessRotation'

const LAYOUT_TEMPLATES = [
  {
    id: 'impact-dashboard',
    name: 'Impact Dashboard',
    prompt: `Layout: professional data-storytelling infographic (Visme / Piktochart quality). TOP: bold headline strip. ROW 1: three large hero stat callouts in colored blocks (green #3EDC81, white, gray). ROW 2: three DONUT CHARTS (not bar charts) showing the verified percentages. ROW 3: pictograph row of 10 small icons with 7 highlighted + caption. Optional subtle world-map silhouette with pins. Modular sections divided by thin rules. NO simple vertical bar chart.`,
  },
  {
    id: 'comparison-vs',
    name: 'Comparison VS',
    prompt: `Layout: split-screen comparison infographic. Center: stylized "VS" divider. LEFT vs RIGHT panels with contrasting accent colors. Each side: row of human/enterprise icons, large percentage inside a circle, short label beneath. Clean flat design, high contrast on near-black background. Think "teens & technology" style comparison poster — NOT a bar chart.`,
  },
  {
    id: 'storytelling-modules',
    name: 'Storytelling Modules',
    prompt: `Layout: vertical storytelling infographic with 4 stacked modules separated by colored header bars. Mix chart types per module: one donut chart, one horizontal progress scale with icons, one icon grid (2x4), one callout box with large number. Each module has a small icon (megaphone, chart, building, lightbulb). Magazine editorial quality like a benchmark report. NO repetitive bar charts.`,
  },
  {
    id: 'feature-grid',
    name: 'Feature Grid',
    prompt: `Layout: smartphone-preference style grid. Header band with title. 2x4 icon grid with geometric icons and short labels. Center: nested bubble/circle chart with concentric rings showing metrics. Bottom: chevron process flow (5 arrows). Monochrome + green accent palette. Polished corporate infographic — NOT a basic chart.`,
  },
  {
    id: 'engagement-story',
    name: 'Engagement Story',
    prompt: `Layout: "impact of data visualization" style. Three hero metrics across top (large numbers with colored underlines). Middle: stylized map or network diagram with nodes. Bottom row: mixed visuals — donut + pictograph icons + short insight text block. Rich, multi-element composition. Premium LinkedIn thought-leadership graphic.`,
  },
]

const COLOR_PALETTES = [
  'near-black #0a0a0a background, white typography, accent #3EDC81 green sparingly',
  'charcoal #111 background, off-white text, accents in #3EDC81 and muted gold',
  'deep navy #0d1117 background, white headlines, #3EDC81 + soft blue highlights',
]

export function pickInfographicRecipe(refreshSeed) {
  const rng = mulberry32((refreshSeed ^ 0xabc123) >>> 0)
  const layout = LAYOUT_TEMPLATES[Math.floor(rng() * LAYOUT_TEMPLATES.length) % LAYOUT_TEMPLATES.length]
  const palette = pickFromPool(COLOR_PALETTES, refreshSeed, 'palette')
  return { layout, palette }
}

export function buildNewsroomDallePrompt({ model, topicLabel, refreshSeed, postTheme, recipe }) {
  const picked = recipe || pickInfographicRecipe(refreshSeed)
  const { layout, palette } = picked
  const statsBlock = (model?.verifiedStats || [])
    .slice(0, 4)
    .map((s) => `• ${s.value} — ${s.context} (source: ${s.source})`)
    .join('\n')

  const headline = model?.leadHeadline?.title || model?.hook || topicLabel
  const theme = postTheme || model?.implications?.[0] || 'enterprise AI software delivery'
  const variationId = `v${(refreshSeed >>> 0).toString(16).slice(0, 6)}`

  return [
    `Create a premium LinkedIn landscape infographic, exactly 1200x627 pixels.`,
    `STYLE: ${layout.prompt}`,
    `COLOR: ${palette}.`,
    `LAYOUT_ID: ${layout.id} · VARIATION: ${variationId} — this must look visually distinct from other variations.`,
    `TOPIC: ${topicLabel}.`,
    `NEWS ANGLE (visualize the idea, never paste headline text verbatim): ${headline.slice(0, 120)}.`,
    `POST THEME: ${theme.slice(0, 90)}.`,
    ``,
    `VERIFIED METRICS ONLY — use these exact numbers in charts/callouts:`,
    statsBlock || 'No numeric stats — use abstract shapes and icons only. Do NOT invent figures.',
    ``,
    `STRICT RULES:`,
    `- NO plain bar chart with 3 vertical bars and percentages (boring — forbidden).`,
    `- USE mixed visualization: donut charts, icon rows, pictographs, callout cards, comparison panels.`,
    `- NO long paragraphs of text in the image.`,
    `- NO stock photos of people.`,
    `- NO invented statistics beyond the verified list.`,
    `- Footer small text: "Prem Iyer · AI Software Transformation".`,
    `- Professional, publication-quality data journalism aesthetic.`,
  ].join('\n')
}

export async function generateNewsroomImage({ model, topicLabel, refreshSeed, postTheme, apiKey }) {
  const key = (apiKey || localStorage.getItem('openai_key') || '').trim()
  if (!key) return { ok: false, error: 'OpenAI key not saved on this device. Open Settings and paste your key.' }

  const recipe = pickInfographicRecipe(refreshSeed)
  const prompt = buildNewsroomDallePrompt({ model, topicLabel, refreshSeed, postTheme, recipe })

  async function requestImage(quality) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality,
        style: 'vivid',
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = err.error?.message || `Image API error ${res.status}`
      return { ok: false, error: message, status: res.status }
    }
    const data = await res.json()
    const url = data.data?.[0]?.url
    if (!url) return { ok: false, error: 'No image returned from OpenAI.' }
    return { ok: true, url }
  }

  let result = await requestImage('hd')
  if (!result.ok && result.status !== 400) {
    result = await requestImage('standard')
  }

  if (!result.ok) {
    const hint = /billing|quota|credit|payment|insufficient/i.test(result.error || '')
      ? ' Check billing at platform.openai.com/account/billing.'
      : /invalid.*api.*key|incorrect api key/i.test(result.error || '')
        ? ' Re-save your key in Settings.'
        : ''
    return { ok: false, error: `${result.error || 'Generation failed'}.${hint}` }
  }

  return {
    ok: true,
    url: result.url,
    styleName: recipe.layout.name,
    styleId: recipe.layout.id,
    variationId: (refreshSeed >>> 0).toString(16).slice(0, 6),
  }
}
