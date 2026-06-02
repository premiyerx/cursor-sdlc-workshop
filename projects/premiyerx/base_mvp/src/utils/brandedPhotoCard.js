/**
 * Branded photo card.
 *
 * Old behaviour: dump a raw Unsplash photo into the preview and pray it looks
 * intentional. It usually didn't, and ~60% of queries returned nothing.
 *
 * New behaviour:
 *  1. Search Unsplash for a topic-relevant landscape photo (same query path as
 *     before, broader fallback search if the first miss).
 *  2. If anything comes back, composite it onto a 1200×627 canvas with:
 *       - A dark vertical gradient so text is legible at any tone
 *       - A bottom-aligned "card" carrying the hook and up to 2 verified stats
 *       - The brand footer (Prem Iyer · AI Software Transformation)
 *  3. Return both the composited data URL and the Unsplash credit metadata
 *     (so the existing Unsplash-credit line still works).
 *
 * If nothing comes back, return null — the caller hides the option so the user
 * never sees the red "No stock photo match" failure card.
 */

import { assembleVerifiedStats } from './verifiedInfographic.js'
import { formatStatForDisplay } from './factualClaims.js'
import { slideCopy } from './completeSentence.js'

const CANVAS_W = 1200
const CANVAS_H = 627

function unsplashKey() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_UNSPLASH_ACCESS_KEY) {
      return String(import.meta.env.VITE_UNSPLASH_ACCESS_KEY).trim()
    }
  } catch {
    /* no-op */
  }
  return ''
}

async function searchUnsplash(query, accessKey) {
  if (!query?.trim() || !accessKey) return []
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query,
  )}&orientation=landscape&per_page=10&content_filter=high&client_id=${encodeURIComponent(accessKey)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results : []
  } catch {
    return []
  }
}

function pickBestPhoto(results, seedKey) {
  if (!results.length) return null
  // Prefer high-quality landscapes with a real subject. Unsplash sorts by
  // relevance, so pick deterministically from the top half to avoid re-rolling
  // the same image when the user re-runs.
  const half = results.slice(0, Math.max(1, Math.ceil(results.length / 2)))
  let h = 2166136261
  for (const c of String(seedKey || '')) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return half[(h >>> 0) % half.length]
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawCover(ctx, img, w, h) {
  const ar = img.naturalWidth / img.naturalHeight
  const target = w / h
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  if (ar > target) {
    sw = img.naturalHeight * target
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = img.naturalWidth / target
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
}

function wrapForCanvas(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length >= maxLines) break
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

function buildSearchQuery(parsed, topic) {
  const phrase = [parsed?.hook, ...(parsed?.keyPhrases || []).slice(0, 2)]
    .filter(Boolean)
    .join(' ')
    .slice(0, 90)
  const tone = topic?.label || 'enterprise technology'
  return `${phrase} ${tone}`.trim() || 'enterprise technology executive'
}

/**
 * Compose a branded photo card.
 *
 * @param {object} params
 * @param {object} params.parsed - parsed post (hook + keyPhrases)
 * @param {object} params.topic  - topic record (label + id)
 * @param {string} params.topicId - topic id (for verified-stat lookup)
 * @param {string} params.postText - full post text (for stats extraction)
 * @param {string} params.accent  - brand accent color
 * @returns {Promise<{ dataUrl: string, credit: string, link: string } | null>}
 */
export async function generateBrandedPhotoCard({ parsed, topic, topicId, postText, accent = '#3EDC81' }) {
  const key = unsplashKey()
  if (!key) return null

  const primaryQuery = buildSearchQuery(parsed, topic)
  let results = await searchUnsplash(primaryQuery, key)
  if (!results.length) {
    // Broader fallback so we don't fail just because the hook was unusual.
    const fallback = `${topic?.label || 'enterprise'} business technology`
    results = await searchUnsplash(fallback, key)
  }
  if (!results.length) return null

  const photo = pickBestPhoto(results, parsed?.hook || primaryQuery)
  if (!photo?.urls?.regular) return null

  let img
  try {
    img = await loadImage(photo.urls.regular)
  } catch {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // 1) Photo as cover
  drawCover(ctx, img, CANVAS_W, CANVAS_H)

  // 2) Vertical darkening gradient so text is always legible
  const overlay = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  overlay.addColorStop(0, 'rgba(8, 10, 12, 0.45)')
  overlay.addColorStop(0.5, 'rgba(8, 10, 12, 0.55)')
  overlay.addColorStop(1, 'rgba(6, 8, 10, 0.92)')
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 3) Masthead accent strip
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, CANVAS_W, 4)

  // Masthead label
  ctx.fillStyle = accent
  ctx.font = '800 14px "Inter", "Helvetica Neue", Arial, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(String(topic?.label || 'INSIGHT').toUpperCase().slice(0, 42), 56, 28)
  ctx.fillStyle = 'rgba(220, 222, 228, 0.85)'
  ctx.font = '500 12px "Inter", sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText('Prem Iyer  ·  AI Software Transformation', 56, 50)

  // 4) Hook card anchored to bottom
  const cardX = 56
  const cardY = 360
  const cardW = CANVAS_W - cardX * 2
  const cardH = CANVAS_H - cardY - 56

  // Soft dark card
  ctx.fillStyle = 'rgba(8, 10, 12, 0.78)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 18)
  ctx.fill()
  ctx.fillStyle = accent
  roundRect(ctx, cardX, cardY, 6, cardH, 3)
  ctx.fill()

  // Hook
  ctx.fillStyle = '#f6f6f6'
  ctx.font = '700 30px Georgia, "Times New Roman", serif'
  const hookLines = wrapForCanvas(ctx, slideCopy(parsed?.hook || '', 110, 220), cardW - 56, 2)
  hookLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 28, cardY + 26 + i * 38)
  })

  // Stats row — pull from verified registry the same way the news infographic does
  let stats = []
  try {
    stats = assembleVerifiedStats(postText, topicId, 2).map((s) => formatStatForDisplay(s))
  } catch {
    stats = []
  }
  if (stats.length) {
    const statsBaseY = cardY + 26 + hookLines.length * 38 + 22
    const col = cardW / Math.min(stats.length, 2)
    stats.slice(0, 2).forEach((stat, i) => {
      const sx = cardX + 28 + col * i
      // Big stat value
      ctx.fillStyle = accent
      ctx.font = '800 34px Georgia, serif'
      ctx.fillText(String(stat.value || '').slice(0, 16), sx, statsBaseY)
      // Context line
      ctx.fillStyle = 'rgba(220, 222, 228, 0.85)'
      ctx.font = '500 12px Inter, sans-serif'
      ctx.fillText(slideCopy(stat.context, 56, 140), sx, statsBaseY + 42)
    })
  }

  // Footer
  ctx.fillStyle = 'rgba(154, 160, 168, 0.75)'
  ctx.font = '500 10px Inter, sans-serif'
  ctx.fillText(
    `Photo via Unsplash · ${(photo.user?.name || 'photographer').slice(0, 40)}`,
    cardX,
    CANVAS_H - 28,
  )

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    credit: photo.user?.name || 'Unsplash',
    link: photo.links?.html || 'https://unsplash.com',
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
