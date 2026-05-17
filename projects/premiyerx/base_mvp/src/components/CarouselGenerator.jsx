import { useState, useRef, useCallback, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import { findCitationsForLine, findCitations } from '../data/citations'
import { scorePost } from '../data/algorithmRules'
import { CAROUSEL_ALGORITHM_TIP } from '../data/linkedinAlgorithm2026'
import { fnv1a, mulberry32 } from '../utils/generationVariety'
import { copyToClipboard } from '../utils/clipboard'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

const SLIDE_W = 1080
const SLIDE_H = 1080
const PAD = 80
const BG = '#0a0a0a'
const GREEN = '#3EDC81'
const GREEN_DIM = 'rgba(62, 220, 129, 0.08)'
const GREEN_BORDER = 'rgba(62, 220, 129, 0.25)'
const WHITE = '#ffffff'
const DIM = '#666666'
const CARD_BG = '#141414'
const CARD_BORDER = '#1e1e1e'
const AUTHOR = 'Prem Iyer'
const AUTHOR_TITLE = 'AI Software Transformation'

function rotateTitleBank(titles, topicId, hook) {
  if (!titles || titles.length <= 1) return titles
  const seed =
    (fnv1a(`${topicId || 'x'}:${(hook || '').slice(0, 48)}`) ^ (Date.now() & 0xffffffff)) >>> 0
  const rng = mulberry32(seed || 0xfeedbeef)
  const offset = Math.floor(rng() * titles.length) % titles.length
  return [...titles.slice(offset), ...titles.slice(0, offset)]
}

function parseIntoSlides(text, topicId = '') {
  if (!text) return []
  const lines = text.split('\n').filter((l) => l.trim())
  const slides = []
  const hook = lines[0] || ''
  slides.push({ type: 'cover', text: hook })

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

  if (sections.length >= 2) {
    for (let si = 0; si < sections.length; si++) {
      const items = sections[si].items.slice(0, 4)
      const cites = items.map((it) => it.cite).filter(Boolean)
      slides.push({
        type: 'section',
        heading: sections[si].heading,
        items,
        slideNum: si + 1,
        totalSections: sections.length,
        cites: [...new Set(cites)],
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
      })
    }
  }

  if (standaloneStatements.length > 0) {
    const best = standaloneStatements.reduce((a, b) => a.length > b.length ? a : b)
    if (best.length > 50) {
      slides.push({ type: 'quote', text: best })
    }
  }

  const hashtags = lines.filter((l) => l.trim().startsWith('#')).join(' ')
  const cta = lines.find((l) =>
    /\?$/.test(l.trim()) && !/^#/.test(l.trim()) && l.length > 20
  )

  if (cta) {
    slides.push({ type: 'cta', text: cta.trim() })
  }

  const allCites = findCitations(text)
  slides.push({ type: 'closer', text: 'Follow for daily insights on AI transformation', hashtags, allCites })

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
  else
    titles.push('The Data', 'The Shift', 'The Takeaway')
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

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function renderSlideChrome(ctx, index, total) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

  const grad = ctx.createLinearGradient(0, 0, 0, SLIDE_H)
  grad.addColorStop(0, 'rgba(62, 220, 129, 0.02)')
  grad.addColorStop(0.5, 'transparent')
  grad.addColorStop(1, 'rgba(62, 220, 129, 0.01)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

  const progress = ((index + 1) / total) * SLIDE_W
  ctx.fillStyle = 'rgba(62, 220, 129, 0.10)'
  ctx.fillRect(0, 0, SLIDE_W, 5)
  ctx.fillStyle = GREEN
  ctx.fillRect(0, 0, progress, 5)

  ctx.fillStyle = CARD_BG
  ctx.fillRect(0, SLIDE_H - 60, SLIDE_W, 60)
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, SLIDE_H - 60, SLIDE_W, 1)

  ctx.fillStyle = GREEN
  ctx.font = '600 16px Inter, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(AUTHOR, PAD, SLIDE_H - 28)
  ctx.fillStyle = DIM
  ctx.font = '400 14px Inter, sans-serif'
  ctx.fillText(`  ·  ${AUTHOR_TITLE}`, PAD + ctx.measureText(AUTHOR).width, SLIDE_H - 28)

  ctx.fillStyle = DIM
  ctx.font = '500 18px Inter, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`${index + 1} / ${total}`, SLIDE_W - PAD, SLIDE_H - 28)

  ctx.textAlign = 'left'
}

function renderSlide(ctx, slide, index, total) {
  renderSlideChrome(ctx, index, total)

  switch (slide.type) {
    case 'cover': {
      const coverGrad = ctx.createRadialGradient(SLIDE_W / 2, SLIDE_H / 2, 0, SLIDE_W / 2, SLIDE_H / 2, 600)
      coverGrad.addColorStop(0, 'rgba(62, 220, 129, 0.06)')
      coverGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = coverGrad
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

      ctx.strokeStyle = GREEN_BORDER
      ctx.lineWidth = 1
      ctx.strokeRect(PAD - 20, PAD + 40, SLIDE_W - PAD * 2 + 40, SLIDE_H - PAD * 2 - 60)

      ctx.fillStyle = GREEN
      ctx.globalAlpha = 0.04
      ctx.font = 'bold 300px Inter, sans-serif'
      ctx.fillText('"', PAD - 30, 350)
      ctx.globalAlpha = 1

      ctx.fillStyle = GREEN
      ctx.font = 'bold 52px Inter, sans-serif'
      const lines = wrapText(ctx, slide.text, SLIDE_W - PAD * 2 - 40)
      const blockH = lines.length * 66
      const startY = (SLIDE_H - 60) / 2 - blockH / 2 + 30
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], PAD, startY + i * 66)
      }

      ctx.fillStyle = GREEN
      ctx.fillRect(PAD, startY + blockH + 30, 80, 3)

      ctx.fillStyle = DIM
      ctx.font = '500 22px Inter, sans-serif'
      ctx.fillText('Swipe to explore →', PAD, startY + blockH + 68)

      break
    }

    case 'section': {
      let y = PAD + 30

      ctx.fillStyle = GREEN
      ctx.font = 'bold 140px Inter, sans-serif'
      ctx.globalAlpha = 0.04
      ctx.textAlign = 'right'
      ctx.fillText(`0${slide.slideNum}`, SLIDE_W - PAD + 10, SLIDE_H - 90)
      ctx.textAlign = 'left'
      ctx.globalAlpha = 1

      ctx.fillStyle = GREEN
      drawRoundedRect(ctx, PAD, y, 5, 44, 2)
      ctx.fill()

      ctx.fillStyle = GREEN
      ctx.font = 'bold 36px Inter, sans-serif'
      const headLines = wrapText(ctx, slide.heading, SLIDE_W - PAD * 2 - 30)
      for (const hl of headLines) {
        ctx.fillText(hl, PAD + 22, y + 32)
        y += 46
      }

      y += 28

      for (let idx = 0; idx < slide.items.length; idx++) {
        const item = slide.items[idx]
        const itemText = typeof item === 'string' ? item : item.text
        const itemCite = typeof item === 'string' ? null : item.cite
        const textStartX = PAD + 68
        const textRightPad = 30
        const availW = SLIDE_W - PAD - textStartX - textRightPad
        const itemLines = wrapText(ctx, itemText, availW)
        const citeH = itemCite ? 28 : 0
        const cardH = Math.max(100, itemLines.length * 36 + 48 + citeH)

        drawRoundedRect(ctx, PAD, y, SLIDE_W - PAD * 2, cardH, 14)
        ctx.fillStyle = CARD_BG
        ctx.fill()
        ctx.strokeStyle = CARD_BORDER
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = GREEN
        drawRoundedRect(ctx, PAD, y + 14, 4, cardH - 28, 2)
        ctx.fill()

        const numX = PAD + 22
        const numY = y + 32
        drawRoundedRect(ctx, numX, numY - 16, 32, 32, 8)
        ctx.fillStyle = GREEN_DIM
        ctx.fill()
        ctx.strokeStyle = GREEN_BORDER
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = GREEN
        ctx.font = 'bold 16px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${idx + 1}`, numX + 16, numY + 6)
        ctx.textAlign = 'left'

        ctx.fillStyle = WHITE
        ctx.font = '400 28px Inter, sans-serif'
        let textY = y + 38
        for (const il of itemLines) {
          ctx.fillText(il, textStartX, textY)
          textY += 36
        }

        if (itemCite) {
          ctx.fillStyle = 'rgba(62, 220, 129, 0.45)'
          ctx.font = 'italic 16px Inter, sans-serif'
          ctx.fillText(`↳ ${itemCite}`, textStartX, textY + 4)
        }

        y += cardH + 14
      }

      break
    }

    case 'bullets': {
      let y = PAD + 30

      ctx.fillStyle = GREEN
      ctx.font = 'bold 140px Inter, sans-serif'
      ctx.globalAlpha = 0.04
      ctx.textAlign = 'right'
      ctx.fillText(`0${slide.slideNum}`, SLIDE_W - PAD + 10, SLIDE_H - 90)
      ctx.textAlign = 'left'
      ctx.globalAlpha = 1

      ctx.fillStyle = GREEN
      drawRoundedRect(ctx, PAD, y, 5, 40, 2)
      ctx.fill()
      ctx.fillStyle = GREEN
      ctx.font = 'bold 34px Inter, sans-serif'
      ctx.fillText(slide.title, PAD + 22, y + 30)
      y += 68

      for (let idx = 0; idx < slide.items.length; idx++) {
        const item = slide.items[idx]
        const itemText = typeof item === 'string' ? item : item.text
        const itemCite = typeof item === 'string' ? null : item.cite
        const bTextStartX = PAD + 72
        const bTextRightPad = 30
        const bAvailW = SLIDE_W - PAD - bTextStartX - bTextRightPad
        const itemLines = wrapText(ctx, itemText, bAvailW)
        const citeH = itemCite ? 28 : 0
        const cardH = Math.max(110, itemLines.length * 36 + 56 + citeH)

        drawRoundedRect(ctx, PAD, y, SLIDE_W - PAD * 2, cardH, 14)
        ctx.fillStyle = CARD_BG
        ctx.fill()
        ctx.strokeStyle = CARD_BORDER
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = GREEN
        drawRoundedRect(ctx, PAD, y + 14, 4, cardH - 28, 2)
        ctx.fill()

        const numX = PAD + 22
        const numY = y + 22
        drawRoundedRect(ctx, numX, numY, 36, 36, 10)
        ctx.fillStyle = GREEN_DIM
        ctx.fill()
        ctx.strokeStyle = GREEN_BORDER
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = GREEN
        ctx.font = 'bold 18px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${idx + 1}`, numX + 18, numY + 24)
        ctx.textAlign = 'left'

        ctx.fillStyle = WHITE
        ctx.font = '400 28px Inter, sans-serif'
        let textY = y + 44
        for (const il of itemLines) {
          ctx.fillText(il, bTextStartX, textY)
          textY += 36
        }

        if (itemCite) {
          ctx.fillStyle = 'rgba(62, 220, 129, 0.45)'
          ctx.font = 'italic 16px Inter, sans-serif'
          ctx.fillText(`↳ ${itemCite}`, bTextStartX, textY + 4)
        }

        y += cardH + 14
      }

      break
    }

    case 'quote': {
      const qGrad = ctx.createLinearGradient(0, 0, 0, SLIDE_H)
      qGrad.addColorStop(0, 'rgba(62, 220, 129, 0.03)')
      qGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = qGrad
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

      ctx.fillStyle = GREEN
      ctx.globalAlpha = 0.06
      ctx.font = 'bold 260px Georgia, serif'
      ctx.fillText('"', PAD - 20, 320)
      ctx.globalAlpha = 1

      ctx.fillStyle = GREEN
      drawRoundedRect(ctx, PAD, 340, 4, 160, 2)
      ctx.fill()

      ctx.fillStyle = WHITE
      ctx.font = '500 32px Inter, sans-serif'
      const qLines = wrapText(ctx, slide.text, SLIDE_W - PAD * 2 - 40)
      let qy = 380
      for (const ql of qLines) {
        ctx.fillText(ql, PAD + 28, qy)
        qy += 44
      }

      ctx.fillStyle = GREEN
      ctx.fillRect(PAD + 28, qy + 20, 60, 2)
      ctx.fillStyle = DIM
      ctx.font = '500 20px Inter, sans-serif'
      ctx.fillText(`— ${AUTHOR}`, PAD + 28, qy + 52)
      break
    }

    case 'cta': {
      const ctaGrad = ctx.createRadialGradient(SLIDE_W / 2, SLIDE_H / 2 - 50, 0, SLIDE_W / 2, SLIDE_H / 2, 500)
      ctaGrad.addColorStop(0, 'rgba(62, 220, 129, 0.05)')
      ctaGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = ctaGrad
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

      ctx.fillStyle = DIM
      ctx.font = '700 16px Inter, sans-serif'
      ctx.letterSpacing = '3px'
      ctx.fillText('YOUR TURN', PAD, SLIDE_H / 2 - 130)

      ctx.fillStyle = GREEN
      ctx.fillRect(PAD, SLIDE_H / 2 - 108, 50, 3)

      ctx.fillStyle = GREEN
      ctx.font = 'bold 40px Inter, sans-serif'
      const ctaLines = wrapText(ctx, slide.text, SLIDE_W - PAD * 2)
      let cy = SLIDE_H / 2 - 60
      for (const cl of ctaLines) {
        ctx.fillText(cl, PAD, cy)
        cy += 52
      }

      drawRoundedRect(ctx, PAD, cy + 30, 300, 54, 12)
      ctx.fillStyle = GREEN
      ctx.fill()
      ctx.fillStyle = BG
      ctx.font = '700 20px Inter, sans-serif'
      ctx.fillText('Comment below ↓', PAD + 30, cy + 64)
      break
    }

    case 'closer': {
      const closerGrad = ctx.createRadialGradient(SLIDE_W / 2, SLIDE_H / 2, 0, SLIDE_W / 2, SLIDE_H / 2, 500)
      closerGrad.addColorStop(0, 'rgba(62, 220, 129, 0.06)')
      closerGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = closerGrad
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

      ctx.strokeStyle = GREEN_BORDER
      ctx.lineWidth = 1
      ctx.strokeRect(PAD - 20, PAD + 40, SLIDE_W - PAD * 2 + 40, SLIDE_H - PAD * 2 - 80)

      const hasCites = slide.allCites && slide.allCites.length > 0
      const citesBlockH = hasCites ? Math.min(slide.allCites.length, 5) * 22 + 30 : 0
      const contentCenterY = (SLIDE_H - 60 - citesBlockH) / 2

      drawRoundedRect(ctx, SLIDE_W / 2 - 40, contentCenterY - 140, 80, 80, 40)
      ctx.fillStyle = GREEN
      ctx.fill()
      ctx.fillStyle = BG
      ctx.font = 'bold 28px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('PI', SLIDE_W / 2, contentCenterY - 92)
      ctx.textAlign = 'left'

      ctx.fillStyle = WHITE
      ctx.font = 'bold 40px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(AUTHOR, SLIDE_W / 2, contentCenterY - 30)

      ctx.fillStyle = DIM
      ctx.font = '400 22px Inter, sans-serif'
      ctx.fillText(AUTHOR_TITLE, SLIDE_W / 2, contentCenterY + 2)

      ctx.fillStyle = GREEN
      ctx.fillRect(SLIDE_W / 2 - 40, contentCenterY + 28, 80, 3)

      ctx.fillStyle = GREEN
      ctx.font = 'bold 28px Inter, sans-serif'
      const closerLines = wrapText(ctx, slide.text, SLIDE_W - PAD * 2 - 60)
      let cly = contentCenterY + 70
      for (const cl of closerLines) {
        ctx.fillText(cl, SLIDE_W / 2, cly)
        cly += 38
      }

      if (slide.hashtags) {
        ctx.fillStyle = DIM
        ctx.font = '400 16px Inter, sans-serif'
        const tagLines = wrapText(ctx, slide.hashtags, SLIDE_W - PAD * 2 - 60)
        cly += 24
        for (const tl of tagLines) {
          ctx.fillText(tl, SLIDE_W / 2, cly)
          cly += 24
        }
      }

      if (hasCites) {
        const sourcesY = SLIDE_H - 60 - citesBlockH - 10
        ctx.textAlign = 'left'
        ctx.fillStyle = DIM
        ctx.font = '600 13px Inter, sans-serif'
        ctx.globalAlpha = 0.5
        ctx.fillText('SOURCES', PAD, sourcesY)
        ctx.globalAlpha = 0.4
        ctx.font = 'italic 14px Inter, sans-serif'
        for (let ci = 0; ci < Math.min(slide.allCites.length, 5); ci++) {
          ctx.fillText(`${ci + 1}. ${slide.allCites[ci]}`, PAD, sourcesY + 20 + ci * 22)
        }
        if (slide.allCites.length > 5) {
          ctx.fillText(`+ ${slide.allCites.length - 5} more sources`, PAD, sourcesY + 20 + 5 * 22)
        }
        ctx.globalAlpha = 1
      }

      ctx.textAlign = 'left'
      break
    }
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
  const [hasGenerated, setHasGenerated] = useState(false)
  const [captionCopied, setCaptionCopied] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const canvasRef = useRef(null)
  const { msg: carouselMsg, flashOk, flashErr } = useFlashFeedback()

  const slides = parseIntoSlides(postText, topicId)
  const captionScore = useMemo(() => (captionText ? scorePost(captionText).total : null), [captionText])

  const generatePreview = useCallback(() => {
    if (slides.length === 0) return
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
    setPreviewIndex(0)
    setCaptionText(generateCarouselCaption(postText, topicId))
    setHasGenerated(true)
  }, [postText, topicId])

  if (!hasGenerated && postText) {
    generatePreview()
  }

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
            <span className="carousel-page">{previewIndex + 1} / {previewSlides.length}</span>
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
            <span className="carousel-caption-hint">Paste this as your LinkedIn post text — then attach the carousel PDF below it</span>
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
        <button className="carousel-download-btn" onClick={downloadPDF} disabled={generating}>
          {generating ? 'Generating PDF...' : 'Download Carousel PDF'}
        </button>
        <p className="carousel-hint">
          How to post: 1) Copy the caption above → 2) Download the PDF → 3) On LinkedIn, paste the caption as your post text, then click the document icon to attach the PDF
        </p>
      </div>
    </div>
  )
}
