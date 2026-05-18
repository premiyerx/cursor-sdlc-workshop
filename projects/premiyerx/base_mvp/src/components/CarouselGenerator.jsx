import { useState, useRef, useMemo, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { findCitationsForLine, findCitations } from '../data/citations'
import { scorePost } from '../data/algorithmRules'
import { CAROUSEL_ALGORITHM_TIP } from '../data/linkedinAlgorithm2026'
import { fnv1a, mulberry32 } from '../utils/generationVariety'
import { copyToClipboard } from '../utils/clipboard'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import TOPICS from '../data/postTemplates'
import { getTopicNarrative } from '../data/topicNarratives'
import { slideCopy, subdeckDuplicatesBullet } from '../utils/completeSentence'

const SLIDE_W = 1080
const SLIDE_H = 1080
const SIDE = 56
const PAD = 72
const CONTENT_TOP = 118
const FOOTER_TOP = SLIDE_H - 100
/** Vertical band for hero copy (below header, above footer). */
const HERO_REGION_TOP = 112
const HERO_REGION_BOT = FOOTER_TOP - 52

/** Editorial deck — near-black, warm paper type, green accent (Prem brand). */
const BG = '#050505'
const PAPER = '#f2efe8'
const MUTED = '#7a726a'
const ACCENT = '#3EDC81'
const ACCENT_SOFT = 'rgba(62, 220, 129, 0.72)'
const RULE = 'rgba(122, 114, 106, 0.35)'
const BOX_EDGE = 'rgba(62, 220, 129, 0.45)'

const AUTHOR = 'Prem Iyer'
const PLATFORM_RAIL = 'AI SOFTWARE TRANSFORMATION'

const FONT_SANS = 'Inter, system-ui, sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const SHIFT_LABELS = [
  'THE PERIMETER',
  'THE OBJECT',
  'THE SURFACE',
  'THE SIGNAL',
  'THE PATH',
  'THE SYSTEM',
]

const STRIKE_BY_TOPIC = {
  cursor: 'AUTOCOMPLETE — COPY/PASTE — TOOL HOPPING',
  investment: 'HYPE — FOMO — DECKS WITHOUT OWNERS',
  cio: 'STRATEGY THEATER — PILOTS — SHELFWARE',
  roi: 'VANITY METRICS — BENCHMARKS — NO DECISION',
}

function getTopicLabel(topicId) {
  return TOPICS.find((t) => t.id === topicId)?.label || 'Your pillar'
}

function shiftKicker(slideNum) {
  const n = String(slideNum).padStart(2, '0')
  const lab = SHIFT_LABELS[(Math.max(1, slideNum) - 1) % SHIFT_LABELS.length]
  return `SHIFT ${n} · ${lab}`
}

function rotateTitleBank(titles, topicId, hook) {
  if (!titles || titles.length <= 1) return titles
  const seed =
    (fnv1a(`${topicId || 'x'}:${(hook || '').slice(0, 48)}`) ^ (Date.now() & 0xffffffff)) >>> 0
  const rng = mulberry32(seed || 0xfeedbeef)
  const offset = Math.floor(rng() * titles.length) % titles.length
  return [...titles.slice(offset), ...titles.slice(0, offset)]
}

function bulletTexts(bullets, n) {
  return bullets.slice(0, n).map((b) => (typeof b === 'string' ? b : b?.text || '')).filter(Boolean)
}

function allBulletStrings(bullets) {
  return bullets.map((b) => (typeof b === 'string' ? b : b?.text || '')).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function pickPlatformNarrative(subdeck, hook, bullets) {
  const bt = allBulletStrings(bullets)
  const b0 = bt[0] || ''
  const sd = (subdeck || '').replace(/\s+/g, ' ').trim()
  if (sd.length > 28 && !subdeckDuplicatesBullet(sd, b0)) return sd
  if (bt[3] && bt[3] !== b0) return bt[3]
  if (bt[2] && bt[2] !== b0) return bt[2]
  if (bt[1] && bt[1] !== b0) return bt[1]
  return hook || b0
}

function topicShortLabel(topicLabel) {
  return (topicLabel.split(':')[0] || topicLabel).trim()
}

/** Decorative 8 cells — letters from topic + signal (design only; not standalone “meaning”). */
function eightGraphicCells(topicLabel, signalLabel) {
  const raw = `${topicLabel} ${signalLabel || ''}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const out = []
  for (let i = 0; i < raw.length && out.length < 8; i++) out.push(raw[i])
  while (out.length < 8) out.push('·')
  return out.slice(0, 8)
}

/** Platform hero lines come from the post hook + topic label — not fixed marketing slogans. */
function platformTitlesFromPost(hook, narrative, topicLabel) {
  const h = (hook || '').replace(/\s+/g, ' ').trim()
  const shortTopic = topicShortLabel(topicLabel)
  if (h.length >= 36) {
    const { primary, accent } = splitHeadlineForAccent(h)
    if (accent && accent.length > 6) return { primary: primary || h, accent }
  }
  if (h.length >= 12) return { primary: h, accent: shortTopic }
  const t = splitHeadlineForAccent(narrative.coreThesis || '')
  return {
    primary: t.primary || slideCopy(narrative.coreThesis, 72, 160),
    accent: t.accent || shortTopic || narrative.label,
  }
}

/** Trio lines: post bullets first; otherwise topic news lenses (always on-pillar). */
function trioLinesFromPostAndTopic(btList, narrative) {
  const lenses = (narrative.newsLenses || []).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return [
    btList[0] || lenses[0] || slideCopy(narrative.coreThesis, 120, 280),
    btList[1] || lenses[1] || slideCopy(narrative.competitiveFrame, 120, 280),
    btList[2] || lenses[2] || slideCopy(narrative.audience ? `Who this is for: ${narrative.audience}` : narrative.coreThesis, 120, 280),
  ]
}

/** Pillar column bodies: bullets first, then narrative lenses — never generic off-topic filler. */
function pillarColumnTexts(bulletStrings, narrative) {
  const lenses = (narrative.newsLenses || []).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const thesis = narrative.coreThesis.replace(/\s+/g, ' ').trim()
  const frame = narrative.competitiveFrame.replace(/\s+/g, ' ').trim()
  const seen = new Set()
  const pick = []
  for (const b of bulletStrings) {
    const t = (b || '').trim()
    if (t.length < 24) continue
    const key = t.slice(0, 52).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pick.push(t)
    if (pick.length >= 3) return pick
  }
  for (const lens of lenses) {
    if (pick.length >= 3) break
    const t = lens.trim()
    if (t.length < 24) continue
    const key = t.slice(0, 52).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pick.push(t)
  }
  const fall = [thesis, frame, (narrative.audience || '').trim() || thesis, narrative.label]
  for (const f of fall) {
    if (pick.length >= 3) break
    const t = (f || '').trim()
    if (t.length < 20) continue
    const key = t.slice(0, 52).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pick.push(t)
  }
  while (pick.length < 3) pick.push(thesis)
  return pick.slice(0, 3)
}

function pillarBodyFallback(subdeck, standaloneStatements, narrative) {
  const sd = (subdeck || '').replace(/\s+/g, ' ').trim()
  if (sd.length > 40) return sd
  const st = standaloneStatements.find((s) => s.length > 45)
  if (st) return st
  return narrative.coreThesis
}

function topicBoxMeta(narrative) {
  const parts = (narrative.newsLenses || [])
    .slice(0, 3)
    .map((s) =>
      s
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(' ')
        .toUpperCase(),
    )
    .filter(Boolean)
  if (parts.length >= 2) return parts.join(' — ')
  return slideCopy((narrative.signalLabel || 'TOPIC SIGNAL').toUpperCase(), 28, 48).replace(/\s+/g, ' — ')
}

function parseIntoSlides(text, topicId = '') {
  if (!text) return []
  const lines = text.split('\n').filter((l) => l.trim())
  const slides = []
  const hook = lines[0] || ''
  const topicLabel = getTopicLabel(topicId)
  const narrative = getTopicNarrative(topicId)
  let subdeck = ''
  const parenLine = lines.slice(1, 6).find((l) => /^\([^)]{12,}\)/.test(l.trim()))
  if (parenLine) subdeck = parenLine.replace(/^\(|\)\s*$|\)$/g, '').trim()
  else {
    const prose = lines.slice(1, 8).find((l) => {
      const t = l.trim()
      return t.length > 45 && !t.startsWith('#') && !/^(→|➜|►|▸|•|\d+\.|-)/.test(t) && !/\?$/.test(t)
    })
    if (prose) subdeck = prose.trim()
  }

  const bullets = []
  const sections = []
  let currentSection = null
  const standaloneStatements = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (/^(→|➜|►|▸|•|\d+\.|-)/.test(line)) {
      const clean = line.replace(/^(→|➜|►|▸|•|\d+\.|-)\s*/, '')
      const cite = findCitationsForLine(clean)
      const item = { text: clean, cite }
      if (currentSection) {
        currentSection.items.push(item)
      } else {
        bullets.push(item)
      }
    } else if (/^(Fear|Step|Tip|Point|Reason|Myth|Insight|Lesson)\s*#?\d/i.test(line) || /^\d+\.\s/.test(line)) {
      if (currentSection && currentSection.items.length > 0) sections.push(currentSection)
      currentSection = { heading: line.replace(/^\d+\.\s*/, ''), items: [] }
    } else if (line.length > 30 && !line.startsWith('#') && !/\?$/.test(line)) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection)
        currentSection = null
      }
      if (/\d+%|\$[\d.]+[MBK]?|\dx/.test(line) && line.length < 120) {
        bullets.push(line)
      } else if (line.length > 40 && line.length < 200) {
        standaloneStatements.push(line)
      }
    }
  }
  if (currentSection && currentSection.items.length > 0) sections.push(currentSection)

  const firstBulletStr = bullets[0]
    ? (typeof bullets[0] === 'string' ? bullets[0] : bullets[0].text).replace(/\s+/g, ' ').trim()
    : ''
  if (subdeck && firstBulletStr && subdeckDuplicatesBullet(subdeck, firstBulletStr)) {
    subdeck = ''
  }

  slides.push({ type: 'cover', text: hook, topicLabel, subdeck })

  let shiftCounter = 0

  if (sections.length >= 2) {
    for (let si = 0; si < sections.length; si++) {
      const items = sections[si].items.slice(0, 4)
      const cites = items.map((it) => it.cite).filter(Boolean)
      const t0 = items[0]?.text || ''
      const t1 = items[1]?.text || ''
      slides.push({
        type: 'section',
        heading: sections[si].heading,
        items,
        slideNum: si + 1,
        totalSections: sections.length,
        cites: [...new Set(cites)],
        kicker: shiftKicker(++shiftCounter),
        supporting: slideCopy(t0, 280),
        boxMeta: topicBoxMeta(narrative),
        leftCol: t0
          ? { title: 'THE CONSTRAINT', body: slideCopy(t0, 320) }
          : null,
        rightCol: t1
          ? { title: 'THE LEVERAGE', body: slideCopy(t1, 320) }
          : null,
      })
    }
  } else if (bullets.length > 0) {
    const titles = rotateTitleBank(generateBulletTitles(bullets, hook), topicId, hook)
    for (let i = 0; i < bullets.length; i += 3) {
      const chunk = bullets.slice(i, i + 3)
      const cites = chunk.map((it) => it.cite).filter(Boolean)
      slides.push({
        type: 'bullets',
        title: titles[Math.floor(i / 3)] || 'Key Insights',
        items: chunk,
        slideNum: Math.floor(i / 3) + 1,
        cites: [...new Set(cites)],
        kicker: shiftKicker(++shiftCounter),
      })
    }
  }

  if (standaloneStatements.length > 0) {
    const best = standaloneStatements.reduce((a, b) => (a.length > b.length ? a : b))
    if (best.length > 50) {
      slides.push({ type: 'quote', text: best, kicker: shiftKicker(++shiftCounter) })
    }
  }

  const hashtags = lines.filter((l) => l.trim().startsWith('#')).join(' ')
  const cta = lines.find((l) => /\?$/.test(l.trim()) && !/^#/.test(l.trim()) && l.length > 20)

  if (cta) {
    slides.push({ type: 'cta', text: cta.trim(), kicker: 'YOUR TURN' })
  }

  const bodyCount = bullets.length + sections.reduce((n, s) => n + s.items.length, 0)
  const richEnough =
    bullets.length >= 4 || bodyCount >= 6 || text.length > 700 || lines.length > 14

  if (richEnough) {
    const btList = allBulletStrings(bullets)
    const narrativeRaw = pickPlatformNarrative(subdeck, hook, bullets)
    const titles = platformTitlesFromPost(hook, narrative, topicLabel)
    const trioSubs = trioLinesFromPostAndTopic(btList, narrative)
    const shortTopic = topicShortLabel(topicLabel)
    slides.push({
      type: 'platform',
      titleMain: titles.primary,
      titleAccent: titles.accent,
      body: slideCopy(narrativeRaw, 380),
      trio: [
        { title: 'Roadmap', sub: slideCopy(trioSubs[0], 720) },
        { title: 'Ship', sub: slideCopy(trioSubs[1], 720) },
        { title: 'Prove', sub: slideCopy(trioSubs[2], 720) },
      ],
      platformGraphic: {
        keywordCells: eightGraphicCells(shortTopic, narrative.signalLabel),
        meshLabel: slideCopy(narrative.signalLabel, 40, 56).toUpperCase(),
        bridgeCaption: slideCopy(narrativeRaw || narrative.coreThesis, 72, 140),
        footMono: 'NEWS · REGISTRY · POST',
      },
    })
  }

  const colPick = pillarColumnTexts(allBulletStrings(bullets), narrative)

  const topicShort = topicShortLabel(topicLabel).slice(0, 44)
  slides.push({
    type: 'pillar',
    strike: STRIKE_BY_TOPIC[topicId] || 'HYPE — PILOTS — SLIDEWARE',
    headline: `Welcome to ${topicShort}.`,
    body: slideCopy(pillarBodyFallback(subdeck, standaloneStatements, narrative), 420),
    cols: [
      { label: 'EXTERNAL', text: slideCopy(colPick[0], 560) },
      { label: 'ENTITY-LEVEL', text: slideCopy(colPick[1], 560) },
      { label: 'AI-NATIVE', text: slideCopy(colPick[2], 560) },
    ],
  })

  const allCites = findCitations(text)
  const statN = Math.min(5, Math.max(3, Math.ceil(bullets.length / 2) || 3))
  const closerPrimary = slideCopy(`${narrative.label}: ${narrative.coreThesis}`.replace(/\s+/g, ' ').trim(), 120, 280)
  const closerSub = slideCopy(narrative.competitiveFrame, 200, 360)
  slides.push({
    type: 'closer',
    text: closerPrimary,
    sub: closerSub,
    hashtags,
    allCites,
    topicLabel,
    statN,
    statWord: 'operating modes',
    statMicro: 'PLAN · SHIP · MEASURE · GOVERN · AGENT',
  })

  const topicRail = topicShortLabel(topicLabel).toUpperCase().slice(0, 40)
  return slides.map((s) => ({ ...s, topicRail }))
}

function generateBulletTitles(bullets, hook) {
  const titles = []
  const hookLower = hook.toLowerCase()
  if (hookLower.includes('cost') || hookLower.includes('roi') || hookLower.includes('revenue'))
    titles.push('The Business Impact', 'The Numbers', 'What This Means')
  else if (hookLower.includes('team') || hookLower.includes('engineer') || hookLower.includes('developer'))
    titles.push('The Team Effect', 'The Velocity Shift', 'The Outcome')
  else if (hookLower.includes('invest') || hookLower.includes('fund') || hookLower.includes('vc'))
    titles.push('The Market Signal', 'The Capital Flow', 'The Opportunity')
  else if (hookLower.includes('cio') || hookLower.includes('leader') || hookLower.includes('vp'))
    titles.push('The Leadership Challenge', 'The Solution', 'The Path Forward')
  else titles.push('The Data', 'The Shift', 'The Takeaway')
  return titles
}

function wrapText(ctx, text, maxWidth) {
  const safeMax = maxWidth - 10
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > safeMax && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function splitHeadlineForAccent(raw) {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return { primary: '', accent: '' }
  const words = t.split(/\s+/)
  if (words.length <= 5) {
    const mid = Math.max(1, Math.floor(words.length / 2))
    return { primary: words.slice(0, mid).join(' '), accent: words.slice(mid).join(' ') }
  }
  const tailN = Math.min(6, Math.max(2, Math.round(words.length * 0.28)))
  return { primary: words.slice(0, -tailN).join(' '), accent: words.slice(-tailN).join(' ') }
}

/** Prefer sentence boundary so citations / parentheses are not split across styles. */
function splitHeadlineForQuote(raw) {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return { primary: '', accent: '' }
  if (t.length < 90) return splitHeadlineForAccent(t)
  const cap = Math.min(260, t.length)
  const head = t.slice(0, cap)
  const dot = head.lastIndexOf('. ')
  if (dot > 55) {
    return { primary: t.slice(0, dot + 1).trim(), accent: t.slice(dot + 1).trim() }
  }
  const q = head.lastIndexOf('? ')
  if (q > 40) {
    return { primary: t.slice(0, q + 1).trim(), accent: t.slice(q + 1).trim() }
  }
  const paren = head.indexOf('(')
  if (paren > 50 && paren < 140) {
    return { primary: t.slice(0, paren).trim(), accent: t.slice(paren).trim() }
  }
  return splitHeadlineForAccent(t)
}

function countHeadlineLines(ctx, primary, accent, maxW, fontPx) {
  ctx.font = `700 ${fontPx}px ${FONT_SANS}`
  const n1 = primary ? wrapText(ctx, primary, maxW).length : 0
  const n2 = accent ? wrapText(ctx, accent, maxW).length : 0
  return n1 + n2
}

/** First-line baseline so a block of n lines (given lineGap & fontPx) is vertically centered in the hero band. */
function verticalHeroBaseline(lineCount, lineGap, fontPx) {
  if (lineCount <= 0) return CONTENT_TOP + 56
  const blockH = (lineCount - 1) * lineGap + fontPx * 1.05
  const regionH = HERO_REGION_BOT - HERO_REGION_TOP
  return HERO_REGION_TOP + (regionH - blockH) / 2 + fontPx * 0.72
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawStrikeLabel(ctx, text, x, y, maxW) {
  ctx.save()
  ctx.font = `500 11px ${FONT_MONO}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = MUTED
  const t = text.toUpperCase().slice(0, 80)
  ctx.fillText(t, x, y)
  const w = Math.min(ctx.measureText(t).width, maxW)
  ctx.strokeStyle = 'rgba(122,114,106,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y - 5)
  ctx.lineTo(x + w, y - 5)
  ctx.stroke()
  ctx.restore()
}

function drawEditorialHeader(ctx, kickerLeft, slideIndex, total, { monoRight = true } = {}) {
  ctx.textAlign = 'left'
  ctx.font = `500 11px ${FONT_MONO}`
  ctx.letterSpacing = '2.6px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText((kickerLeft || 'INSIGHT · CAROUSEL').toUpperCase().slice(0, 56), SIDE, 50)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = monoRight ? `500 11px ${FONT_MONO}` : `500 11px ${FONT_SANS}`
  ctx.letterSpacing = '2px'
  ctx.fillText(`${String(slideIndex + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, SLIDE_W - SIDE, 50)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
}

function drawEditorialFooter(ctx, { showScrollCue = false, railText = PLATFORM_RAIL } = {}) {
  const railY = FOOTER_TOP + 18
  const markY = FOOTER_TOP + 4
  if (showScrollCue) {
    ctx.font = `500 10px ${FONT_MONO}`
    ctx.letterSpacing = '2.4px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText('KEEP SCROLLING →', SIDE, FOOTER_TOP - 22)
    ctx.letterSpacing = '0px'
  }
  const lx = SIDE
  ctx.strokeStyle = PAPER
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(lx + 14, markY - 6, 11, Math.PI * 0.65, Math.PI * 1.85)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(lx + 24, markY - 6, 11, Math.PI * 1.2, Math.PI * 2.38)
  ctx.stroke()
  ctx.fillStyle = PAPER
  ctx.font = `700 18px ${FONT_SANS}`
  ctx.fillText(AUTHOR.toUpperCase(), lx + 44, markY - 2)
  ctx.textAlign = 'right'
  ctx.font = `500 9px ${FONT_MONO}`
  ctx.letterSpacing = '2.4px'
  ctx.fillStyle = MUTED
  const rail = (railText || PLATFORM_RAIL).toUpperCase().slice(0, 42)
  ctx.fillText(rail, SLIDE_W - SIDE, railY)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
}

function hairlineH(ctx, x1, x2, y) {
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

function hairlineV(ctx, x, y1, y2) {
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y1)
  ctx.lineTo(x, y2)
  ctx.stroke()
}

function drawSplitHeadline(ctx, fullText, maxW, startY, fontPx = 50, lineGap = 54) {
  const { primary, accent } = splitHeadlineForAccent(fullText)
  return drawSplitHeadlineParts(ctx, primary, accent, maxW, startY, fontPx, lineGap)
}

function drawSplitHeadlineParts(ctx, primary, accent, maxW, startY, fontPx, lineGap) {
  let y = startY
  ctx.fillStyle = PAPER
  ctx.font = `700 ${fontPx}px ${FONT_SANS}`
  for (const line of wrapText(ctx, primary, maxW)) {
    ctx.fillText(line, PAD, y)
    y += lineGap
  }
  if (accent) {
    ctx.fillStyle = ACCENT
    ctx.font = `700 ${fontPx}px ${FONT_SANS}`
    for (const line of wrapText(ctx, accent, maxW)) {
      ctx.fillText(line, PAD, y)
      y += lineGap
    }
  }
  ctx.fillStyle = PAPER
  return y
}

function drawCompareBox(ctx, topY, maxW, meta, leftCol, rightCol) {
  const x0 = PAD
  const boxH = 200
  const w = maxW
  ctx.strokeStyle = BOX_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, x0, topY, w, boxH, 2)
  ctx.stroke()

  let y = topY + 22
  if (meta) {
    ctx.font = `500 9px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText(meta.toUpperCase(), x0 + 16, y)
    ctx.letterSpacing = '0px'
    y += 28
  } else {
    y += 8
  }

  const midX = x0 + w / 2
  hairlineV(ctx, midX, topY + (meta ? 48 : 28), topY + boxH - 16)

  const colW = w / 2 - 32
  const lx = x0 + 16
  const rx = midX + 16

  ctx.font = `500 9px ${FONT_MONO}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText((leftCol.title || 'LEFT').toUpperCase(), lx, y)
  ctx.fillText((rightCol.title || 'RIGHT').toUpperCase(), rx, y)
  ctx.letterSpacing = '0px'

  const labelBottom = y + 22
  ctx.font = `400 20px ${FONT_SANS}`
  ctx.fillStyle = PAPER
  let ly = labelBottom
  for (const line of wrapText(ctx, leftCol.body, colW)) {
    ctx.fillText(line, lx, ly)
    ly += 28
  }
  let ry = labelBottom
  for (const line of wrapText(ctx, rightCol.body, colW)) {
    ctx.fillText(line, rx, ry)
    ry += 28
  }
}

function drawThreeColGrid(ctx, topY, maxW, cols, bottomLimit = FOOTER_TOP - 14) {
  if (!cols || cols.length < 3) return
  const w = maxW
  const cw = (w - 32) / 3
  const x0 = PAD
  const x1 = x0 + 16
  const x2 = x1 + cw + 16
  const x3 = x2 + cw + 16
  const labelH = 24
  const lineGap = 20
  const maxH = Math.max(100, bottomLimit - topY - 8)
  const maxLines = Math.max(4, Math.min(16, Math.floor((maxH - labelH - 10) / lineGap)))

  ctx.font = `400 15px ${FONT_SANS}`
  const lineSets = cols.map((col) => wrapText(ctx, col.text || '', cw - 8))
  const usedLines = Math.min(maxLines, Math.max(...lineSets.map((ls) => ls.length), 1))
  const rowH = labelH + usedLines * lineGap + 10

  hairlineV(ctx, x2 - 8, topY, topY + rowH)
  hairlineV(ctx, x3 - 8, topY, topY + rowH)

  let i = 0
  for (const col of cols) {
    const bx = i === 0 ? x1 : i === 1 ? x2 : x3
    ctx.font = `500 10px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText((col.label || '').toUpperCase(), bx, topY + 4)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = PAPER
    ctx.font = `400 15px ${FONT_SANS}`
    let ly = topY + labelH
    const lines = lineSets[i] || []
    for (let li = 0; li < usedLines; li++) {
      ctx.fillText(lines[li] || '', bx, ly)
      ly += lineGap
    }
    i++
  }
}

function drawPlatformInfographic(ctx, boxTop, maxW, meta = null) {
  const x0 = PAD
  const w = maxW
  const boxH = 300
  const keywordCells = meta?.keywordCells || eightGraphicCells('TOPIC', 'SIGNAL')
  const meshLabel = (meta?.meshLabel || 'TOPIC SIGNALS').slice(0, 52)
  const bridgeCaption = meta?.bridgeCaption
    ? slideCopy(meta.bridgeCaption, 52, 120)
    : 'From your post to one clear story.'
  const footMono = meta?.footMono || 'NEWS · REGISTRY · POST'
  ctx.strokeStyle = BOX_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, x0, boxTop, w, boxH, 2)
  ctx.stroke()

  const bandY = boxTop + 14
  const n = 8
  const gap = 6
  const cellW = (w - 24 - (n - 1) * gap) / n
  const labels = ['S', 'E', 'A', 'R', 'C', 'H', 'D', 'W']
  for (let i = 0; i < n; i++) {
    const cx = x0 + 12 + i * (cellW + gap)
    ctx.fillStyle = i % 2 === 0 ? '#111814' : '#0e1210'
    roundRect(ctx, cx, bandY, cellW, 40, 4)
    ctx.fill()
    ctx.strokeStyle = RULE
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = ACCENT
    ctx.font = `600 14px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.fillText(keywordCells[i] || '·', cx + cellW / 2, bandY + 26)
    ctx.textAlign = 'left'
  }

  ctx.font = `500 9px ${FONT_MONO}`
  ctx.letterSpacing = '2.2px'
  ctx.fillStyle = MUTED
  ctx.fillText(meshLabel, x0 + w / 2 - ctx.measureText(meshLabel).width / 2, bandY + 58)
  ctx.letterSpacing = '0px'

  const arrowY = bandY + 72
  ctx.fillStyle = ACCENT_SOFT
  ctx.beginPath()
  ctx.moveTo(x0 + w / 2 - 7, arrowY)
  ctx.lineTo(x0 + w / 2 + 7, arrowY)
  ctx.lineTo(x0 + w / 2, arrowY + 12)
  ctx.closePath()
  ctx.fill()

  const graphTop = arrowY + 22
  const graphH = 118
  const gx0 = x0 + 20
  const gw = w - 40
  ctx.save()
  ctx.strokeStyle = 'rgba(62,220,129,0.12)'
  ctx.lineWidth = 1
  for (let r = 0; r < 5; r++) {
    const t = r / 4
    const y = graphTop + t * graphH
    const xL = gx0 + t * 40
    const xR = gx0 + gw - t * 28
    ctx.beginPath()
    ctx.moveTo(xL, y)
    ctx.lineTo(xR, y)
    ctx.stroke()
  }
  const nodes = [
    [0.22, 0.35],
    [0.42, 0.55],
    [0.62, 0.38],
    [0.78, 0.62],
    [0.52, 0.72],
  ]
  for (const [nx, ny] of nodes) {
    const px = gx0 + nx * gw
    const py = graphTop + ny * graphH
    ctx.fillStyle = '#1a2220'
    ctx.beginPath()
    ctx.arc(px, py, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = ACCENT_SOFT
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(62,220,129,0.25)'
  for (let a = 0; a < nodes.length - 1; a++) {
    const [nx1, ny1] = nodes[a]
    const [nx2, ny2] = nodes[a + 1]
    ctx.beginPath()
    ctx.moveTo(gx0 + nx1 * gw, graphTop + ny1 * graphH)
    ctx.lineTo(gx0 + nx2 * gw, graphTop + ny2 * graphH)
    ctx.stroke()
  }
  ctx.restore()

  ctx.font = `500 10px ${FONT_SANS}`
  ctx.fillStyle = PAPER
  ctx.fillText(bridgeCaption, x0 + w / 2 - ctx.measureText(bridgeCaption).width / 2, graphTop - 4)

  const trioY = boxTop + boxH - 52
  const tw = (w - 36) / 3
  hairlineH(ctx, x0 + 12, x0 + w - 12, trioY - 10)
  ctx.font = `500 8px ${FONT_MONO}`
  ctx.letterSpacing = '1.8px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText(footMono, x0 + 16, trioY - 2)
  ctx.letterSpacing = '0px'
}

function renderSlide(ctx, slide, index, total) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

  const maxW = SLIDE_W - PAD * 2

  switch (slide.type) {
    case 'cover': {
      const topic = (slide.topicLabel || 'Your pillar').toUpperCase()
      drawEditorialHeader(ctx, `${AUTHOR.toUpperCase()} · ${topic.slice(0, 36)}`, index, total)

      const coverFont = 54
      const coverGap = 62
      const { primary, accent } = splitHeadlineForAccent(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, coverFont)
      const headlineStart = verticalHeroBaseline(nLines, coverGap, coverFont)
      let y = drawSplitHeadline(ctx, slide.text, maxW, headlineStart, coverFont, coverGap)

      if (slide.subdeck) {
        y += 40
        const subFont = 24
        const subLineH = 36
        const barW = 4
        const textX = PAD + 18
        ctx.font = `400 ${subFont}px ${FONT_SANS}`
        const subLines = wrapText(ctx, slide.subdeck, maxW - textX + PAD - 8)
        const lineCount = subLines.length
        const firstBaseline = y + subLineH
        const lastBaseline = firstBaseline + (lineCount - 1) * subLineH
        const midY = (firstBaseline + lastBaseline) / 2
        const barH = Math.max(Math.round(subFont * 1.35), lineCount * subLineH + 8)
        const barTop = midY - barH / 2
        ctx.fillStyle = ACCENT
        ctx.fillRect(PAD, barTop, barW, barH)
        ctx.fillStyle = PAPER
        let sy = firstBaseline
        for (const sl of subLines) {
          ctx.fillText(sl, textX, sy)
          sy += subLineH
        }
        y = lastBaseline + 28
      }

      drawEditorialFooter(ctx, { showScrollCue: true, railText: slide.topicRail })
      break
    }

    case 'section': {
      drawEditorialHeader(ctx, slide.kicker || shiftKicker(1), index, total)
      const hFont = 46
      const hGap = 54
      let y = drawSplitHeadline(ctx, slide.heading, maxW, CONTENT_TOP + 8, hFont, hGap)
      y += 22
      if (slide.supporting) {
        ctx.font = `400 23px ${FONT_SANS}`
        ctx.fillStyle = PAPER
        for (const ln of wrapText(ctx, slide.supporting, maxW)) {
          ctx.fillText(ln, PAD, y)
          y += 30
        }
        y += 16
      }
      if (slide.leftCol && slide.rightCol) {
        drawCompareBox(ctx, y, maxW, slide.boxMeta, slide.leftCol, slide.rightCol)
        y += 220
      } else {
        hairlineH(ctx, PAD, SLIDE_W - PAD, y)
        y += 20
        ctx.font = `400 22px ${FONT_SANS}`
        for (let idx = 0; idx < slide.items.length; idx++) {
          const item = slide.items[idx]
          const itemText = typeof item === 'string' ? item : item.text
          const itemCite = typeof item === 'string' ? null : item.cite
          for (const il of wrapText(ctx, slideCopy(itemText, 420, 920), maxW - 8)) {
            ctx.fillText(il, PAD, y)
            y += 28
          }
          if (itemCite) {
            ctx.fillStyle = ACCENT_SOFT
            ctx.font = `italic 14px ${FONT_SANS}`
            ctx.fillText(`↳ ${itemCite}`, PAD, y + 4)
            ctx.fillStyle = PAPER
            ctx.font = `400 22px ${FONT_SANS}`
            y += 24
          }
          y += 12
          if (y > FOOTER_TOP - 100) break
        }
      }
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'bullets': {
      drawEditorialHeader(ctx, slide.kicker || shiftKicker(1), index, total)
      let y = drawSplitHeadline(ctx, slide.title, maxW, CONTENT_TOP + 6, 44, 52)
      y += 22
      hairlineH(ctx, PAD, SLIDE_W - PAD, y)
      y += 22

      const boxPad = 14
      const innerW = maxW - boxPad * 2
      const innerTop = y
      let iy = innerTop + boxPad + 8
      for (let idx = 0; idx < slide.items.length; idx++) {
        const item = slide.items[idx]
        const itemText = typeof item === 'string' ? item : item.text
        const itemCite = typeof item === 'string' ? null : item.cite
        ctx.fillStyle = ACCENT_SOFT
        ctx.font = `600 11px ${FONT_MONO}`
        ctx.letterSpacing = '1.5px'
        ctx.fillText(String(idx + 1).padStart(2, '0'), PAD + boxPad, iy)
        ctx.letterSpacing = '0px'
        ctx.fillStyle = PAPER
        ctx.font = `400 23px ${FONT_SANS}`
        const short = slideCopy(itemText, 360, 880)
        for (const il of wrapText(ctx, short, innerW - 36)) {
          ctx.fillText(il, PAD + boxPad + 36, iy)
          iy += 30
        }
        if (itemCite) {
          ctx.fillStyle = ACCENT_SOFT
          ctx.font = `italic 13px ${FONT_SANS}`
          ctx.fillText(`↳ ${itemCite}`, PAD + boxPad + 36, iy + 2)
          iy += 22
          ctx.fillStyle = PAPER
          ctx.font = `400 23px ${FONT_SANS}`
        }
        iy += 14
        if (iy > FOOTER_TOP - 120) break
      }
      const boxH = iy - innerTop + boxPad
      ctx.strokeStyle = BOX_EDGE
      ctx.lineWidth = 1
      roundRect(ctx, PAD, innerTop, maxW, boxH, 2)
      ctx.stroke()

      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'quote': {
      drawEditorialHeader(ctx, slide.kicker || 'SHIFT · PERSPECTIVE', index, total)
      const qFont = 46
      const qGap = 52
      const { primary, accent } = splitHeadlineForQuote(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, qFont)
      const startY = verticalHeroBaseline(nLines, qGap, qFont)
      drawSplitHeadlineParts(ctx, primary, accent, maxW, startY, qFont, qGap)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'cta': {
      drawEditorialHeader(ctx, slide.kicker || 'YOUR TURN', index, total)
      const cFont = 44
      const cGap = 50
      const { primary, accent } = splitHeadlineForAccent(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, cFont)
      const startY = verticalHeroBaseline(nLines, cGap, cFont)
      drawSplitHeadlineParts(ctx, primary, accent, maxW, startY, cFont, cGap)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'platform': {
      const topicHdr = (slide.topicRail || 'TOPIC').slice(0, 32)
      drawEditorialHeader(ctx, `INSIGHT · ${topicHdr}`, index, total, { monoRight: true })
      ctx.fillStyle = PAPER
      ctx.font = `700 38px ${FONT_SANS}`
      let y = CONTENT_TOP + 4
      const m = slide.titleMain || ''
      const a = slide.titleAccent || ''
      for (const line of wrapText(ctx, m, maxW)) {
        ctx.fillText(line, PAD, y)
        y += 44
      }
      ctx.fillStyle = ACCENT
      ctx.font = `700 38px ${FONT_SANS}`
      for (const line of wrapText(ctx, a, maxW)) {
        ctx.fillText(line, PAD, y)
        y += 44
      }
      ctx.fillStyle = PAPER
      ctx.font = `400 22px ${FONT_SANS}`
      y += 8
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 30
      }
      y += 10
      drawPlatformInfographic(ctx, y, maxW, slide.platformGraphic || null)
      const trioTop = y + 300 + 14
      if (slide.trio && slide.trio.length === 3) {
        const tw = (maxW - 32) / 3
        const xb = PAD
        const trioLineGap = 19
        const trioBottomCap = FOOTER_TOP - 18
        const maxTrioLines = Math.max(
          3,
          Math.min(14, Math.floor((trioBottomCap - trioTop - 52) / trioLineGap)),
        )
        let maxColLines = 0
        const trioWrapped = slide.trio.map((t) => {
          ctx.font = `400 15px ${FONT_SANS}`
          const subLines = wrapText(ctx, t.sub || '', tw - 6)
          const n = Math.min(maxTrioLines, subLines.length)
          maxColLines = Math.max(maxColLines, n)
          return { t, subLines, n }
        })
        const trioRailH = 52 + maxColLines * trioLineGap + 8
        hairlineV(ctx, xb + tw + 16, trioTop, trioTop + trioRailH)
        hairlineV(ctx, xb + (tw + 16) * 2, trioTop, trioTop + trioRailH)
        let tx = xb + 8
        for (const { t, subLines, n } of trioWrapped) {
          ctx.fillStyle = PAPER
          ctx.font = `700 18px ${FONT_SANS}`
          ctx.fillText(t.title, tx, trioTop + 22)
          ctx.font = `400 15px ${FONT_SANS}`
          ctx.fillStyle = MUTED
          let subY = trioTop + 48
          for (let si = 0; si < n; si++) {
            ctx.fillText(subLines[si], tx, subY)
            subY += trioLineGap
          }
          ctx.fillStyle = PAPER
          tx += tw + 16
        }
      }
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'pillar': {
      const pHdr = (slide.topicRail || '').slice(0, 28)
      drawEditorialHeader(ctx, pHdr ? `INSIGHT · ${pHdr}` : 'THE CATEGORY', index, total)
      let y = CONTENT_TOP + 8
      drawStrikeLabel(ctx, slide.strike || '', PAD, y, maxW)
      y += 36
      y = drawSplitHeadline(ctx, slide.headline || 'Welcome to Digital Trust.', maxW, y, 44, 50)
      y += 18
      ctx.font = `400 22px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 30
      }
      y += 22
      drawThreeColGrid(ctx, y, maxW, slide.cols || [], FOOTER_TOP - 14)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'closer': {
      drawEditorialHeader(ctx, (slide.topicLabel || 'PREM IYER').toUpperCase().slice(0, 32), index, total)
      let y = CONTENT_TOP + 4
      y = drawSplitHeadline(ctx, slide.text || '', maxW, y, 44, 50)
      y += 16
      ctx.font = `400 22px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.sub || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 30
      }
      y += 18
      hairlineH(ctx, PAD, SLIDE_W - PAD, y)
      y += 28

      const colW = (maxW - 32) / 3
      const x1 = PAD
      const x2 = PAD + colW + 16
      const x3 = PAD + (colW + 16) * 2
      hairlineV(ctx, x2 - 8, y, y + 100)
      hairlineV(ctx, x3 - 8, y, y + 100)

      ctx.fillStyle = PAPER
      ctx.font = `700 52px ${FONT_SANS}`
      ctx.fillText(String(slide.statN ?? 5), x1, y + 44)
      ctx.font = `700 52px ${FONT_SANS}`
      ctx.textAlign = 'center'
      ctx.fillText('∞', x2 + colW / 2 - 8, y + 44)
      ctx.textAlign = 'left'
      ctx.font = `700 40px ${FONT_SANS}`
      ctx.fillText('Machine', x3, y + 40)

      ctx.fillStyle = ACCENT_SOFT
      ctx.font = `500 8px ${FONT_MONO}`
      ctx.letterSpacing = '1.8px'
      ctx.fillText((slide.statWord || 'modes').toUpperCase(), x1, y + 62)
      ctx.fillText('SURFACES MONITORED', x2, y + 62)
      ctx.fillText('RESPONSE LOOP', x3, y + 62)
      ctx.letterSpacing = '0px'
      ctx.fillStyle = ACCENT
      ctx.font = `500 8px ${FONT_MONO}`
      const micro = slide.statMicro || 'PLAN · SHIP · PROVE'
      ctx.fillText(micro, x1, y + 78)
      ctx.fillText('THREAD + PDF', x2, y + 78)
      ctx.fillText('HOURS, NOT WEEKS', x3, y + 78)

      ctx.textAlign = 'right'
      ctx.font = `600 15px ${FONT_MONO}`
      ctx.fillStyle = ACCENT
      ctx.fillText('linkedin.com/in/premiyer →', SLIDE_W - SIDE, FOOTER_TOP - 48)
      ctx.textAlign = 'left'

      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    default:
      drawEditorialHeader(ctx, 'INSIGHT · CAROUSEL', index, total)
      ctx.fillStyle = PAPER
      ctx.font = `400 28px ${FONT_SANS}`
      ctx.fillText('Slide', PAD, CONTENT_TOP + 40)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
  }
}

function generateCarouselCaption(postText, topicId = '') {
  if (!postText) return ''
  const lines = postText.split('\n').filter((l) => l.trim())
  const hook = lines[0] || ''
  const reHook = lines.slice(1, 4).find((l) => /^\(/.test(l.trim()))

  const cta = lines.find((l) => /\?$/.test(l.trim()) && !/^#/.test(l.trim()) && l.length > 20)
  const hashtags = lines.filter((l) => l.trim().startsWith('#')).join(' ').trim()

  const dataPoints = []
  for (const line of lines.slice(1)) {
    if (/\d+%|\$[\d.]+[BMK]?|\d+x/.test(line) && line.length < 150 && dataPoints.length < 4) {
      const clean = line.replace(/^(→|➜|►|▸|•|\d+\.|-)\s*/, '').trim()
      if (clean.length > 15) dataPoints.push(clean)
    }
  }

  const slideCount = Math.max(5, Math.round(postText.length / 200))

  const captionRng = mulberry32((fnv1a(`${topicId}:${hook.slice(0, 40)}:${Date.now()}`) >>> 0) || 0xace12345)
  const bridgeTemplates = [
    `I broke this down into a ${slideCount}-slide visual guide.\n\nSwipe through — but here's the preview:\n\n`,
    `Here is a ${slideCount}-slide walkthrough—tight on purpose.\n\nSkim the preview, then open the PDF:\n\n`,
    `Turned the thread into a ${slideCount}-slide breakdown.\n\nQuick scan below—full story in the carousel:\n\n`,
    `Packaged this as ${slideCount} slides so you can share it with your team.\n\nPreview first, PDF attached:\n\n`,
  ]
  const bridge = bridgeTemplates[Math.floor(captionRng() * bridgeTemplates.length) % bridgeTemplates.length]

  let caption = ''
  if (topicId) {
    caption += `Topic: ${getTopicLabel(topicId)}.\n\n`
  }
  caption += `${hook}\n\n`

  if (reHook) {
    caption += `${reHook.trim()}\n\n`
  }

  caption += bridge

  if (dataPoints.length > 0) {
    for (const dp of dataPoints) {
      caption += `→ ${dp}\n`
    }
    caption += `\n`
  }

  const closers = [
    `Every stat is sourced; each slide is one decision-useful beat.\n\nThe PDF is for dwell—the caption above does the ranking work.\n\n`,
    `Built to read fast: claim → proof → so-what per slide.\n\nAttach the document and let people swipe—depth signals matter in 2026.\n\n`,
    `If someone only reads the caption, they should still learn something concrete.\n\nFull walkthrough in the PDF.\n\n`,
  ]
  caption += closers[Math.floor(captionRng() * closers.length) % closers.length]

  const fallbackQuestions = [
    `What would you add? Drop your take in the comments.\n\n`,
    `Which slide would you send to your CIO first—and why?\n\n`,
    `If you had to cut this to 3 slides, what stays?\n\n`,
  ]

  if (cta) {
    caption += `${cta.trim()}\n\n`
  } else {
    caption += fallbackQuestions[Math.floor(captionRng() * fallbackQuestions.length) % fallbackQuestions.length]
  }

  if (captionRng() > 0.4) {
    caption += `Save this PDF for your next CIO or board readout if the framing helps.\n\n`
  }

  if (hashtags) {
    caption += hashtags
  }

  return caption.trim()
}

export default function CarouselGenerator({ postText, topicId = '' }) {
  const [generating, setGenerating] = useState(false)
  const [previewSlides, setPreviewSlides] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const canvasRef = useRef(null)
  const { msg: carouselMsg, flashOk, flashErr } = useFlashFeedback()

  const slides = useMemo(() => parseIntoSlides(postText, topicId), [postText, topicId])
  const captionScore = useMemo(() => (captionText ? scorePost(captionText).total : null), [captionText])

  useEffect(() => {
    if (!postText || slides.length === 0) {
      setPreviewSlides([])
      setCaptionText('')
      setPreviewIndex(0)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = SLIDE_W
    canvas.height = SLIDE_H
    const ctx = canvas.getContext('2d')
    const images = []
    for (let i = 0; i < slides.length; i++) {
      renderSlide(ctx, slides[i], i, slides.length)
      images.push(canvas.toDataURL('image/png'))
    }
    setPreviewSlides(images)
    setPreviewIndex((prev) => (prev >= images.length ? 0 : prev))
    setCaptionText(generateCarouselCaption(postText, topicId))
  }, [postText, topicId, slides])

  async function copyCaption() {
    const result = await copyToClipboard(captionText)
    if (!result.ok) {
      flashErr(result.error || 'Could not copy caption.')
      return
    }
    setCaptionCopied(true)
    flashOk('Caption copied — paste as your LinkedIn post text.')
    setTimeout(() => setCaptionCopied(false), 3000)
  }

  async function downloadPDF() {
    if (slides.length === 0) return
    setGenerating(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = SLIDE_W
      canvas.height = SLIDE_H
      const ctx = canvas.getContext('2d')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [SLIDE_W, SLIDE_H] })

      for (let i = 0; i < slides.length; i++) {
        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H])
        renderSlide(ctx, slides[i], i, slides.length)
        const imgData = canvas.toDataURL('image/png')
        pdf.addImage(imgData, 'PNG', 0, 0, SLIDE_W, SLIDE_H)
      }

      pdf.save(`linkedin-carousel-${Date.now()}.pdf`)
      flashOk(`Carousel PDF downloaded (${slides.length} slides).`)
    } catch (err) {
      flashErr(err?.message || 'PDF download failed — try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (!postText) return null

  return (
    <div className="carousel-gen fade-in-up">
      <div className="carousel-info">
        <span className="carousel-count">{slides.length} slides</span>
        <span className="carousel-tip">{CAROUSEL_ALGORITHM_TIP}</span>
      </div>

      {previewSlides.length > 0 && (
        <div className="carousel-preview">
          <p className="carousel-preview-explainer">
            <strong>Live preview</strong> — same 1080×1080 canvas as the PDF (use ← → to swipe). Slides are parsed
            from <strong>your post</strong> and anchored to <strong>{getTopicLabel(topicId) || 'the topic you picked'}</strong>{' '}
            (headlines and stats still come from the same topic in the infographic). Decorative layout only — no
            unrelated “template” storylines.
          </p>
          <img
            src={previewSlides[previewIndex]}
            alt={`Slide ${previewIndex + 1}`}
            className="carousel-slide"
            ref={canvasRef}
          />
          <div className="carousel-nav">
            <button
              className="carousel-nav-btn"
              onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
              disabled={previewIndex === 0}
            >
              ←
            </button>
            <span className="carousel-page">
              {previewIndex + 1} / {previewSlides.length}
            </span>
            <button
              className="carousel-nav-btn"
              onClick={() => setPreviewIndex(Math.min(previewSlides.length - 1, previewIndex + 1))}
              disabled={previewIndex === previewSlides.length - 1}
            >
              →
            </button>
          </div>
        </div>
      )}

      {captionText && (
        <div className="carousel-caption-section">
          <div className="carousel-caption-header">
            <h3 className="carousel-caption-title">Post Caption</h3>
            <span className="carousel-caption-hint">
              Paste this as your LinkedIn post text — then attach the carousel PDF below it
            </span>
          </div>
          <textarea
            className="carousel-caption-textarea"
            value={captionText}
            onChange={(e) => setCaptionText(e.target.value)}
            rows={10}
          />
          <div className="carousel-caption-meta">
            <span className="carousel-caption-chars">
              {captionText.length} chars · {captionText.split(/\s+/).filter(Boolean).length} words
              {captionScore != null && (
                <span className={`carousel-caption-score ${captionScore >= 95 ? 'premier' : ''}`}>
                  · Caption score {captionScore}/100 (target 95+)
                </span>
              )}
            </span>
            <button className="carousel-caption-copy" onClick={() => void copyCaption()}>
              {captionCopied ? 'Copied ✓' : 'Copy Caption'}
            </button>
          </div>
          <ActionFeedback msg={carouselMsg} />
        </div>
      )}

      <div className="carousel-actions">
        <button className="carousel-download-btn" onClick={() => void downloadPDF()} disabled={generating}>
          {generating ? 'Generating PDF...' : 'Download Carousel PDF'}
        </button>
        <p className="carousel-hint">
          How to post: 1) Copy the caption above → 2) Download the PDF → 3) On LinkedIn, paste the caption as your post
          text, then click the document icon to attach the PDF
        </p>
      </div>
    </div>
  )
}
