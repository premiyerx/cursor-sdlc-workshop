/**
 * Copy helpers for carousels / graphics: prefer full sentences over mid-sentence "…" cuts.
 */

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}

/**
 * If `text` exceeds `softMax` characters, return the longest prefix that ends at a
 * sentence boundary (. ? !) before `hardMax`. If none, return up to `hardMax` at a
 * word boundary. If still shorter than full text, returns full `text` when under hardMax.
 */
export function slideCopy(text, softMax = 420, hardMax = 920) {
  const t = norm(text)
  if (!t) return ''
  if (t.length <= softMax) return t

  const scan = Math.min(t.length, Math.max(softMax + 120, hardMax))
  const window = t.slice(0, scan)

  const tryCut = (maxIdx) => {
    for (const sep of ['. ', '? ', '! ']) {
      let pos = Math.min(window.length, maxIdx)
      while (pos > 28) {
        const idx = window.lastIndexOf(sep, pos)
        if (idx < 28) break
        if (idx < softMax) return t.slice(0, idx + 1).trim()
        pos = idx - 1
      }
    }
    const semi = window.lastIndexOf('; ')
    if (semi > 40 && semi < softMax) return t.slice(0, semi + 1).trim()
    return null
  }

  const atSoft = tryCut(softMax)
  if (atSoft) return atSoft

  if (t.length <= hardMax) return t

  const h = t.slice(0, hardMax)
  for (const sep of ['. ', '? ', '! ']) {
    const idx = h.lastIndexOf(sep)
    if (idx > 55) return t.slice(0, idx + 1).trim()
  }
  const sp = h.lastIndexOf(' ')
  if (sp > 70) return t.slice(0, sp).trim()
  return h.trim()
}

/** True when subdeck is essentially the same opening as the first bullet (duplicate deck copy). */
export function subdeckDuplicatesBullet(subdeck, firstBulletText) {
  const a = norm(subdeck)
  const b = norm(firstBulletText)
  if (!a || !b) return false
  if (a === b) return true
  const n = Math.min(56, a.length, b.length)
  if (n < 24) return false
  return a.slice(0, n) === b.slice(0, n)
}

/**
 * First sentence (or clause) up to `maxLen` — for hero lines and closers.
 */
export function firstSentence(text, maxLen = 120) {
  const t = norm(text)
  if (!t) return ''
  if (t.length <= maxLen) {
    const cut = t.search(/[.?!]\s/)
    if (cut > 20 && cut + 1 <= maxLen) return t.slice(0, cut + 1).trim()
    return t
  }
  const window = t.slice(0, maxLen + 40)
  for (const sep of ['. ', '? ', '! ']) {
    const idx = window.lastIndexOf(sep, maxLen)
    if (idx > 28) return t.slice(0, idx + 1).trim()
  }
  const comma = window.lastIndexOf(', ', Math.min(maxLen, window.length))
  if (comma > 42) return t.slice(0, comma).trim() + '.'
  const sp = window.lastIndexOf(' ', maxLen)
  if (sp > 40) return t.slice(0, sp).trim()
  return t.slice(0, maxLen).trim()
}

/**
 * Short supporting copy for carousels — tighter than `slideCopy` (one beat, not a paragraph).
 * Defaults target ~1–2 sentences / ~16–24 words for on-slide blurbs.
 */
export function takeawayCopy(text, softMax = 118, hardMax = 158) {
  const t = norm(text)
  if (!t) return ''
  if (t.length <= softMax) return t

  const window = t.slice(0, Math.min(t.length, hardMax + 30))

  const tryCut = (maxIdx) => {
    for (const sep of ['. ', '? ', '! ']) {
      let pos = Math.min(window.length, maxIdx)
      while (pos > 22) {
        const idx = window.lastIndexOf(sep, pos)
        if (idx < 22) break
        if (idx < softMax) return t.slice(0, idx + 1).trim()
        pos = idx - 1
      }
    }
    const semi = window.lastIndexOf('; ')
    if (semi > 32 && semi < softMax) return t.slice(0, semi + 1).trim()
    const comma = window.lastIndexOf(', ')
    if (comma > 48 && comma < softMax) return t.slice(0, comma).trim() + '.'
    return null
  }

  const atSoft = tryCut(softMax)
  if (atSoft) return atSoft

  if (t.length <= hardMax) return t

  const h = t.slice(0, hardMax)
  for (const sep of ['. ', '? ', '! ']) {
    const idx = h.lastIndexOf(sep)
    if (idx > 38) return t.slice(0, idx + 1).trim()
  }
  const sp = h.lastIndexOf(' ')
  if (sp > 52) return t.slice(0, sp).trim()
  return h.trim()
}

/** Close unmatched '(' so carousel headlines never end on a dangling parenthesis. */
export function balanceParentheses(text) {
  const t = norm(text)
  if (!t) return ''
  let depth = 0
  for (const ch of t) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
  }
  return depth > 0 ? `${t}${')'.repeat(depth)}` : t
}
