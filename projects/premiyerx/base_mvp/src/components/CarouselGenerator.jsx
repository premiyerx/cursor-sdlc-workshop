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
import { getTopicNarrative, CAROUSEL_CTA_BANK } from '../data/topicNarratives'
import { slideCopy, subdeckDuplicatesBullet, takeawayCopy, firstSentence, balanceParentheses } from '../utils/completeSentence'

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

/** Canvas type scale — large display headlines vs. smaller supporting copy (Outtake-style stark hierarchy). */
const CAROUSEL_TYPE = {
  coverDisplay: 74,
  coverLineGap: 80,
  coverSubdeck: 18,
  coverSubdeckLineH: 28,
  sectionDisplay: 58,
  sectionLineGap: 64,
  sectionSupporting: 18,
  sectionSupportingLineH: 27,
  sectionList: 17,
  sectionListLineH: 26,
  bulletsTitle: 56,
  bulletsTitleGap: 62,
  bulletsItem: 22,
  bulletsItemLineH: 32,
  bulletsIndex: 10,
  quoteDisplay: 62,
  quoteLineGap: 68,
  ctaDisplay: 54,
  ctaLineGap: 60,
  platformDeck: 52,
  platformDeckGap: 58,
  platformBody: 20,
  platformBodyLineH: 31,
  trioTitle: 17,
  trioSub: 16,
  trioLineGap: 20,
  pillarDisplay: 50,
  pillarLineGap: 56,
  pillarBody: 17,
  pillarBodyLineH: 27,
  pillarColLabel: 11,
  pillarColBody: 16,
  pillarColLineGap: 22,
  closerDisplay: 48,
  closerLineGap: 54,
  closerSub: 17,
  closerSubLineH: 27,
  closerStatXL: 58,
  closerStatL: 44,
  closerMicro: 11,
  headerMono: 10,
  compareMeta: 8,
  compareLabel: 8,
  compareBody: 16,
  compareBodyLineH: 24,
}

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
  cursor: 'LINE-ONLY HELP — NO REPO-WIDE CONTEXT — TOOL-CHAIN GAPS',
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

function normKey(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Same opening as another line — blocks duplicate headlines / recycled bullets across slides. */
function shareLongPrefix(a, b, n = 40) {
  const x = normKey(a).slice(0, n)
  const y = normKey(b).slice(0, n)
  return x.length >= 22 && y.length >= 22 && x === y
}

function bodyFingerprint(s) {
  return normKey(s).slice(0, 72)
}

function createHeadlineGuard() {
  const keys = new Set()
  return {
    has(s) {
      const k = normKey(s).slice(0, 56)
      if (!k) return false
      if (keys.has(k)) return true
      for (const x of keys) {
        if (k.length >= 32 && x.length >= 32 && k.slice(0, 32) === x.slice(0, 32)) return true
      }
      return false
    },
    add(s) {
      const k = normKey(s).slice(0, 56)
      if (k) keys.add(k)
    },
  }
}

function bulletStringsShownOnBulletSlides(bullets) {
  if (!bullets.length) return []
  const nSlides = Math.ceil(bullets.length / 3)
  const nShown = Math.min(bullets.length, nSlides * 3)
  return allBulletStrings(bullets.slice(0, nShown))
}

function splitDelimitedClauses(text) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  for (const d of [' — ', ' – ', ' - ']) {
    if (t.includes(d)) return t.split(d).map((s) => s.trim()).filter((s) => s.length > 22)
  }
  return [t]
}

function narrativeCandidatePool(narrative, standaloneStatements, hook, subdeck) {
  const out = []
  const ban = new Set([normKey(hook).slice(0, 48), normKey(subdeck).slice(0, 48)].filter(Boolean))
  const push = (s) => {
    const t = (s || '').replace(/\s+/g, ' ').trim()
    if (t.length < 28) return
    const head = normKey(t).slice(0, 48)
    if (ban.has(head)) return
    out.push(t)
  }
  for (const s of standaloneStatements || []) push(s)
  for (const s of narrative.newsLenses || []) push(s)
  for (const s of narrative.hookDirections || []) push(s)
  splitDelimitedClauses(narrative.competitiveFrame).forEach(push)
  for (const part of (narrative.coreThesis || '').split('. ')) push(part)
  push(narrative.audience)
  const seen = new Set()
  const deduped = []
  for (const t of out) {
    const k = bodyFingerprint(t)
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(t)
  }
  return deduped
}

/** Pick short unique blurbs; `block` = lines already shown elsewhere on the deck (e.g. bullet slides). */
function pickBlurbLines(candidates, count, block = [], avoid = []) {
  const out = []
  const guard = [...block, ...avoid]
  for (const c of candidates) {
    if (out.length >= count) break
    const line = takeawayCopy(c, 118, 158)
    if (line.split(/\s+/).length < 5) continue
    if (guard.some((g) => shareLongPrefix(line, g, 40))) continue
    if (out.some((o) => shareLongPrefix(line, o, 36))) continue
    out.push(line)
  }
  return out
}

function buildTrioAndPillarCopy({
  narrative,
  standaloneStatements,
  hook,
  subdeck,
  bullets,
  usedBulletLinesOnSlides,
  sectionsPath,
}) {
  const pool = narrativeCandidatePool(narrative, standaloneStatements, hook, subdeck)
  const bt = allBulletStrings(bullets)
  const blockFromBullets = usedBulletLinesOnSlides

  let trioSubs = []
  if (blockFromBullets.length > 0) {
    trioSubs = pickBlurbLines(pool, 3, blockFromBullets)
  } else if (sectionsPath && bt.length > 0) {
    trioSubs = pickBlurbLines(bt.slice(0, 6), 3, [hook, subdeck])
  } else if (bt.length > 0) {
    trioSubs = pickBlurbLines([...bt.slice(0, 4), ...pool], 3, [hook, subdeck])
  } else {
    trioSubs = pickBlurbLines(pool, 3, [hook, subdeck])
  }

  const avoidTrio = [...blockFromBullets, ...trioSubs]
  let colPick = []
  if (blockFromBullets.length > 0) {
    colPick = pickBlurbLines(pool, 3, avoidTrio)
  } else if (sectionsPath && bt.length > 3) {
    colPick = pickBlurbLines([...bt.slice(3), ...pool], 3, [...avoidTrio, hook, subdeck])
  } else if (bt.length > 3) {
    colPick = pickBlurbLines([...bt.slice(3, 10), ...pool], 3, avoidTrio)
  } else {
    colPick = pickBlurbLines(pool, 3, avoidTrio)
  }

  const fillers = (i) => {
    const lens = (narrative.newsLenses || [])[i % 4] || narrative.audience || narrative.label
    return `${narrative.label} — ${firstSentence(lens || narrative.coreThesis, 96)}`
  }
  while (trioSubs.length < 3) {
    const f = fillers(trioSubs.length + 1)
    const line = takeawayCopy(f, 118, 158)
    if (!trioSubs.some((t) => shareLongPrefix(t, line, 32))) trioSubs.push(line)
    else trioSubs.push(takeawayCopy(`${f} (view ${trioSubs.length + 1})`, 118, 158))
  }
  while (colPick.length < 3) {
    const f = fillers(colPick.length + 4)
    const line = takeawayCopy(f, 118, 158)
    if (!colPick.some((t) => shareLongPrefix(t, line, 32)) && !trioSubs.some((t) => shareLongPrefix(t, line, 32)))
      colPick.push(line)
    else {
      const parts = (narrative.competitiveFrame || '').split(' — ')
      const chunk = parts[colPick.length % Math.max(1, parts.length)] || f
      colPick.push(takeawayCopy(chunk, 118, 158))
    }
  }
  return { trioSubs: trioSubs.slice(0, 3), colPick: colPick.slice(0, 3) }
}

const BORING_CTA_RE = /bottom-up\s+adoption|top-down\s+mandate/i

function buildKeywordCells(narrative, shortTopic) {
  const raw = narrative.platformLegendCells
  if (Array.isArray(raw) && raw.length > 0) {
    const out = raw
      .map((s) =>
        String(s || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, '')
          .slice(0, 6)
          .trim(),
      )
      .filter(Boolean)
    const pad = ['THEMES', 'SCOPE', 'PROOF', 'NEXT', 'RISK', 'BUILD', 'SHIP', 'EDGE']
    let guard = 0
    while (out.length < 8 && guard < 24) {
      out.push(pad[out.length % pad.length])
      guard += 1
    }
    return out.slice(0, 8)
  }
  return eightGraphicCells(shortTopic, narrative.signalLabel)
}

function buildCarouselTrioSubs(narrative, fallbackArgs) {
  const T = narrative.carouselTrio
  if (T?.roadmap && T?.ship && T?.prove) {
    return [
      takeawayCopy(T.roadmap, 200, 320),
      takeawayCopy(T.ship, 200, 320),
      takeawayCopy(T.prove, 200, 320),
    ]
  }
  return buildTrioAndPillarCopy(fallbackArgs).trioSubs
}

function buildCarouselPillarCols(narrative, fallbackArgs) {
  const cols = narrative.carouselPillarCols
  if (Array.isArray(cols) && cols.length >= 3) {
    return cols.slice(0, 3).map((c) => takeawayCopy(c, 200, 320))
  }
  return buildTrioAndPillarCopy(fallbackArgs).colPick
}

function pickVariedCta(ctaFromPost, { headlineGuard, narrative, topicId, hook, postText }) {
  const boring = BORING_CTA_RE
  const cand = (ctaFromPost || '').replace(/\s+/g, ' ').trim()
  if (cand.length > 22 && !boring.test(cand) && !headlineGuard.has(cand)) return cand

  const bank = [...(narrative.carouselCtas || []), ...CAROUSEL_CTA_BANK].map((q) =>
    (q || '').replace(/\s+/g, ' ').trim(),
  ).filter(Boolean)
  if (!bank.length) return cand

  const seed = fnv1a(`${topicId}:${hook.slice(0, 56)}:${(postText || '').slice(0, 200)}`) >>> 0
  const rng = mulberry32(seed || 0xabcf3311)
  const tried = new Set()
  for (let k = 0; k < bank.length * 4; k++) {
    const q = bank[Math.floor(rng() * bank.length) % bank.length]
    if (!q || tried.has(q)) continue
    tried.add(q)
    if (headlineGuard.has(q) || boring.test(q)) continue
    return q
  }
  const escape = bank.find((q) => !boring.test(q))
  return escape || bank[0]
}

/** Decorative 8 cells — letters from topic + signal (design only; not standalone “meaning”). */
function eightGraphicCells(topicLabel, signalLabel) {
  const raw = `${topicLabel} ${signalLabel || ''}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const out = []
  for (let i = 0; i < raw.length && out.length < 8; i++) out.push(raw[i])
  while (out.length < 8) out.push('·')
  return out.slice(0, 8)
}

/** Platform hero lines — never repeat the cover hook as the platform headline. */
function platformTitlesFromPost(hook, narrative, topicLabel, headlineGuard) {
  const h = (hook || '').replace(/\s+/g, ' ').trim()
  const shortTopic = topicShortLabel(topicLabel)
  let primary = ''
  let accent = ''
  if (h.length >= 36) {
    const { primary: p, accent: a } = headlineSplitForCanvas(h)
    primary = p || h
    accent = a && a.length > 6 ? a : shortTopic
  } else if (h.length >= 12) {
    primary = h
    accent = shortTopic
  } else {
    const t = headlineSplitForCanvas(narrative.coreThesis || '')
    primary = t.primary || slideCopy(narrative.coreThesis, 72, 160)
    accent = t.accent || shortTopic || narrative.label
  }
  const dup =
    headlineGuard.has(primary) ||
    shareLongPrefix(primary, h, 36) ||
    shareLongPrefix(`${primary} ${accent}`.trim(), h, 36)
  if (dup) {
    const fb =
      narrative.hookDirections?.[0] ||
      `${narrative.label}: ${firstSentence(narrative.coreThesis, 92)}`
    const sp = headlineSplitForCanvas(takeawayCopy(fb, 72, 118))
    primary = sp.primary || takeawayCopy(fb, 52, 86)
    accent = sp.accent && sp.accent.length > 4 ? sp.accent : shortTopic
  }
  headlineGuard.add(primary)
  return { primary, accent }
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

  const headlineGuard = createHeadlineGuard()
  slides.push({ type: 'cover', text: hook, topicLabel, subdeck })
  headlineGuard.add(hook)

  let shiftCounter = 0

  if (sections.length >= 2) {
    for (let si = 0; si < sections.length; si++) {
      const items = sections[si].items.slice(0, 4)
      const cites = items.map((it) => it.cite).filter(Boolean)
      const t0 = items[0]?.text || ''
      const t1 = items[1]?.text || ''
      let heading = sections[si].heading
      if (headlineGuard.has(heading)) heading = `${sections[si].heading} · beat ${si + 1}`
      headlineGuard.add(heading)
      slides.push({
        type: 'section',
        heading,
        items,
        slideNum: si + 1,
        totalSections: sections.length,
        cites: [...new Set(cites)],
        kicker: shiftKicker(++shiftCounter),
        supporting: takeawayCopy(t0, 125, 170),
        boxMeta: topicBoxMeta(narrative),
        leftCol: t0
          ? { title: 'THE CONSTRAINT', body: takeawayCopy(t0, 125, 175) }
          : null,
        rightCol: t1
          ? { title: 'THE LEVERAGE', body: takeawayCopy(t1, 125, 175) }
          : null,
      })
    }
  } else if (bullets.length > 0) {
    const titles = rotateTitleBank(generateBulletTitles(bullets, hook), topicId, hook)
    for (let i = 0; i < bullets.length; i += 3) {
      const chunk = bullets.slice(i, i + 3)
      const cites = chunk.map((it) => it.cite).filter(Boolean)
      const slot = Math.floor(i / 3)
      let title = titles[slot] || 'Key Insights'
      let tries = 0
      while (
        tries < titles.length &&
        (headlineGuard.has(title) || shareLongPrefix(title, hook, 28))
      ) {
        tries += 1
        title = titles[(slot + tries) % titles.length]
      }
      headlineGuard.add(title)
      slides.push({
        type: 'bullets',
        title,
        items: chunk,
        slideNum: slot + 1,
        cites: [...new Set(cites)],
        kicker: shiftKicker(++shiftCounter),
      })
    }
  }

  if (standaloneStatements.length > 0) {
    const candidates = [...standaloneStatements].sort((a, b) => b.length - a.length)
    const best =
      candidates.find(
        (s) =>
          s.length > 50 &&
          !shareLongPrefix(s, hook, 42) &&
          !headlineGuard.has(takeawayCopy(s, 70, 120)),
      ) || candidates.find((s) => s.length > 50 && !shareLongPrefix(s, hook, 38))
    if (best) {
      const qtext = takeawayCopy(best, 135, 195)
      if (!headlineGuard.has(qtext)) {
        slides.push({ type: 'quote', text: qtext, kicker: shiftKicker(++shiftCounter) })
        headlineGuard.add(firstSentence(qtext, 90))
      }
    }
  }

  const hashtags = lines.filter((l) => l.trim().startsWith('#')).join(' ')
  const ctaLine = lines.find((l) => /\?$/.test(l.trim()) && !/^#/.test(l.trim()) && l.length > 20)

  const chosenCta = pickVariedCta(ctaLine, {
    headlineGuard,
    narrative,
    topicId,
    hook,
    postText: text,
  })
  if (chosenCta && chosenCta.length > 18) {
    slides.push({ type: 'cta', text: chosenCta, kicker: 'YOUR TURN' })
    headlineGuard.add(chosenCta.trim())
  }

  const bodyCount = bullets.length + sections.reduce((n, s) => n + s.items.length, 0)
  const richEnough =
    bullets.length >= 4 || bodyCount >= 6 || text.length > 700 || lines.length > 14

  const sectionsPath = sections.length >= 2
  const usedBulletLinesOnSlides =
    !sectionsPath && bullets.length > 0 ? bulletStringsShownOnBulletSlides(bullets) : []
  const trioFallbackArgs = {
    narrative,
    standaloneStatements,
    hook,
    subdeck,
    bullets,
    usedBulletLinesOnSlides,
    sectionsPath,
  }
  const trioSubs = buildCarouselTrioSubs(narrative, trioFallbackArgs)
  const colPick = buildCarouselPillarCols(narrative, trioFallbackArgs)

  if (richEnough) {
    const narrativeRaw = pickPlatformNarrative(subdeck, hook, bullets)
    const titles = platformTitlesFromPost(hook, narrative, topicLabel, headlineGuard)
    const shortTopic = topicShortLabel(topicLabel)
    slides.push({
      type: 'platform',
      titleMain: titles.primary,
      titleAccent: titles.accent,
      body: takeawayCopy(narrativeRaw, 150, 210),
      trio: [
        { title: 'Roadmap', sub: trioSubs[0] },
        { title: 'Ship', sub: trioSubs[1] },
        { title: 'Prove', sub: trioSubs[2] },
      ],
      platformGraphic: {
        keywordCells: buildKeywordCells(narrative, shortTopic),
        meshLabel: slideCopy(narrative.signalLabel, 40, 56).toUpperCase(),
        bridgeCaption:
          'Themes from your week as nodes—illustrative sequence, not live market data.',
        footMono: '',
      },
    })
  }

  const topicShort = topicShortLabel(topicLabel).slice(0, 44)
  const pillarHeadline = `Welcome to ${topicShort}.`
  headlineGuard.add(pillarHeadline)
  slides.push({
    type: 'pillar',
    strike: STRIKE_BY_TOPIC[topicId] || 'HYPE — PILOTS — SLIDEWARE',
    headline: pillarHeadline,
    body: takeawayCopy(pillarBodyFallback(subdeck, standaloneStatements, narrative), 158, 210),
    cols: [
      { label: 'EXTERNAL', text: colPick[0] },
      { label: 'ENTITY-LEVEL', text: colPick[1] },
      { label: 'AI-NATIVE', text: colPick[2] },
    ],
  })

  const allCites = findCitations(text)
  const statN = Math.min(5, Math.max(3, Math.ceil(bullets.length / 2) || 3))
  let closerPrimary = takeawayCopy(
    `${narrative.label}: ${firstSentence(narrative.coreThesis, 100)}`.replace(/\s+/g, ' ').trim(),
    86,
    118,
  )
  if (headlineGuard.has(closerPrimary) || shareLongPrefix(closerPrimary, hook, 34)) {
    closerPrimary = takeawayCopy(firstSentence(narrative.coreThesis, 110), 86, 118)
  }
  headlineGuard.add(closerPrimary)
  const closerSub = takeawayCopy(narrative.competitiveFrame, 130, 175)
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

function headlineSplitForCanvas(raw) {
  const t = balanceParentheses((raw || '').replace(/\s+/g, ' ').trim())
  if (!t) return { primary: '', accent: '' }
  if (t.length > 76) return splitHeadlineForQuote(t)
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
  ctx.font = `500 9px ${FONT_MONO}`
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
  ctx.font = `500 ${CAROUSEL_TYPE.headerMono}px ${FONT_MONO}`
  ctx.letterSpacing = '2.6px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText((kickerLeft || 'INSIGHT · CAROUSEL').toUpperCase().slice(0, 56), SIDE, 50)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = monoRight ? `500 ${CAROUSEL_TYPE.headerMono}px ${FONT_MONO}` : `500 ${CAROUSEL_TYPE.headerMono}px ${FONT_SANS}`
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

function drawSplitHeadline(ctx, fullText, maxW, startY, fontPx = 74, lineGap = 80) {
  const { primary, accent } = headlineSplitForCanvas(fullText)
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
    ctx.font = `500 ${CAROUSEL_TYPE.compareMeta}px ${FONT_MONO}`
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

  ctx.font = `500 ${CAROUSEL_TYPE.compareLabel}px ${FONT_MONO}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = ACCENT_SOFT
  ctx.fillText((leftCol.title || 'LEFT').toUpperCase(), lx, y)
  ctx.fillText((rightCol.title || 'RIGHT').toUpperCase(), rx, y)
  ctx.letterSpacing = '0px'

  const labelBottom = y + 22
  ctx.font = `400 ${CAROUSEL_TYPE.compareBody}px ${FONT_SANS}`
  ctx.fillStyle = PAPER
  let ly = labelBottom
  for (const line of wrapText(ctx, leftCol.body, colW)) {
    ctx.fillText(line, lx, ly)
    ly += CAROUSEL_TYPE.compareBodyLineH
  }
  let ry = labelBottom
  for (const line of wrapText(ctx, rightCol.body, colW)) {
    ctx.fillText(line, rx, ry)
    ry += CAROUSEL_TYPE.compareBodyLineH
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
  const labelH = 22
  const lineGap = CAROUSEL_TYPE.pillarColLineGap
  const maxH = Math.max(100, bottomLimit - topY - 8)
  const maxLines = Math.max(4, Math.min(16, Math.floor((maxH - labelH - 10) / lineGap)))

  ctx.font = `400 ${CAROUSEL_TYPE.pillarColBody}px ${FONT_SANS}`
  const lineSets = cols.map((col) => wrapText(ctx, col.text || '', cw - 8))
  const usedLines = Math.min(maxLines, Math.max(...lineSets.map((ls) => ls.length), 1))
  const rowH = labelH + usedLines * lineGap + 10

  hairlineV(ctx, x2 - 8, topY, topY + rowH)
  hairlineV(ctx, x3 - 8, topY, topY + rowH)

  let i = 0
  for (const col of cols) {
    const bx = i === 0 ? x1 : i === 1 ? x2 : x3
    ctx.font = `500 ${CAROUSEL_TYPE.pillarColLabel}px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText((col.label || '').toUpperCase(), bx, topY + 4)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = PAPER
    ctx.font = `400 ${CAROUSEL_TYPE.pillarColBody}px ${FONT_SANS}`
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
    ? slideCopy(meta.bridgeCaption, 80, 220)
    : 'From your post to one clear story.'
  const footMono = typeof meta?.footMono === 'string' ? meta.footMono : ''
  ctx.strokeStyle = BOX_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, x0, boxTop, w, boxH, 2)
  ctx.stroke()

  const bandY = boxTop + 14
  const n = 8
  const gap = 6
  const cellW = (w - 24 - (n - 1) * gap) / n
  const maxSymLen = Math.max(...keywordCells.map((c) => String(c || '').length), 1)
  const cellFontPx = maxSymLen > 4 ? 11 : maxSymLen > 2 ? 12 : 14
  for (let i = 0; i < n; i++) {
    const cx = x0 + 12 + i * (cellW + gap)
    ctx.fillStyle = i % 2 === 0 ? '#111814' : '#0e1210'
    roundRect(ctx, cx, bandY, cellW, 40, 4)
    ctx.fill()
    ctx.strokeStyle = RULE
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = ACCENT
    ctx.font = `600 ${cellFontPx}px ${FONT_MONO}`
    ctx.textAlign = 'center'
    ctx.fillText(keywordCells[i] || '·', cx + cellW / 2, bandY + 26)
    ctx.textAlign = 'left'
  }

  ctx.font = `500 10px ${FONT_MONO}`
  ctx.letterSpacing = '2px'
  ctx.fillStyle = MUTED
  ctx.textAlign = 'center'
  ctx.fillText(meshLabel, x0 + w / 2, bandY + 58)
  ctx.textAlign = 'left'
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
  ctx.textAlign = 'center'
  const capLines = wrapText(ctx, bridgeCaption, w - 48).slice(0, 3)
  let capY = graphTop - 6 - (capLines.length - 1) * 14
  for (const ln of capLines) {
    ctx.fillText(ln, x0 + w / 2, capY)
    capY += 14
  }
  ctx.textAlign = 'left'

  const trioY = boxTop + boxH - 52
  hairlineH(ctx, x0 + 12, x0 + w - 12, trioY - 10)
  if (footMono.trim()) {
    ctx.font = `500 8px ${FONT_MONO}`
    ctx.letterSpacing = '1.8px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText(footMono, x0 + 16, trioY - 2)
    ctx.letterSpacing = '0px'
  }
}

function renderSlide(ctx, slide, index, total) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

  const maxW = SLIDE_W - PAD * 2

  switch (slide.type) {
    case 'cover': {
      const topic = (slide.topicLabel || 'Your pillar').toUpperCase()
      drawEditorialHeader(ctx, `${AUTHOR.toUpperCase()} · ${topic.slice(0, 36)}`, index, total)

      const coverFont = CAROUSEL_TYPE.coverDisplay
      const coverGap = CAROUSEL_TYPE.coverLineGap
      const { primary, accent } = headlineSplitForCanvas(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, coverFont)
      const headlineStart = verticalHeroBaseline(nLines, coverGap, coverFont)
      let y = drawSplitHeadline(ctx, slide.text, maxW, headlineStart, coverFont, coverGap)

      if (slide.subdeck) {
        y += 52
        const subFont = CAROUSEL_TYPE.coverSubdeck
        const subLineH = CAROUSEL_TYPE.coverSubdeckLineH
        const barW = 4
        const textX = PAD + 18
        ctx.font = `400 ${subFont}px ${FONT_SANS}`
        const subLines = wrapText(ctx, takeawayCopy(slide.subdeck, 145, 195), maxW - textX + PAD - 8)
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
      const hFont = CAROUSEL_TYPE.sectionDisplay
      const hGap = CAROUSEL_TYPE.sectionLineGap
      let y = drawSplitHeadline(ctx, slide.heading, maxW, CONTENT_TOP + 8, hFont, hGap)
      y += 28
      if (slide.supporting) {
        ctx.font = `400 ${CAROUSEL_TYPE.sectionSupporting}px ${FONT_SANS}`
        ctx.fillStyle = PAPER
        for (const ln of wrapText(ctx, slide.supporting, maxW)) {
          ctx.fillText(ln, PAD, y)
          y += CAROUSEL_TYPE.sectionSupportingLineH
        }
        y += 16
      }
      if (slide.leftCol && slide.rightCol) {
        drawCompareBox(ctx, y, maxW, slide.boxMeta, slide.leftCol, slide.rightCol)
        y += 220
      } else {
        hairlineH(ctx, PAD, SLIDE_W - PAD, y)
        y += 20
        ctx.font = `400 ${CAROUSEL_TYPE.sectionList}px ${FONT_SANS}`
        for (let idx = 0; idx < slide.items.length; idx++) {
          const item = slide.items[idx]
          const itemText = typeof item === 'string' ? item : item.text
          const itemCite = typeof item === 'string' ? null : item.cite
          for (const il of wrapText(ctx, takeawayCopy(itemText, 135, 190), maxW - 8)) {
            ctx.fillText(il, PAD, y)
            y += CAROUSEL_TYPE.sectionListLineH
          }
          if (itemCite) {
            ctx.fillStyle = ACCENT_SOFT
            ctx.font = `italic 12px ${FONT_SANS}`
            ctx.fillText(`↳ ${itemCite}`, PAD, y + 4)
            ctx.fillStyle = PAPER
            ctx.font = `400 ${CAROUSEL_TYPE.sectionList}px ${FONT_SANS}`
            y += 22
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
      let y = drawSplitHeadline(
        ctx,
        slide.title,
        maxW,
        CONTENT_TOP + 6,
        CAROUSEL_TYPE.bulletsTitle,
        CAROUSEL_TYPE.bulletsTitleGap,
      )
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
        ctx.font = `600 ${CAROUSEL_TYPE.bulletsIndex}px ${FONT_MONO}`
        ctx.letterSpacing = '1.5px'
        ctx.fillText(String(idx + 1).padStart(2, '0'), PAD + boxPad, iy)
        ctx.letterSpacing = '0px'
        ctx.fillStyle = PAPER
        ctx.font = `400 ${CAROUSEL_TYPE.bulletsItem}px ${FONT_SANS}`
        const short = takeawayCopy(itemText, 175, 260)
        for (const il of wrapText(ctx, short, innerW - 36)) {
          ctx.fillText(il, PAD + boxPad + 36, iy)
          iy += CAROUSEL_TYPE.bulletsItemLineH
        }
        if (itemCite) {
          ctx.fillStyle = ACCENT_SOFT
          ctx.font = `italic 12px ${FONT_SANS}`
          ctx.fillText(`↳ ${itemCite}`, PAD + boxPad + 36, iy + 2)
          iy += 20
          ctx.fillStyle = PAPER
          ctx.font = `400 ${CAROUSEL_TYPE.bulletsItem}px ${FONT_SANS}`
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
      const qFont = CAROUSEL_TYPE.quoteDisplay
      const qGap = CAROUSEL_TYPE.quoteLineGap
      const { primary, accent } = splitHeadlineForQuote(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, qFont)
      const startY = verticalHeroBaseline(nLines, qGap, qFont)
      drawSplitHeadlineParts(ctx, primary, accent, maxW, startY, qFont, qGap)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'cta': {
      drawEditorialHeader(ctx, slide.kicker || 'YOUR TURN', index, total)
      const cFont = CAROUSEL_TYPE.ctaDisplay
      const cGap = CAROUSEL_TYPE.ctaLineGap
      const { primary, accent } = headlineSplitForCanvas(slide.text)
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
      ctx.font = `700 ${CAROUSEL_TYPE.platformDeck}px ${FONT_SANS}`
      let y = CONTENT_TOP + 4
      const m = slide.titleMain || ''
      const a = slide.titleAccent || ''
      for (const line of wrapText(ctx, m, maxW)) {
        ctx.fillText(line, PAD, y)
        y += CAROUSEL_TYPE.platformDeckGap
      }
      ctx.fillStyle = ACCENT
      ctx.font = `700 ${CAROUSEL_TYPE.platformDeck}px ${FONT_SANS}`
      for (const line of wrapText(ctx, a, maxW)) {
        ctx.fillText(line, PAD, y)
        y += CAROUSEL_TYPE.platformDeckGap
      }
      ctx.fillStyle = PAPER
      ctx.font = `400 ${CAROUSEL_TYPE.platformBody}px ${FONT_SANS}`
      y += 8
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += CAROUSEL_TYPE.platformBodyLineH
      }
      y += 10
      drawPlatformInfographic(ctx, y, maxW, slide.platformGraphic || null)
      const trioTop = y + 300 + 14
      if (slide.trio && slide.trio.length === 3) {
        const tw = (maxW - 32) / 3
        const xb = PAD
        const trioLineGap = CAROUSEL_TYPE.trioLineGap
        const trioBottomCap = FOOTER_TOP - 18
        const maxTrioLines = Math.max(
          3,
          Math.min(14, Math.floor((trioBottomCap - trioTop - 52) / trioLineGap)),
        )
        let maxColLines = 0
        const trioWrapped = slide.trio.map((t) => {
          ctx.font = `400 ${CAROUSEL_TYPE.trioSub}px ${FONT_SANS}`
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
          ctx.font = `700 ${CAROUSEL_TYPE.trioTitle}px ${FONT_SANS}`
          ctx.fillText(t.title, tx, trioTop + 22)
          ctx.font = `400 ${CAROUSEL_TYPE.trioSub}px ${FONT_SANS}`
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
      y += 52
      y = drawSplitHeadline(
        ctx,
        slide.headline || 'Welcome to Digital Trust.',
        maxW,
        y,
        CAROUSEL_TYPE.pillarDisplay,
        CAROUSEL_TYPE.pillarLineGap,
      )
      y += 22
      ctx.font = `400 ${CAROUSEL_TYPE.pillarBody}px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.body || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += CAROUSEL_TYPE.pillarBodyLineH
      }
      y += 22
      drawThreeColGrid(ctx, y, maxW, slide.cols || [], FOOTER_TOP - 14)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'closer': {
      drawEditorialHeader(ctx, (slide.topicLabel || 'PREM IYER').toUpperCase().slice(0, 32), index, total)
      let y = CONTENT_TOP + 4
      y = drawSplitHeadline(
        ctx,
        slide.text || '',
        maxW,
        y,
        CAROUSEL_TYPE.closerDisplay,
        CAROUSEL_TYPE.closerLineGap,
      )
      y += 20
      ctx.font = `400 ${CAROUSEL_TYPE.closerSub}px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.sub || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += CAROUSEL_TYPE.closerSubLineH
      }
      y += 18
      hairlineH(ctx, PAD, SLIDE_W - PAD, y)
      y += 28

      const colW = (maxW - 32) / 3
      const x1 = PAD
      const x2 = PAD + colW + 16
      const x3 = PAD + (colW + 16) * 2
      hairlineV(ctx, x2 - 8, y, y + 118)
      hairlineV(ctx, x3 - 8, y, y + 118)

      ctx.fillStyle = PAPER
      ctx.font = `700 ${CAROUSEL_TYPE.closerStatXL}px ${FONT_SANS}`
      ctx.fillText(String(slide.statN ?? 5), x1, y + 44)
      ctx.font = `700 ${CAROUSEL_TYPE.closerStatXL}px ${FONT_SANS}`
      ctx.textAlign = 'center'
      ctx.fillText('∞', x2 + colW / 2 - 8, y + 44)
      ctx.textAlign = 'left'
      ctx.font = `700 ${CAROUSEL_TYPE.closerStatL}px ${FONT_SANS}`
      ctx.fillText('Machine', x3, y + 40)

      const microPx = CAROUSEL_TYPE.closerMicro
      const microLine = microPx + 5
      ctx.font = `500 ${microPx}px ${FONT_MONO}`
      ctx.letterSpacing = '1.2px'
      const drawMicroCol = (x, labelText, bodyText) => {
        const upper = wrapText(ctx, labelText, colW - 8).slice(0, 2)
        const lower = wrapText(ctx, bodyText, colW - 8).slice(0, 3)
        let yy = y + 56
        ctx.fillStyle = ACCENT_SOFT
        for (const ln of upper) {
          ctx.fillText(ln, x, yy)
          yy += microLine
        }
        yy += 2
        ctx.fillStyle = ACCENT
        for (const ln of lower) {
          ctx.fillText(ln, x, yy)
          yy += microLine
        }
      }
      drawMicroCol(x1, (slide.statWord || 'modes').toUpperCase(), slide.statMicro || 'PLAN · SHIP · PROVE')
      drawMicroCol(x2, 'SURFACES MONITORED', 'THREAD + PDF')
      drawMicroCol(x3, 'RESPONSE LOOP', 'HOURS, NOT WEEKS')
      ctx.letterSpacing = '0px'

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

  const ctaLine = lines.find((l) => /\?$/.test(l.trim()) && !/^#/.test(l.trim()) && l.length > 20)
  const narrativeCap = getTopicNarrative(topicId)
  const captionGuard = createHeadlineGuard()
  const ctaForCaption = pickVariedCta(ctaLine, {
    headlineGuard: captionGuard,
    narrative: narrativeCap,
    topicId,
    hook,
    postText,
  })
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

  if (ctaForCaption) {
    caption += `${ctaForCaption.trim()}\n\n`
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
