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
