/** Max age for cited stats / survey years in generated copy (creation day = today). */
export const FRESH_STAT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function referenceDate(ref = new Date()) {
  return ref instanceof Date ? ref : new Date(ref)
}

export function freshCutoffIso(ref = new Date()) {
  const d = referenceDate(ref)
  return new Date(d.getTime() - FRESH_STAT_WINDOW_MS).toISOString()
}

/** True when copy looks like a timeline spanning multiple years (2024→2026 ok). */
export function isTimelineYearContext(text) {
  const t = String(text || '')
  if (/\btimeline\b/i.test(t)) return true
  if (/\b20\d{2}\s*[-–—]\s*20\d{2}\b/.test(t)) return true
  if (/\bfrom\s+20\d{2}\s+to\s+20\d{2}\b/i.test(t)) return true
  const years = [...t.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1])
  const uniq = [...new Set(years)]
  if (uniq.length >= 2 && uniq.some((y) => y >= '2025')) return true
  return false
}

/**
 * Registry / infographic sources: drop clearly stale publication years for "current" stats.
 */
export function registrySourceIsFreshEnough(source, ref = new Date()) {
  const s = String(source || '')
  if (!s) return true
  if (/\b2024\b/.test(s) || /\b2023\b/.test(s) || /\b2022\b/.test(s)) return false
  const refYear = referenceDate(ref).getFullYear()
  if (/\b2026\b/.test(s)) return true
  if (/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(s) && /\b2026\b/.test(s)) {
    return true
  }
  if (/\b2025\b/.test(s) && refYear >= 2026) return false
  if (/hedged|synthesis|recent reporting/i.test(s)) return true
  return !/\b20\d{2}\b/.test(s)
}

/**
 * Remove sentences that cite old years as current facts (keep timelines).
 */
export function scrubStaleYearClaims(text, ref = new Date()) {
  if (!text || isTimelineYearContext(text)) return text
  const refYear = referenceDate(ref).getFullYear()
  const lines = String(text).split('\n')
  const out = []
  for (const line of lines) {
    const years = [...line.matchAll(/\b(20\d{2})\b/g)].map((m) => parseInt(m[1], 10))
    const stale = years.some((y) => y < refYear - 1)
    const hasCurrent = years.some((y) => y >= refYear)
    if (stale && !hasCurrent && years.length <= 2) continue
    out.push(line)
  }
  let joined = out.join('\n')
  joined = joined.replace(/\b(in|since|from)\s+2024\b/gi, `in ${refYear}`)
  joined = joined.replace(/\bQ[1-4]\s+2024\b/gi, '')
  return joined.replace(/\n{3,}/g, '\n\n').trim()
}
