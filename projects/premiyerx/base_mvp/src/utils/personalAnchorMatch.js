/**
 * Personal-anchor reflection check — Move 1 safety net.
 *
 * After a draft is generated, verify the author's personal anchor actually
 * shows up in the copy. If essentially nothing from the anchor made it in, the
 * generator retries once with a forceful directive. This is a guard against the
 * model satisfying the generic "personal specificity" rule with an INVENTED
 * detail instead of the author's real one.
 *
 * Deterministic, no API cost.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'how', 'she', 'he', 'they', 'her', 'his', 'their', 'about', 'around', 'due',
  'her', 'so', 'many', 'all', 'could', 'would', 'should', 'them', 'into', 'by',
  'that', 'this', 'these', 'those', 'was', 'were', 'is', 'are', 'be', 'been',
  'having', 'have', 'has', 'had', 'from', 'at', 'as', 'it', 'its', 'who', 'whom',
  'entire', 'need', 'needs', 'than', 'then', 'when', 'while', 'where', 'which',
  'company', 'conversation', 'focused', 'focus', 'bringing', 'bring', 'together',
  'increase', 'reduce', 'reducing', 'increasing', 'because', 'whole', 'one',
])

/**
 * Pull the distinctive content words from an anchor (lowercased, deduped,
 * length >= 4, minus stopwords). Light singular/plural folding so "tools"
 * matches "tool" and "costs" matches "cost".
 * @returns {string[]}
 */
export function extractAnchorKeywords(anchor) {
  const words = String(anchor || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const out = new Set()
  for (const w of words) {
    if (w.length < 4 || STOPWORDS.has(w)) continue
    out.add(stem(w))
  }
  return [...out]
}

function stem(w) {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2)
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  return w
}

/**
 * Count how many distinct anchor keywords appear in the post text.
 * @param {string} anchor
 * @param {string} text  hook + body (CTA optional)
 * @returns {{ hits: number, total: number, ratio: number, matched: string[] }}
 */
export function anchorReflection(anchor, text) {
  const keywords = extractAnchorKeywords(anchor)
  if (!keywords.length) return { hits: 0, total: 0, ratio: 1, matched: [] }
  const haystack = ` ${String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(stem)
    .join(' ')} `
  const matched = keywords.filter((k) => haystack.includes(` ${k} `))
  return {
    hits: matched.length,
    total: keywords.length,
    ratio: matched.length / keywords.length,
    matched,
  }
}

/**
 * True when the anchor is meaningfully present. Conservative: we only force a
 * retry when the draft reflects almost nothing of the anchor, so we never
 * thrash on a draft that genuinely wove it in differently.
 */
export function anchorIsReflected(anchor, text) {
  const kw = extractAnchorKeywords(anchor)
  if (kw.length === 0) return true
  const { hits, ratio } = anchorReflection(anchor, text)
  // For a short anchor (few keywords) require at least 1 hit; for a rich one
  // require at least 2 distinct hits or ~15% coverage.
  if (kw.length <= 3) return hits >= 1
  return hits >= 2 || ratio >= 0.15
}
