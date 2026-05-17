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

const SLIDE_W = 1080
const SLIDE_H = 1080
const SIDE = 56
const PAD = 72
const CONTENT_TOP = 118
const FOOTER_TOP = SLIDE_H - 100

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

function sliceForSlide(s, maxLen = 200) {
  const t = (s || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.length <= maxLen) return t
  const cut = t.slice(0, maxLen - 1)
  const sp = cut.lastIndexOf(' ')
  return `${sp > 48 ? cut.slice(0, sp) : cut}…`
}

function bulletTexts(bullets, n) {
  return bullets.slice(0, n).map((b) => (typeof b === 'string' ? b : b?.text || '')).filter(Boolean)
}

function parseIntoSlides(text, topicId = '') {
  if (!text) return []
  const lines = text.split('\n').filter((l) => l.trim())
  const slides = []
  const hook = lines[0] || ''
  const topicLabel = getTopicLabel(topicId)
  let subdeck = ''
  const parenLine = lines.slice(1, 6).find((l) => /^\([^)]{12,}\)/.test(l.trim()))
  if (parenLine) subdeck = parenLine.replace(/^\(|\)\s*$|\)$/g, '').trim()
  else {
    const prose = lines.slice(1, 8).find((l) => {
      const t = l.trim()
      return t.length > 45 && !t.startsWith('#') && !/^(→|➜|►|▸|•|\d+\.|-)/.test(t) && !/\?$/.test(t)
    })
    if (prose) subdeck = prose.trim().slice(0, 280)
  }
  slides.push({ type: 'cover', text: hook, topicLabel, subdeck })

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
        supporting: sliceForSlide(t0, 220),
        boxMeta: 'INSIDE — PIPELINE — OPEN MARKET',
        leftCol: t0
          ? { title: 'THE CONSTRAINT', body: sliceForSlide(t0, 140) }
          : null,
        rightCol: t1
          ? { title: 'THE LEVERAGE', body: sliceForSlide(t1, 140) }
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
    const bt = bulletTexts(bullets, 3)
    slides.push({
      type: 'platform',
      titleMain: 'One narrative across every execution surface.',
      titleAccent: 'At machine speed.',
      body: sliceForSlide(bt[0] || hook, 170),
      trio: [
        { title: 'Roadmap', sub: sliceForSlide(bt[0] || 'Clarity on what to instrument before you scale spend.', 72) },
        { title: 'Ship', sub: sliceForSlide(bt[1] || 'Tight loops: smaller batches, measurable risk reduction each week.', 72) },
        { title: 'Prove', sub: sliceForSlide(bt[2] || 'Receipts leaders trust: citations, deltas, and owner names.', 72) },
      ],
    })
  }

  const bt3 = bulletTexts(bullets, 3)
  const topicShort = (topicLabel.split(':')[0] || topicLabel).trim().slice(0, 44)
  slides.push({
    type: 'pillar',
    strike: STRIKE_BY_TOPIC[topicId] || 'HYPE — PILOTS — SLIDEWARE',
    headline: `Welcome to ${topicShort}.`,
    body: sliceForSlide(
      standaloneStatements[0] ||
        subdeck ||
        'Cybersecurity is converging on one outcome: securing how you show up in the world — not just what you run internally.',
      200,
    ),
    cols: [
      {
        label: 'EXTERNAL',
        text: sliceForSlide(bt3[0] || 'Presence across channels buyers actually scan before they trust you.', 100),
      },
      {
        label: 'ENTITY-LEVEL',
        text: sliceForSlide(bt3[1] || 'Risk lives in brands, teams, products, and agents — not only in tickets.', 100),
      },
      {
        label: 'AI-NATIVE',
        text: sliceForSlide(bt3[2] || 'Automation without receipts becomes liability at machine speed.', 100),
      },
    ],
  })

  const allCites = findCitations(text)
  const statN = Math.min(5, Math.max(3, Math.ceil(bullets.length / 2) || 3))
  slides.push({
    type: 'closer',
    text: 'The Agentic Software Transformation Playbook.',
    sub:
      'We package how teams show up in the market — protecting narrative, proof, and velocity on the agentic internet.',
    hashtags,
    allCites,
    topicLabel,
    statN,
    statWord: 'operating modes',
    statMicro: 'PLAN · SHIP · MEASURE · GOVERN · AGENT',
  })

  return slides
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

function drawEditorialFooter(ctx, { showScrollCue = false } = {}) {
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
  ctx.fillText(PLATFORM_RAIL, SLIDE_W - SIDE, railY)
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
  ctx.font = `400 18px ${FONT_SANS}`
  ctx.fillStyle = PAPER
  let ly = labelBottom
  for (const line of wrapText(ctx, leftCol.body, colW)) {
    ctx.fillText(line, lx, ly)
    ly += 26
  }
  let ry = labelBottom
  for (const line of wrapText(ctx, rightCol.body, colW)) {
    ctx.fillText(line, rx, ry)
    ry += 26
  }
}

function drawThreeColGrid(ctx, topY, maxW, cols, rowH = 118) {
  const x0 = PAD
  const w = maxW
  const cw = (w - 32) / 3
  const x1 = x0 + 16
  const x2 = x1 + cw + 16
  const x3 = x2 + cw + 16
  hairlineV(ctx, x2 - 8, topY, topY + rowH)
  hairlineV(ctx, x3 - 8, topY, topY + rowH)
  let i = 0
  for (const col of cols) {
    const bx = i === 0 ? x1 : i === 1 ? x2 : x3
    ctx.font = `500 9px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText(col.label.toUpperCase(), bx, topY + 4)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = PAPER
    ctx.font = `400 17px ${FONT_SANS}`
    let ly = topY + 28
    for (const line of wrapText(ctx, col.text, cw - 8)) {
      ctx.fillText(line, bx, ly)
      ly += 24
    }
    i++
  }
}

function drawPlatformInfographic(ctx, boxTop, maxW) {
  const x0 = PAD
  const w = maxW
  const boxH = 300
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
    ctx.fillText(labels[i] || '·', cx + cellW / 2, bandY + 26)
    ctx.textAlign = 'left'
  }

  ctx.font = `500 9px ${FONT_MONO}`
  ctx.letterSpacing = '2.2px'
  ctx.fillStyle = MUTED
  const cap = 'MULTI-SURFACE SIGNAL MESH'
  ctx.fillText(cap, x0 + w / 2 - ctx.measureText(cap).width / 2, bandY + 58)
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
  const oneSignal = 'One signal. Their whole campaign structure visible.'
  ctx.fillText(oneSignal, x0 + w / 2 - ctx.measureText(oneSignal).width / 2, graphTop - 4)

  const trioY = boxTop + boxH - 52
  const tw = (w - 36) / 3
  hairlineH(ctx, x0 + 12, x0 + w - 12, trioY - 10)
  ctx.font = `500 8px ${FONT_MONO}`
  ctx.letterSpacing = '1.8px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText('THREATS REMOVED IN DAYS, NOT QUARTERS', x0 + 16, trioY - 2)
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

      ctx.fillStyle = MUTED
      ctx.font = `500 10px ${FONT_MONO}`
      ctx.letterSpacing = '2.6px'
      const pre = `A NOTE ON ${topic.slice(0, 40)}`
      ctx.fillText(pre, PAD, CONTENT_TOP - 6)
      ctx.letterSpacing = '0px'

      let y = drawSplitHeadline(ctx, slide.text, maxW, CONTENT_TOP + 20, 48, 54)

      if (slide.subdeck) {
        y += 26
        const barX = PAD
        const textX = PAD + 18
        const barTop = y - 4
        const subLines = wrapText(ctx, slide.subdeck, maxW - 24)
        const barH = Math.max(36, subLines.length * 28 + 8)
        ctx.fillStyle = ACCENT
        ctx.fillRect(barX, barTop, 3, barH)
        ctx.fillStyle = PAPER
        ctx.font = `400 22px ${FONT_SANS}`
        let sy = y
        for (const sl of subLines) {
          ctx.fillText(sl, textX, sy)
          sy += 28
        }
        y = sy + 16
      }

      drawEditorialFooter(ctx, { showScrollCue: true })
      break
    }

    case 'section': {
      drawEditorialHeader(ctx, slide.kicker || shiftKicker(1), index, total)
      let y = drawSplitHeadline(ctx, slide.heading, maxW, CONTENT_TOP + 6, 42, 48)
      y += 18
      if (slide.supporting) {
        ctx.font = `400 21px ${FONT_SANS}`
        ctx.fillStyle = PAPER
        for (const ln of wrapText(ctx, slide.supporting, maxW)) {
          ctx.fillText(ln, PAD, y)
          y += 28
        }
        y += 14
      }
      if (slide.leftCol && slide.rightCol) {
        drawCompareBox(ctx, y, maxW, slide.boxMeta, slide.leftCol, slide.rightCol)
        y += 220
      } else {
        hairlineH(ctx, PAD, SLIDE_W - PAD, y)
        y += 20
        ctx.font = `400 20px ${FONT_SANS}`
        for (let idx = 0; idx < slide.items.length; idx++) {
          const item = slide.items[idx]
          const itemText = typeof item === 'string' ? item : item.text
          const itemCite = typeof item === 'string' ? null : item.cite
          for (const il of wrapText(ctx, sliceForSlide(itemText, 160), maxW - 8)) {
            ctx.fillText(il, PAD, y)
            y += 28
          }
          if (itemCite) {
            ctx.fillStyle = ACCENT_SOFT
            ctx.font = `italic 14px ${FONT_SANS}`
            ctx.fillText(`↳ ${itemCite}`, PAD, y + 4)
            ctx.fillStyle = PAPER
            ctx.font = `400 20px ${FONT_SANS}`
            y += 24
          }
          y += 12
          if (y > FOOTER_TOP - 100) break
        }
      }
      drawEditorialFooter(ctx)
      break
    }

    case 'bullets': {
      drawEditorialHeader(ctx, slide.kicker || shiftKicker(1), index, total)
      let y = drawSplitHeadline(ctx, slide.title, maxW, CONTENT_TOP + 6, 40, 46)
      y += 20
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
        ctx.font = `400 21px ${FONT_SANS}`
        const short = sliceForSlide(itemText, 130)
        for (const il of wrapText(ctx, short, innerW - 36)) {
          ctx.fillText(il, PAD + boxPad + 36, iy)
          iy += 28
        }
        if (itemCite) {
          ctx.fillStyle = ACCENT_SOFT
          ctx.font = `italic 13px ${FONT_SANS}`
          ctx.fillText(`↳ ${itemCite}`, PAD + boxPad + 36, iy + 2)
          iy += 22
          ctx.fillStyle = PAPER
          ctx.font = `400 21px ${FONT_SANS}`
        }
        iy += 14
        if (iy > FOOTER_TOP - 120) break
      }
      const boxH = iy - innerTop + boxPad
      ctx.strokeStyle = BOX_EDGE
      ctx.lineWidth = 1
      roundRect(ctx, PAD, innerTop, maxW, boxH, 2)
      ctx.stroke()

      drawEditorialFooter(ctx)
      break
    }

    case 'quote': {
      drawEditorialHeader(ctx, slide.kicker || 'SHIFT · PERSPECTIVE', index, total)
      let y = drawSplitHeadline(ctx, sliceForSlide(slide.text, 90), maxW, CONTENT_TOP + 10, 40, 46)
      y += 20
      ctx.font = `400 22px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      const rest = slide.text.length > 90 ? slide.text.slice(90) : slide.text
      for (const ln of wrapText(ctx, sliceForSlide(rest, 320), maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 30
      }
      y += 16
      ctx.fillStyle = ACCENT
      ctx.fillRect(PAD, y, 3, 44)
      ctx.fillStyle = MUTED
      ctx.font = `500 12px ${FONT_MONO}`
      ctx.letterSpacing = '2px'
      ctx.fillText('— OPERATOR NOTE', PAD + 14, y + 16)
      ctx.letterSpacing = '0px'
      drawEditorialFooter(ctx)
      break
    }

    case 'cta': {
      drawEditorialHeader(ctx, slide.kicker || 'YOUR TURN', index, total)
      let y = drawSplitHeadline(ctx, slide.text, maxW, CONTENT_TOP + 36, 38, 44)
      y += 32
      ctx.fillStyle = ACCENT_SOFT
      ctx.font = `500 10px ${FONT_MONO}`
      ctx.letterSpacing = '1.8px'
      ctx.fillText('DWELL + COMMENT DEPTH BEAT VANITY REACH — MAKE IT EASY TO DISAGREE', PAD, y)
      ctx.letterSpacing = '0px'
      drawEditorialFooter(ctx)
      break
    }

    case 'platform': {
      drawEditorialHeader(ctx, 'THE PLATFORM', index, total, { monoRight: true })
      ctx.fillStyle = PAPER
      ctx.font = `700 36px ${FONT_SANS}`
      let y = CONTENT_TOP + 4
      const m = slide.titleMain || ''
      const a = slide.titleAccent || ''
      for (const line of wrapText(ctx, m, maxW)) {
        ctx.fillText(line, PAD, y)
        y += 42
      }
      ctx.fillStyle = ACCENT
      ctx.font = `700 36px ${FONT_SANS}`
      for (const line of wrapText(ctx, a, maxW)) {
        ctx.fillText(line, PAD, y)
        y += 42
      }
      ctx.fillStyle = PAPER
      ctx.font = `400 20px ${FONT_SANS}`
      y += 8
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 28
      }
      y += 10
      drawPlatformInfographic(ctx, y, maxW)
      const trioTop = y + 300 + 14
      if (slide.trio && slide.trio.length === 3) {
        const tw = (maxW - 32) / 3
        const xb = PAD
        hairlineV(ctx, xb + tw + 16, trioTop, trioTop + 72)
        hairlineV(ctx, xb + (tw + 16) * 2, trioTop, trioTop + 72)
        let tx = xb + 8
        for (const t of slide.trio) {
          ctx.fillStyle = PAPER
          ctx.font = `700 22px ${FONT_SANS}`
          ctx.fillText(t.title, tx, trioTop + 22)
          ctx.font = `400 14px ${FONT_SANS}`
          ctx.fillStyle = MUTED
          let subY = trioTop + 46
          const subLines = wrapText(ctx, t.sub || '', tw - 4)
          for (let si = 0; si < Math.min(2, subLines.length); si++) {
            ctx.fillText(subLines[si], tx, subY)
            subY += 18
          }
          ctx.fillStyle = PAPER
          tx += tw + 16
        }
      }
      drawEditorialFooter(ctx)
      break
    }

    case 'pillar': {
      drawEditorialHeader(ctx, 'THE CATEGORY', index, total)
      let y = CONTENT_TOP + 8
      drawStrikeLabel(ctx, slide.strike || '', PAD, y, maxW)
      y += 36
      y = drawSplitHeadline(ctx, slide.headline || 'Welcome to Digital Trust.', maxW, y, 40, 44)
      y += 16
      ctx.font = `400 21px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 28
      }
      y += 22
      drawThreeColGrid(ctx, y, maxW, slide.cols || [], 108)
      drawEditorialFooter(ctx)
      break
    }

    case 'closer': {
      drawEditorialHeader(ctx, (slide.topicLabel || 'PREM IYER').toUpperCase().slice(0, 32), index, total)
      let y = CONTENT_TOP + 4
      y = drawSplitHeadline(ctx, slide.text || '', maxW, y, 40, 44)
      y += 14
      ctx.font = `400 20px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.sub || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += 28
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

      drawEditorialFooter(ctx)
      break
    }

    default:
      drawEditorialHeader(ctx, 'INSIGHT · CAROUSEL', index, total)
      ctx.fillStyle = PAPER
      ctx.font = `400 28px ${FONT_SANS}`
      ctx.fillText('Slide', PAD, CONTENT_TOP + 40)
      drawEditorialFooter(ctx)
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

  let caption = `${hook}\n\n`

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
            <strong>Live preview</strong> — same 1080×1080 canvas as the PDF (use ← → to swipe). One clear beat per
            slide for dwell; the caption below still carries hook, proof, and a sharp question for the feed.
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
