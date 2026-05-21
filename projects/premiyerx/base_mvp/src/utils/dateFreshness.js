/** Max age for cited stats, headlines, and chart labels (creation day = today). */
export const FRESH_STAT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
export const FRESH_HEADLINE_MAX_DAYS = 30

const OBSOLETE_CHART_YEARS = new Set([2020, 2021, 2022, 2023, 2024])

export function referenceDate(ref = new Date()) {
  return ref instanceof Date ? ref : new Date(ref)
}

export function freshCutoffIso(ref = new Date()) {
  const d = referenceDate(ref)
  return new Date(d.getTime() - FRESH_STAT_WINDOW_MS).toISOString()
}

export function headlineAgeDays(isoDate) {
  if (!isoDate) return Number.POSITIVE_INFINITY
  const t = new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`).getTime()
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / 86_400_000
}

/** Headlines without a parseable date are not treated as breaking news. */
export function headlineIsBreaking(h, maxDays = FRESH_HEADLINE_MAX_DAYS) {
  const age = headlineAgeDays(h?.date)
  return age <= maxDays
}

export function filterBreakingHeadlines(headlines, maxDays = FRESH_HEADLINE_MAX_DAYS) {
  return (headlines || []).filter((h) => headlineIsBreaking(h, maxDays))
}

/**
 * Timelines are allowed only if the latest year on the graphic is the current calendar year.
 */
export function isTimelineYearContext(text, ref = new Date()) {
  const t = String(text || '')
  const refYear = referenceDate(ref).getFullYear()
  const years = [...t.matchAll(/\b(20\d{2})\b/g)].map((m) => parseInt(m[1], 10))
  if (years.length < 2) return false
  const maxY = Math.max(...years)
  if (maxY < refYear) return false
  if (/\btimeline\b/i.test(t)) return maxY >= refYear
  if (/\b20\d{2}\s*[-–—→to]+\s*20\d{2}\b/i.test(t)) return maxY >= refYear
  if (/\bfrom\s+20\d{2}\s+to\s+20\d{2}\b/i.test(t)) return maxY >= refYear
  return false
}

export function registrySourceIsFreshEnough(source, ref = new Date()) {
  const s = String(source || '')
  if (!s) return true
  if (/\b2024\b/.test(s) || /\b2023\b/.test(s) || /\b2022\b/.test(s)) return false
  const refYear = referenceDate(ref).getFullYear()
  const refMonth = referenceDate(ref).getMonth()
  if (/\b2026\b/.test(s)) {
    const monthMatch = s.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i,
    )
    if (monthMatch) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ]
      const idx = monthNames.findIndex((m) =>
        monthMatch[1].toLowerCase().startsWith(m.slice(0, 3)),
      )
      if (idx >= 0 && idx < refMonth - 1) return false
    }
    return true
  }
  if (/\b2025\b/.test(s) && refYear >= 2026) return false
  if (/hedged|synthesis|recent reporting|this week/i.test(s)) return true
  return !/\b20\d{2}\b/.test(s)
}

export function scrubStaleYearClaims(text, ref = new Date()) {
  if (!text) return ''
  if (isTimelineYearContext(text, ref)) return text
  const refYear = referenceDate(ref).getFullYear()
  const lines = String(text).split('\n')
  const out = []
  for (const line of lines) {
    const years = [...line.matchAll(/\b(20\d{2})\b/g)].map((m) => parseInt(m[1], 10))
    const hasObsolete = years.some((y) => OBSOLETE_CHART_YEARS.has(y) || y < refYear - 1)
    const hasCurrent = years.some((y) => y >= refYear)
    if (hasObsolete && !hasCurrent) continue
    out.push(line)
  }
  let joined = out.join('\n')
  for (const y of OBSOLETE_CHART_YEARS) {
    if (y >= refYear) continue
    joined = joined.replace(new RegExp(`\\b${y}\\b`, 'g'), '')
  }
  joined = joined.replace(/\b(in|since|from)\s+202[0-4]\b/gi, `in ${refYear}`)
  return joined.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Hard rules block for DALL·E / gpt-image prompts — models often invent 2023→2024 arcs without this.
 */
export function buildBreakingNewsVisualRules(ref = new Date()) {
  const d = referenceDate(ref)
  const today = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const y = d.getFullYear()
  return [
    'BREAKING NEWS DESK (non-negotiable):',
    `- Treat "${today}" as today. This graphic is for LinkedIn *this week* — like a same-day AI markets wire, not a history slide.`,
    `- FORBIDDEN chart/timeline endpoint years: 2020, 2021, 2022, 2023, 2024. Never label the present as 2023 or 2024 — in AI that is obsolete.`,
    `- If you include a timeline, it MUST end at "${monthYear}" or "${y}" (current period). Example OK: Q1 ${y - 1} → Q4 ${y - 1} → ${monthYear}. Example FORBIDDEN: "2023: Old Model" → "2024: Total Cost".`,
    '- Do not illustrate "old model vs new model" using 2023/2024 labels; use "Before agents" vs "After agents" or quarters ending in the current year.',
    '- Kicker/date line must show the current month and year (e.g. "What changed · ' + today + '").',
    '- Footer text must be EXACTLY: Prem Iyer · AI Software Transformation — no extra words, hashes, version codes, or hex strings after it.',
    '- Do not reuse the title "Where Capital Is Flowing in AI Software Development" or other generic evergreen headlines.',
  ].join('\n')
}
