/**
 * Newsroom-style visual prompts (NYT Upshot, WaPo, LAT, Tribune editorial data graphics).
 * Uses ONLY registry-verified metrics in numeric form.
 */
import { fnv1a, mulberry32 } from './generationVariety'
import { pickFromPool } from './freshnessRotation'

const EDITORIAL_STYLES = [
  {
    id: 'upshot',
    name: 'NYT Upshot',
    prompt: `Editorial data graphic in the style of The New York Times Upshot section: off-white chart area on deep charcoal (#0a0a0a), thin gridlines, horizontal bar chart or dot plot, serif headline typography (like Cheltenham), small sans-serif source line, restrained green accent #3EDC81 for key data point only. No photographs of people. Clean newsroom infographic — not a marketing banner.`,
  },
  {
    id: 'wapo',
    name: 'Washington Post',
    prompt: `Editorial infographic in Washington Post visual style: bold condensed headline, red thin rule line under headline, stacked stat callout boxes with large numerals, muted gray body text, dark background. Data-journalism aesthetic — like their technology section explainers. No stock photo clichés.`,
  },
  {
    id: 'latimes',
    name: 'LA Times',
    prompt: `LA Times digital graphics style: strong typographic hierarchy, sidebar data panel with 2-3 large numbers, subtle texture, dark mode palette with single green highlight #3EDC81. Magazine-quality information design — chart + headline composition, not literal text-as-image.`,
  },
  {
    id: 'tribune',
    name: 'Chicago Tribune',
    prompt: `Chicago Tribune bold editorial graphic: heavy headline weight, three-column stat layout, classic newspaper infographic feel modernized for LinkedIn 1200x627. Dark background, high contrast white type, green accent for positive metrics. Professional news design — abstract geometric shapes suggesting growth/trend, not word cloud.`,
  },
]

const VISUAL_METAPHORS = [
  'Abstract ascending trend line connecting the stat callouts',
  'Split-panel before/after comparison with muted left vs highlighted right',
  'Circular progress rings for percentage metrics only',
  'Minimal isometric blocks representing enterprise software stack',
  'Timeline ribbon showing "this week" news moment',
]

export function pickEditorialStyle(refreshSeed) {
  const rng = mulberry32((refreshSeed ^ 0xabc123) >>> 0)
  const style = EDITORIAL_STYLES[Math.floor(rng() * EDITORIAL_STYLES.length) % EDITORIAL_STYLES.length]
  const metaphor = pickFromPool(VISUAL_METAPHORS, refreshSeed, 'metaphor')
  return { ...style, metaphor }
}

export function buildNewsroomDallePrompt({ model, topicLabel, refreshSeed, postTheme }) {
  const style = pickEditorialStyle(refreshSeed)
  const statsBlock = (model?.verifiedStats || [])
    .map((s) => `• ${s.value} — ${s.context} (source: ${s.source})`)
    .join('\n')

  const headline = model?.leadHeadline?.title || model?.hook || topicLabel
  const theme = postTheme || model?.implications?.[0] || 'enterprise AI software delivery'

  return [
    `LinkedIn landscape infographic 1200x627. ${style.prompt}`,
    `Visual metaphor: ${style.metaphor}.`,
    `Topic pillar: ${topicLabel}.`,
    `News context (visualize the IDEA, do not render as literal paragraph text): ${headline.slice(0, 140)}.`,
    `Post theme to echo visually: ${theme.slice(0, 100)}.`,
    `VERIFIED METRICS ONLY — render these exact numbers, no others:`,
    statsBlock || 'No numeric stats — use abstract editorial shapes only, no invented figures.',
    `STRICT: Do not invent statistics. Do not put long sentences of post copy in the image.`,
    `Include small footer: "Prem Iyer · AI Software Transformation".`,
    `Color palette: near-black background, white/gray typography, accent #3EDC81 sparingly.`,
  ].join('\n')
}

export async function generateNewsroomImage({ model, topicLabel, refreshSeed, postTheme, apiKey }) {
  const key = (apiKey || localStorage.getItem('openai_key') || '').trim()
  if (!key) return { ok: false, error: 'OpenAI key not saved on this device. Open Settings and paste your key.' }

  const prompt = buildNewsroomDallePrompt({ model, topicLabel, refreshSeed, postTheme })
  const style = pickEditorialStyle(refreshSeed)

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
        style: 'natural',
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

  let result = await requestImage('standard')
  if (!result.ok && result.status >= 500) {
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

  return { ok: true, url: result.url, styleName: style.name, styleId: style.id }
}
