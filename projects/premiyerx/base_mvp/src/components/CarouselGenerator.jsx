import { useState, useRef, useMemo, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { findCitationsForLine, findCitations } from '../data/citations'
import { scorePost } from '../data/algorithmRules'
import { CAROUSEL_ALGORITHM_TIP, LINKEDIN_MOBILE_CONTEXT } from '../data/linkedinAlgorithm2026'
import { fnv1a, mulberry32 } from '../utils/generationVariety'
import { copyToClipboard } from '../utils/clipboard'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import TOPICS from '../data/postTemplates'
import { getTopicNarrative, CAROUSEL_CTA_BANK } from '../data/topicNarratives'
import { slideCopy, subdeckDuplicatesBullet, takeawayCopy, firstSentence, balanceParentheses } from '../utils/completeSentence'
import { generateCarouselPlatformGraphic } from '../utils/newsroomVisual'
import { hasOpenAiKey } from '../utils/openaiKey'
import { pickCreativeCatalogHeadline } from '../utils/creativeHeadlines'

/** LinkedIn document post (PDF carousel): 1080×1350 portrait, 50px safe margin — Oktopost 2026 spec. */
const SLIDE_W = 1080
const SLIDE_H = 1350
const SAFE_MARGIN = 50
const SIDE = SAFE_MARGIN
const PAD = SAFE_MARGIN
const CONTENT_TOP = 128
const FOOTER_TOP = SLIDE_H - 112
const CAROUSEL_MAX_SLIDES = 8
/** Vertical band for hero copy (below header, above footer). */
const HERO_REGION_TOP = 120
const HERO_REGION_BOT = FOOTER_TOP - 56

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

/** Mobile-first scale (phone feed ~390px wide; Oktopost 24pt+ body floor on 1080×1350 canvas). */
const CAROUSEL_TYPE = {
  coverEyebrow: 13,
  coverDisplay: 72,
  coverLineGap: 80,
  coverSubdeck: 28,
  coverSubdeckLineH: 38,
  sectionDisplay: 56,
  sectionLineGap: 62,
  sectionSupporting: 28,
  sectionSupportingLineH: 38,
  sectionList: 26,
  sectionListLineH: 36,
  bulletsTitle: 54,
  bulletsTitleGap: 60,
  bulletsItem: 40,
  bulletsItemLineH: 52,
  bulletsIndex: 16,
  quoteDisplay: 60,
  quoteLineGap: 66,
  ctaDisplay: 54,
  ctaLineGap: 60,
  platformDeck: 52,
  platformDeckGap: 58,
  platformBody: 32,
  platformBodyLineH: 42,
  trioTitle: 28,
  trioSub: 28,
  trioLineGap: 36,
  pillarDisplay: 54,
  pillarLineGap: 60,
  pillarBody: 30,
  pillarBodyLineH: 40,
  pillarColLabel: 20,
  pillarColBody: 28,
  pillarColLineGap: 36,
  closerDisplay: 54,
  closerLineGap: 60,
  closerSub: 28,
  closerSubLineH: 38,
  closerHashtags: 21,
  closerHashtagsLineH: 30,
  headerMono: 12,
  compareMeta: 12,
  compareLabel: 20,
  compareBody: 28,
  compareBodyLineH: 38,
  strikeLabel: 12,
}

/** ~60 words/slide max for mobile legibility (Oktopost carousel guidance). */
const SLIDE_MAX_WORDS = 58

function capSlideWords(text, maxWords = SLIDE_MAX_WORDS) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return t
  return `${words.slice(0, maxWords).join(' ')}…`
}

/** Padding inside bordered regions so type never kisses the stroke. */
const BOX_INSET = 28

const DECK_HEADER_LABEL = {
  cover: 'START HERE',
  bullets: 'KEY POINTS',
  section: 'BREAKDOWN',
  quote: 'QUOTE',
  cta: 'QUESTION',
  platform: 'IN PRACTICE',
  pillar: 'THE TAKEAWAY',
  closer: 'YOUR MOVE',
}

const PILLAR_COL_LABELS = ['What changed', 'What to do', 'What to prove']

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
  cursor: 'PILOTS — LINE-ONLY AI — NO REPO CONTEXT',
  investment: 'HYPE ROUNDS — NO OWNERS — SHELFWARE AI',
  cio: 'STRATEGY DECKS — PILOTS — CHANGE THEATER',
  roi: 'VANITY METRICS — BENCHMARKS — NO PAYBACK',
}

function getTopicLabel(topicId) {
  return TOPICS.find((t) => t.id === topicId)?.label || 'Your pillar'
}

function shiftKicker(slideNum) {
  const n = String(slideNum).padStart(2, '0')
  const lab = SHIFT_LABELS[(Math.max(1, slideNum) - 1) % SHIFT_LABELS.length]
  return `SHIFT ${n} · ${lab}`
}

function deckHeaderLeft(slide) {
  if (slide.type === 'cover') {
    const topic = slide.topicLabel || slide.topicRail || 'AI transformation'
    return `${AUTHOR.toUpperCase()} · ${topicShortLabel(topic).toUpperCase().slice(0, 28)}`
  }
  if (slide.type === 'platform') return 'THE PLATFORM'
  if (slide.type === 'pillar') return 'THE TAKEAWAY'
  if (slide.type === 'closer') return AUTHOR.toUpperCase()
  if (slide.kicker) return slide.kicker
  return DECK_HEADER_LABEL[slide.type] || 'INSIGHT'
}

const COMMENT_PROMPT_BANK = [
  'Comment with the one move your team is making this quarter.',
  'Comment with where you disagree — I read every reply.',
  'Drop your stack in the comments: tools, owners, and the metric you track.',
  'Comment with Plan / Ship / Prove — which is hardest for you right now?',
  'If you had to cut this deck to three slides, what stays?',
]

function pickCommentPrompt(closerHeadline, bullets, topicId, postText) {
  const seed = fnv1a(`${topicId}:comment:${(postText || '').slice(0, 120)}`) >>> 0
  const rng = mulberry32(seed || 0x9e3779b9)
  const pool = [...COMMENT_PROMPT_BANK]
  if (allBulletStrings(bullets).length >= 2) {
    pool.push('Comment with which beat matches how your org is operating.')
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  for (const p of pool) {
    if (!shareLongPrefix(p, closerHeadline, 38)) return p
  }
  return pool[0]
}

/** Final-slide question — same theme as post CTA but never the same wording. */
function pickCloserQuestion(chosenCta, hook, headlineGuard, narrative, topicId, postText) {
  const boring = BORING_CTA_RE
  const bank = [...(narrative.carouselCtas || []), ...CAROUSEL_CTA_BANK]
    .map((q) => (q || '').replace(/\s+/g, ' ').trim())
    .filter((q) => q.length > 18 && !boring.test(q))
  const alts = [
    'What would you fund first if you had only one sprint?',
    'Where is your team stuck today — plan, ship, or prove?',
    'What metric would you put on a board slide in 90 days?',
    'What would you stop funding to make room for this?',
  ]
  const seed = fnv1a(`${topicId}:closer:${(postText || '').slice(0, 160)}`) >>> 0
  const rng = mulberry32(seed || 0x517cc1b7)
  const candidates = [...bank, ...alts]
  for (let k = 0; k < candidates.length * 3; k++) {
    const q = candidates[Math.floor(rng() * candidates.length) % candidates.length]
    const line = firstSentence(q, 100)
    if (line.length < 18) continue
    if (chosenCta && shareLongPrefix(line, chosenCta, 32)) continue
    if (shareLongPrefix(line, hook, 36)) continue
    if (headlineGuard.has(line)) continue
    if (hookReadsLikePromptRubric(line)) continue
    return line
  }
  return 'What would you ship first in the next 90 days?'
}

const TRIO_SLOTS = [
  { title: 'Plan', lead: 'Prioritize', fallback: 'What we fund and sequence in the next 90 days.' },
  { title: 'Ship', lead: 'Deliver', fallback: 'What we put in production — owners, dates, and scope.' },
  { title: 'Prove', lead: 'Measure', fallback: 'The metric leadership uses to say it worked.' },
]

function humanizeTrioLine(raw, slot) {
  let t = (raw || '').replace(/\s+/g, ' ').trim()
  if (!t || t.length < 24 || isLabelLikeOrShallowBullet(t)) return slot.fallback
  if (/^(prioritize|deliver|measure|plan|ship|prove)\s*:/i.test(t)) return takeawayCopy(t, 100, 145)
  if (/^(we |teams |operators |start |stop |build |fund |ship |track |measure )/i.test(t)) {
    return takeawayCopy(t, 100, 145)
  }
  return takeawayCopy(`${slot.lead}: ${firstSentence(t, 110)}`, 100, 145)
}

function buildIntuitiveTrio(narrative, fallbackArgs) {
  const { bullets, hook, subdeck } = fallbackArgs
  const bt = allBulletStrings(bullets)
  const built = buildTrioAndPillarCopy(fallbackArgs)
  const lines =
    bt.length >= 3
      ? bt.slice(0, 3)
      : built.trioSubs?.length === 3
        ? built.trioSubs
        : []
  return TRIO_SLOTS.map((slot, i) => ({
    title: slot.title,
    sub: humanizeTrioLine(lines[i], slot),
  }))
}

function finalizeDeckSlides(slides) {
  if (slides.length <= CAROUSEL_MAX_SLIDES) return applyShiftKickersOnDeck(slides)
  const mustTypes = new Set(['cover', 'pillar', 'closer'])
  const must = slides.filter((s) => mustTypes.has(s.type))
  const mid = slides.filter((s) => !mustTypes.has(s.type))
  const dropOrder = ['cta', 'quote', 'platform', 'bullets', 'section']
  while (mid.length > CAROUSEL_MAX_SLIDES - must.length) {
    let dropped = false
    for (const type of dropOrder) {
      const idx = mid.findIndex((s) => s.type === type)
      if (idx >= 0) {
        mid.splice(idx, 1)
        dropped = true
        break
      }
    }
    if (!dropped) mid.pop()
  }
  const kept = new Set(mid)
  const ordered = slides.filter(
    (s) =>
      s.type === 'cover' ||
      s.type === 'pillar' ||
      s.type === 'closer' ||
      (kept.has(s) && !mustTypes.has(s.type)),
  )
  return applyShiftKickersOnDeck(ordered)
}

function applyShiftKickersOnDeck(slides) {
  let shift = 0
  return slides.map((s) => {
    if (s.type === 'cover') return s
    shift += 1
    return { ...s, kicker: shiftKicker(shift), shiftIndex: shift }
  })
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

function normalizeBulletEntry(item) {
  if (typeof item === 'string') return { text: item, cite: null }
  return { text: String(item?.text || '').replace(/\s+/g, ' ').trim(), cite: item?.cite || null }
}

/**
 * Headline-style bullets (“Unit economics ledger”, “Adoption ledger”) read as empty on a carousel.
 * We swap them for narrative-backed sentences so slides 3–4 stay substantive for non-developers.
 */
function isLabelLikeOrShallowBullet(text) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  const words = t.split(/\s+/).length
  const len = t.length
  if (len >= 120) return false
  if (/\?\s*$/.test(t) && len >= 36 && words >= 6) return false
  const labelTail =
    /\b(ledger|stack|matrix|model|layer|view|pillar|lens|frame|map|canvas|rubric)\s*\.?\s*$/i
  if (words <= 6 && len < 82 && labelTail.test(t)) return true
  if (words <= 4 && len < 68) return true
  if (words <= 8 && len < 56 && !/[.!?;:]/.test(t)) return true
  return false
}

function enrichCarouselBulletItems(bullets, narrative, standaloneStatements, hook, subdeck) {
  if (!Array.isArray(bullets) || bullets.length === 0) return bullets
  const shallow = bullets.map((b, i) => (isLabelLikeOrShallowBullet(normalizeBulletEntry(b).text) ? i : -1)).filter((i) => i >= 0)
  if (!shallow.length) return bullets

  const pool = [...carouselPublicPool(narrative, standaloneStatements, hook, subdeck, bullets)]
  const extra = Array.isArray(narrative.carouselBulletFallbacks) ? narrative.carouselBulletFallbacks : []
  for (const s of extra) {
    const t = String(s || '').replace(/\s+/g, ' ').trim()
    if (t) pool.push(t)
  }

  const guard = allBulletStrings(bullets)
  const replacements = pickBlurbLines(pool, Math.max(shallow.length * 2, 8), guard)
  let r = 0
  const coreFallback = () => {
    const fb = (narrative.carouselBulletFallbacks || [])[0]
    return takeawayCopy(
      fb || 'One concrete shift operators are making this month — not another strategy deck.',
      118,
      168,
    )
  }

  const shallowSet = new Set(shallow)
  return bullets.map((original, i) => {
    if (!shallowSet.has(i)) return original
    let line = replacements[r++]
    if (!line || isLabelLikeOrShallowBullet(line)) line = coreFallback()
    if (typeof original === 'string') return { text: line, cite: null }
    return { text: line, cite: null }
  })
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

/** Post-derived lines only — no internal news lenses / thesis fragments on public slides. */
function carouselPublicPool(narrative, standaloneStatements, hook, subdeck, bullets) {
  const out = []
  const ban = new Set([normKey(hook).slice(0, 48), normKey(subdeck).slice(0, 48)].filter(Boolean))
  const push = (s) => {
    let t = (s || '').replace(/\s+/g, ' ').trim()
    if (t.length < 28 || hookReadsLikePromptRubric(t)) return
    if (/\b(ledger|cross-portfolio|rubric|unless CONTEXT)\b/i.test(t) && t.length < 100) return
    const head = normKey(t).slice(0, 48)
    if (ban.has(head)) return
    out.push(t)
  }
  for (const s of allBulletStrings(bullets || [])) push(s)
  for (const s of standaloneStatements || []) push(s)
  if (subdeck) push(subdeck)
  for (const s of narrative.carouselBulletFallbacks || []) push(s)
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
  const pool = carouselPublicPool(narrative, standaloneStatements, hook, subdeck, bullets)
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
    const fb = (narrative.carouselBulletFallbacks || [])[i % 3]
    if (fb) return fb
    return `One concrete shift operators are making this month — not another strategy deck.`
  }
  while (trioSubs.length < 3) {
    const line = takeawayCopy(fillers(trioSubs.length), 100, 145)
    if (!trioSubs.some((t) => shareLongPrefix(t, line, 32))) trioSubs.push(line)
  }
  while (colPick.length < 3) {
    const line = takeawayCopy(fillers(colPick.length + 1), 95, 140)
    if (!colPick.some((t) => shareLongPrefix(t, line, 32)) && !trioSubs.some((t) => shareLongPrefix(t, line, 32)))
      colPick.push(line)
  }
  return { trioSubs: trioSubs.slice(0, 3), colPick: colPick.slice(0, 3) }
}

const BORING_CTA_RE = /bottom-up\s+adoption|top-down\s+mandate/i

function buildCarouselTrioSubs(narrative, fallbackArgs) {
  return buildIntuitiveTrio(narrative, fallbackArgs)
}

function buildCarouselPillarCols(narrative, fallbackArgs) {
  const cols = narrative.carouselPillarCols
  if (Array.isArray(cols) && cols.length >= 3) {
    return cols.slice(0, 3).map((c) => takeawayCopy(c, 95, 140))
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

/** True when the opening line is prompt rubric / internal guidance, not reader-facing copy. */
function hookReadsLikePromptRubric(h) {
  const t = (h || '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^lead with\b/i.test(t)) return true
  if (/^open on\b/i.test(t)) return true
  if (/^frame as\b/i.test(t)) return true
  if (/^name the second-order\b/i.test(t)) return true
  if (/^contrast what\b/i.test(t) && t.length < 130) return true
  if (/when headlines support it/i.test(t)) return true
  if (/unless CONTEXT has/i.test(t)) return true
  if (/unless the author explicitly wants/i.test(t)) return true
  if (/cross-portfolio themes/i.test(t) && /LP expectations|pilot→production|roll-ups/i.test(t)) return true
  return false
}

/** Platform hero lines — never repeat the cover hook as the platform headline; never use prompt rubric as headline. */
function platformTitlesFromPost(hook, narrative, topicLabel, headlineGuard) {
  const h = (hook || '').replace(/\s+/g, ' ').trim()
  const shortTopic = topicShortLabel(topicLabel)
  const publicHook = hookReadsLikePromptRubric(h) ? '' : h
  let primary = ''
  let accent = ''
  if (publicHook.length >= 36) {
    const { primary: p, accent: a } = headlineSplitForCanvas(publicHook)
    primary = p || publicHook
    accent = a && a.length > 6 ? a : shortTopic
  } else if (publicHook.length >= 12) {
    primary = publicHook
    accent = shortTopic
  } else {
    const t = headlineSplitForCanvas(narrative.coreThesis || '')
    primary = t.primary || slideCopy(narrative.coreThesis, 72, 160)
    accent = t.accent || shortTopic || narrative.label
  }
  const dup =
    headlineGuard.has(primary) ||
    (publicHook.length >= 12 &&
      (shareLongPrefix(primary, publicHook, 36) ||
        shareLongPrefix(`${primary} ${accent}`.trim(), publicHook, 36)))
  if (dup) {
    const lens0 = (narrative.newsLenses || []).find((s) => String(s || '').trim().length > 40)
    const fb =
      lens0 ||
      `${narrative.label}: ${firstSentence(narrative.coreThesis, 92)}`
    const sp = headlineSplitForCanvas(takeawayCopy(fb, 72, 118))
    primary = sp.primary || takeawayCopy(fb, 52, 86)
    accent = sp.accent && sp.accent.length > 4 ? sp.accent : shortTopic
  }
  headlineGuard.add(primary)
  return { primary, accent }
}

function audiencePillarHeadline(hook, chosenCta, narrative, topicShort, headlineGuard, topicId, postSnippet = '') {
  const publicHook = hookReadsLikePromptRubric(hook) ? '' : (hook || '').replace(/\s+/g, ' ').trim()
  if (chosenCta && chosenCta.length > 24 && !hookReadsLikePromptRubric(chosenCta)) {
    const q = firstSentence(chosenCta, 88).replace(/\s+/g, ' ').trim()
    if (q.length >= 20 && !headlineGuard.has(q)) {
      headlineGuard.add(q)
      return q
    }
  }
  if (publicHook.length >= 28) {
    const h = firstSentence(publicHook, 82)
    if (h.length >= 20 && !headlineGuard.has(h)) {
      headlineGuard.add(h)
      return h
    }
  }
  return pillarCatalogHeadline(narrative, topicShort, headlineGuard, topicId, postSnippet)
}

function buildPillarColumns(bullets, colPick) {
  const bt = allBulletStrings(bullets)
  return PILLAR_COL_LABELS.map((label, i) => ({
    label,
    text: takeawayCopy(bt[i] || colPick[i] || '', 88, 130),
  }))
}

function pillarCatalogHeadline(narrative, topicShort, headlineGuard, topicId, postSnippet = '') {
  const seed = fnv1a(`${topicId}:${postSnippet.slice(0, 320)}`)
  const creative = pickCreativeCatalogHeadline({
    topicId,
    refreshSeed: seed,
    headlineGuard,
    postSnippet,
  })
  if (creative && creative.length >= 20 && !/^welcome to\b/i.test(creative)) {
    return creative
  }

  const thesisLead = takeawayCopy(
    `${firstSentence(narrative.coreThesis || '', 160)}`.replace(/\s+/g, ' ').trim(),
    44,
    92,
  )
  const candidates = [
    thesisLead && thesisLead.length > 32 ? thesisLead : '',
    `Where ${topicShort} shows up in budgets, roadmaps, and renewals — not in slide decks alone.`,
  ].filter(Boolean)

  for (const raw of candidates) {
    const balanced = balanceParentheses(raw)
    const head = firstSentence(balanced, 78).replace(/\s+/g, ' ').trim()
    if (head.length < 28) continue
    if (headlineGuard.has(head)) continue
    if (/^welcome to\b/i.test(head)) continue
    headlineGuard.add(head)
    return head
  }
  const fallback = pickCreativeCatalogHeadline({
    topicId,
    refreshSeed: seed + 17,
    headlineGuard,
    postSnippet: `${postSnippet}alt`,
  })
  headlineGuard.add(fallback)
  return fallback
}

function pillarBodyFallback(subdeck, standaloneStatements, bullets, narrative) {
  const bt = allBulletStrings(bullets || [])
  if (bt.length >= 2) {
    return takeawayCopy(`${bt[0]} ${bt[1]}`, 130, 190)
  }
  if (bt[0]) return bt[0]
  const sd = (subdeck || '').replace(/\s+/g, ' ').trim()
  if (sd.length > 40 && !hookReadsLikePromptRubric(sd)) return sd
  const st = (standaloneStatements || []).find((s) => s.length > 45 && !hookReadsLikePromptRubric(s))
  if (st) return st
  const fb = (narrative.carouselBulletFallbacks || [])[0]
  if (fb) return fb
  return 'Three moves operators are making now — not another strategy deck.'
}

function topicBoxMeta(topicLabel) {
  const short = topicShortLabel(topicLabel || '').toUpperCase().replace(/\s+/g, ' ')
  return short.slice(0, 40) || 'THIS WEEK'
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

  let bullets = []
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

  bullets = enrichCarouselBulletItems(bullets, narrative, standaloneStatements, hook, subdeck)

  const firstBulletStr = bullets[0]
    ? (typeof bullets[0] === 'string' ? bullets[0] : bullets[0].text).replace(/\s+/g, ' ').trim()
    : ''
  if (subdeck && firstBulletStr && subdeckDuplicatesBullet(subdeck, firstBulletStr)) {
    subdeck = ''
  }

  const headlineGuard = createHeadlineGuard()
  const coverText = hookReadsLikePromptRubric(hook)
    ? takeawayCopy(
        `${narrative.label}: ${firstSentence(narrative.coreThesis || narrative.audience || '', 140)}`.replace(
          /\s+/g,
          ' ',
        ).trim(),
        68,
        118,
      )
    : hook
  const coverEyebrow = subdeck
    ? `A note on ${topicShortLabel(topicLabel)}`
    : `A note on ${topicShortLabel(topicLabel)}`
  slides.push({ type: 'cover', text: coverText, topicLabel, subdeck, coverEyebrow })
  headlineGuard.add(coverText)

  let shiftCounter = 0

  if (sections.length >= 2) {
    for (let si = 0; si < Math.min(sections.length, 2); si++) {
      const items = sections[si].items.slice(0, 4)
      const cites = items.map((it) => it.cite).filter(Boolean)
      const t0 = items[0]?.text || ''
      const t1 = items[1]?.text || ''
      const sectionHeadings = ['What changed', 'What teams do now', 'What to prove']
      let heading = sections[si].heading
      if (hookReadsLikePromptRubric(heading)) heading = sectionHeadings[si % sectionHeadings.length]
      if (headlineGuard.has(heading)) heading = sectionHeadings[si % sectionHeadings.length]
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
        boxMeta: topicBoxMeta(topicLabel),
        leftCol: t0
          ? { title: 'The pressure', body: takeawayCopy(t0, 125, 175) }
          : null,
        rightCol: t1
          ? { title: 'The move', body: takeawayCopy(t1, 125, 175) }
          : null,
      })
    }
  } else if (bullets.length > 0) {
    const titles = rotateTitleBank(generateBulletTitles(bullets, hook), topicId, hook)
    const maxBulletSlides = 2
    for (let i = 0; i < bullets.length && Math.floor(i / 3) < maxBulletSlides; i += 3) {
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

  if (standaloneStatements.length > 0 && slides.length < 5) {
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
  const trioBlocks = buildIntuitiveTrio(narrative, trioFallbackArgs)
  const colPick = buildCarouselPillarCols(narrative, trioFallbackArgs)

  const midBeforePlatform = slides.length - 1
  if (richEnough && midBeforePlatform <= 4) {
    const narrativeRaw = pickPlatformNarrative(subdeck, hook, bullets)
    const titles = platformTitlesFromPost(hook, narrative, topicLabel, headlineGuard)
    slides.push({
      type: 'platform',
      titleMain: titles.primary,
      titleAccent: titles.accent,
      body: takeawayCopy(narrativeRaw, 130, 185),
      trio: trioBlocks,
    })
  }

  const topicShort = topicShortLabel(topicLabel).slice(0, 44)
  const pillarHeadline = audiencePillarHeadline(
    hook,
    chosenCta,
    narrative,
    topicShort,
    headlineGuard,
    topicId,
    text,
  )
  slides.push({
    type: 'pillar',
    strike: STRIKE_BY_TOPIC[topicId] || 'PILOTS — SLIDEWARE — VANITY METRICS',
    headline: pillarHeadline,
    body: takeawayCopy(pillarBodyFallback(subdeck, standaloneStatements, bullets, narrative), 120, 175),
    cols: buildPillarColumns(bullets, colPick),
  })

  const closerHeadline = pickCloserQuestion(
    chosenCta,
    hook,
    headlineGuard,
    narrative,
    topicId,
    text,
  )
  headlineGuard.add(closerHeadline)
  const closerSub = pickCommentPrompt(closerHeadline, bullets, topicId, text)
  slides.push({
    type: 'closer',
    headline: closerHeadline,
    sub: closerSub,
    hashtags: hashtags.replace(/\s+/g, ' ').trim(),
  })

  const topicRail = topicShortLabel(topicLabel).toUpperCase().slice(0, 40)
  const withRail = slides.map((s) => ({ ...s, topicRail }))
  return finalizeDeckSlides(withRail)
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
  else titles.push('What matters now', 'What to do next', 'What to watch')
  return titles
}

function wrapText(ctx, text, maxWidth) {
  const safeMax = maxWidth - BOX_INSET
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

/** Load a data URL or remote URL into an HTMLImageElement for canvas drawImage. */
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(() => resolve(img)).catch(() => resolve(img))
      } else resolve(img)
    }
    img.onerror = () => reject(new Error('Could not load generated slide image'))
    img.src = src
  })
}

async function loadCarouselPlatformImage(slides, topicId) {
  const platform = slides.find((s) => s.type === 'platform')
  if (!platform || !hasOpenAiKey()) return null
  try {
    const res = await generateCarouselPlatformGraphic({
      topicId,
      topicLabel: getTopicLabel(topicId),
      titleMain: platform.titleMain,
      titleAccent: platform.titleAccent,
      body: platform.body,
      trio: platform.trio,
    })
    if (!res.ok) return null
    return await loadImageElement(res.url)
  } catch {
    return null
  }
}

function drawStrikeLabel(ctx, text, x, y, maxW) {
  ctx.save()
  ctx.font = `500 ${CAROUSEL_TYPE.strikeLabel}px ${FONT_MONO}`
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

/** Stacked compare (mobile-first): full-width columns, no tiny side-by-side labels. */
function drawCompareBox(ctx, topY, maxW, meta, leftCol, rightCol) {
  const x0 = PAD
  const inset = BOX_INSET
  const w = maxW
  const colW = w - inset * 2
  const lx = x0 + inset
  let innerY = topY + inset

  if (meta) {
    ctx.font = `500 ${CAROUSEL_TYPE.compareMeta}px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText(meta.toUpperCase(), lx, innerY)
    ctx.letterSpacing = '0px'
    innerY += 30
  }

  const drawCol = (col, startY) => {
    let y = startY
    ctx.font = `500 ${CAROUSEL_TYPE.compareLabel}px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText((col.title || '').toUpperCase(), lx, y)
    ctx.letterSpacing = '0px'
    y += 26
    ctx.font = `400 ${CAROUSEL_TYPE.compareBody}px ${FONT_SANS}`
    ctx.fillStyle = PAPER
    for (const line of wrapText(ctx, capSlideWords(col.body), colW)) {
      ctx.fillText(line, lx, y)
      y += CAROUSEL_TYPE.compareBodyLineH
    }
    return y + 14
  }

  innerY = drawCol(leftCol, innerY)
  hairlineH(ctx, x0 + inset, x0 + w - inset, innerY)
  innerY += 20
  innerY = drawCol(rightCol, innerY)

  const boxH = innerY - topY + inset
  ctx.strokeStyle = BOX_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, x0, topY, w, boxH, 2)
  ctx.stroke()
  return topY + boxH
}

/** Stacked three-up (mobile-first) for takeaway / Plan-Ship-Prove rails. */
function drawThreeColGrid(ctx, topY, maxW, cols, bottomLimit = FOOTER_TOP - 14) {
  if (!cols || cols.length < 1) return topY
  const x0 = PAD
  const inset = BOX_INSET
  const colW = maxW - inset * 2
  const lx = x0 + inset
  let y = topY + inset
  const lineGap = CAROUSEL_TYPE.pillarColLineGap

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    if (i > 0) {
      hairlineH(ctx, x0 + inset, x0 + maxW - inset, y)
      y += 18
    }
    ctx.font = `500 ${CAROUSEL_TYPE.pillarColLabel}px ${FONT_MONO}`
    ctx.letterSpacing = '2px'
    ctx.fillStyle = ACCENT_SOFT
    ctx.fillText((col.label || '').toUpperCase(), lx, y + 4)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = PAPER
    ctx.font = `400 ${CAROUSEL_TYPE.pillarColBody}px ${FONT_SANS}`
    let ly = y + 28
    for (const line of wrapText(ctx, capSlideWords(col.text), colW)) {
      if (ly > bottomLimit) break
      ctx.fillText(line, lx, ly)
      ly += lineGap
    }
    y = ly + 12
    if (y > bottomLimit) break
  }

  const boxH = y - topY + inset
  ctx.strokeStyle = BOX_EDGE
  ctx.lineWidth = 1
  roundRect(ctx, x0, topY, maxW, boxH, 2)
  ctx.stroke()
  return y + inset
}

function drawTrioStacked(ctx, topY, maxW, trio, bottomLimit = FOOTER_TOP - 18) {
  if (!trio?.length) return topY
  const x = PAD + BOX_INSET
  const colW = maxW - BOX_INSET * 2
  let y = topY
  for (let i = 0; i < trio.length; i++) {
    const t = trio[i]
    if (i > 0) {
      hairlineH(ctx, PAD, SLIDE_W - PAD, y)
      y += 20
    }
    ctx.fillStyle = PAPER
    ctx.font = `700 ${CAROUSEL_TYPE.trioTitle}px ${FONT_SANS}`
    ctx.fillText(t.title, x, y + 24)
    ctx.font = `400 ${CAROUSEL_TYPE.trioSub}px ${FONT_SANS}`
    ctx.fillStyle = '#e4e0d8'
    let sy = y + 52
    for (const line of wrapText(ctx, capSlideWords(t.sub, 44), colW)) {
      if (sy > bottomLimit) break
      ctx.fillText(line, x, sy)
      sy += CAROUSEL_TYPE.trioLineGap
    }
    y = sy + 14
    ctx.fillStyle = PAPER
    if (y > bottomLimit) break
  }
  return y
}

function renderSlide(ctx, slide, index, total, extra = {}) {
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)

  const maxW = SLIDE_W - PAD * 2

  switch (slide.type) {
    case 'cover': {
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)

      let heroY = CONTENT_TOP + 4
      if (slide.coverEyebrow) {
        ctx.font = `500 ${CAROUSEL_TYPE.coverEyebrow}px ${FONT_MONO}`
        ctx.letterSpacing = '2.4px'
        ctx.fillStyle = MUTED
        ctx.fillText(slide.coverEyebrow.toUpperCase().slice(0, 56), PAD, heroY)
        ctx.letterSpacing = '0px'
        heroY += 28
      }

      const coverFont = CAROUSEL_TYPE.coverDisplay
      const coverGap = CAROUSEL_TYPE.coverLineGap
      const { primary, accent } = headlineSplitForCanvas(slide.text)
      const nLines = countHeadlineLines(ctx, primary, accent, maxW, coverFont)
      const headlineStart = Math.max(heroY, verticalHeroBaseline(nLines, coverGap, coverFont) - 24)
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
      const hFont = CAROUSEL_TYPE.sectionDisplay
      const hGap = CAROUSEL_TYPE.sectionLineGap
      let y = drawSplitHeadline(ctx, slide.heading, maxW, CONTENT_TOP + 8, hFont, hGap)
      y += 28
      if (slide.supporting) {
        ctx.font = `400 ${CAROUSEL_TYPE.sectionSupporting}px ${FONT_SANS}`
        ctx.fillStyle = PAPER
        for (const ln of wrapText(ctx, capSlideWords(slide.supporting), maxW)) {
          ctx.fillText(ln, PAD, y)
          y += CAROUSEL_TYPE.sectionSupportingLineH
        }
        y += 16
      }
      if (slide.leftCol && slide.rightCol) {
        y = drawCompareBox(ctx, y, maxW, slide.boxMeta, slide.leftCol, slide.rightCol) + 16
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
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

      const boxPad = BOX_INSET
      const innerW = maxW - boxPad * 2
      const innerTop = y
      let iy = innerTop + boxPad + 12
      for (let idx = 0; idx < slide.items.length; idx++) {
        const item = slide.items[idx]
        const itemText = typeof item === 'string' ? item : item.text
        const itemCite = typeof item === 'string' ? null : item.cite
        ctx.fillStyle = ACCENT_SOFT
        ctx.font = `600 ${CAROUSEL_TYPE.bulletsIndex}px ${FONT_MONO}`
        ctx.letterSpacing = '1.5px'
        ctx.fillText(String(idx + 1).padStart(2, '0'), PAD + boxPad + 4, iy)
        ctx.letterSpacing = '0px'
        ctx.fillStyle = PAPER
        ctx.font = `400 ${CAROUSEL_TYPE.bulletsItem}px ${FONT_SANS}`
        const short = takeawayCopy(itemText, 165, 255)
        for (const il of wrapText(ctx, short, innerW - 44)) {
          ctx.fillText(il, PAD + boxPad + 44, iy)
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total, { monoRight: true })
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
      y += 12
      const minTrioReserve = slide.trio?.length === 3 ? 300 : 140
      const maxGraphicBottom = FOOTER_TOP - minTrioReserve
      let slotH = slide.trio?.length === 3 ? 200 : 248
      if (y + slotH > maxGraphicBottom) {
        slotH = Math.max(112, maxGraphicBottom - y - 8)
      }
      const img = extra?.platformImage
      const canDraw =
        img instanceof HTMLImageElement &&
        img.complete &&
        img.naturalWidth > 0 &&
        slotH >= 100
      if (canDraw) {
        const x0 = PAD
        const w = maxW
        const slotTop = y
        ctx.save()
        roundRect(ctx, x0, slotTop, w, slotH, 4)
        ctx.clip()
        const iw = img.naturalWidth
        const ih = img.naturalHeight
        const scale = Math.max(w / iw, slotH / ih)
        const dw = iw * scale
        const dh = ih * scale
        const dx = x0 + (w - dw) / 2
        const dy = slotTop + (slotH - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
        ctx.restore()
        ctx.strokeStyle = BOX_EDGE
        ctx.lineWidth = 1
        roundRect(ctx, x0, slotTop, w, slotH, 4)
        ctx.stroke()
        y = slotTop + slotH + 14
      } else {
        y += 6
      }
      if (slide.trio && slide.trio.length === 3) {
        const trioTop = y
        const tw = (maxW - 32) / 3
        const xb = PAD
        const trioLineGap = CAROUSEL_TYPE.trioLineGap
        const trioBottomCap = FOOTER_TOP - 18
        const maxTrioLines = Math.max(
          3,
          Math.min(18, Math.floor((trioBottomCap - trioTop - 52) / trioLineGap)),
        )
        let maxColLines = 0
        const trioWrapped = slide.trio.map((t) => {
          ctx.font = `400 ${CAROUSEL_TYPE.trioSub}px ${FONT_SANS}`
          const subLines = wrapText(ctx, t.sub || '', tw - 10)
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
          ctx.fillStyle = '#e4e0d8'
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
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
      let y = CONTENT_TOP + 8
      if (slide.strike) {
        drawStrikeLabel(ctx, slide.strike, PAD, y, maxW)
        y += 48
      }
      y = drawSplitHeadline(
        ctx,
        slide.headline || 'How this lands for operators and boards.',
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
      drawThreeColGrid(ctx, y + 8, maxW, slide.cols || [], FOOTER_TOP - 14)
      drawEditorialFooter(ctx, { railText: slide.topicRail })
      break
    }

    case 'closer': {
      drawEditorialHeader(ctx, deckHeaderLeft(slide), index, total)
      let y = CONTENT_TOP + 6
      y = drawSplitHeadline(
        ctx,
        slide.headline || slide.text || '',
        maxW,
        y,
        CAROUSEL_TYPE.closerDisplay,
        CAROUSEL_TYPE.closerLineGap,
      )
      y += 24
      ctx.font = `400 ${CAROUSEL_TYPE.closerSub}px ${FONT_SANS}`
      ctx.fillStyle = PAPER
      for (const ln of wrapText(ctx, slide.sub || '', maxW)) {
        ctx.fillText(ln, PAD, y)
        y += CAROUSEL_TYPE.closerSubLineH
      }
      if (slide.hashtags) {
        y += 28
        hairlineH(ctx, PAD, SLIDE_W - PAD, y)
        y += 26
        ctx.font = `500 ${CAROUSEL_TYPE.closerHashtags}px ${FONT_SANS}`
        ctx.fillStyle = ACCENT_SOFT
        for (const ln of wrapText(ctx, slide.hashtags, maxW)) {
          ctx.fillText(ln, PAD, y)
          y += CAROUSEL_TYPE.closerHashtagsLineH
        }
      }
      ctx.textAlign = 'right'
      ctx.font = `600 17px ${FONT_MONO}`
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

function generateCarouselCaption(postText, topicId = '', slideCount = 0) {
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

  const slideCountResolved =
    slideCount > 0 ? slideCount : Math.max(5, Math.round(postText.length / 200))

  const captionRng = mulberry32((fnv1a(`${topicId}:${hook.slice(0, 40)}:${Date.now()}`) >>> 0) || 0xace12345)
  const bridgeTemplates = [
    `${slideCountResolved}-slide PDF (portrait, phone-first). Swipe the deck — preview below:\n\n`,
    `Mobile-first ${slideCountResolved}-slide walkthrough. Open the PDF and swipe:\n\n`,
    `Turned this into ${slideCountResolved} slides sized for the LinkedIn phone feed:\n\n`,
    `${slideCountResolved} slides you can forward to your team (built for swipe on mobile):\n\n`,
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
    `Each slide is one claim you can reuse in a memo or a board readout.\n\n`,
    `Built to read fast: claim, proof, and what to do next.\n\n`,
    `If someone only reads the caption, they should still leave with one concrete takeaway.\n\n`,
  ]
  caption += closers[Math.floor(captionRng() * closers.length) % closers.length]

  const captionGuardQ = createHeadlineGuard()
  if (ctaForCaption) captionGuardQ.add(ctaForCaption.trim())
  const carouselQuestion = pickCloserQuestion(
    ctaForCaption,
    hook,
    captionGuardQ,
    narrativeCap,
    topicId,
    postText,
  )
  const commentLine = pickCommentPrompt(carouselQuestion, [], topicId, postText)
  caption += `${carouselQuestion}\n\n${commentLine}\n\n`

  if (captionRng() > 0.4) {
    caption += `Save the PDF if the framing helps your next leadership conversation.\n\n`
  }

  if (hashtags) {
    caption += hashtags
  }

  return reconcileSlideCountsInCaption(caption.trim(), slideCountResolved)
}

/** If the model (or an old template) guessed the wrong deck size, align copy to the real PDF slide count. */
function reconcileSlideCountsInCaption(caption, actual) {
  if (!caption || !actual || actual < 1) return caption
  return caption.replace(/\b(\d{1,2})-slide\b/gi, (match, d) => {
    const v = parseInt(d, 10)
    if (v === actual) return match
    if (v >= 4 && v <= 36) return `${actual}-slide`
    return match
  })
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
    let cancelled = false
    ;(async () => {
      const platformImg = await loadCarouselPlatformImage(slides, topicId)
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = SLIDE_W
      canvas.height = SLIDE_H
      const ctx = canvas.getContext('2d')
      const images = []
      for (let i = 0; i < slides.length; i++) {
        const extra = slides[i].type === 'platform' ? { platformImage: platformImg } : {}
        renderSlide(ctx, slides[i], i, slides.length, extra)
        images.push(canvas.toDataURL('image/png'))
      }
      setPreviewSlides(images)
      setPreviewIndex((prev) => (prev >= images.length ? 0 : prev))
      setCaptionText(generateCarouselCaption(postText, topicId, slides.length))
    })()
    return () => {
      cancelled = true
    }
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
      const platformImg = await loadCarouselPlatformImage(slides, topicId)
      const canvas = document.createElement('canvas')
      canvas.width = SLIDE_W
      canvas.height = SLIDE_H
      const ctx = canvas.getContext('2d')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [SLIDE_W, SLIDE_H] })

      for (let i = 0; i < slides.length; i++) {
        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H])
        const extra = slides[i].type === 'platform' ? { platformImage: platformImg } : {}
        renderSlide(ctx, slides[i], i, slides.length, extra)
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
        <span className="carousel-tip">{LINKEDIN_MOBILE_CONTEXT}</span>
      </div>

      {previewSlides.length > 0 && (
        <div className="carousel-preview">
          <p className="carousel-preview-explainer">
            <strong>Live preview</strong> — mobile-first 1080×1350 portrait (same as the LinkedIn PDF). Stacked columns and large labels are tuned for phone swipe, not desktop width (use ← → to swipe). Slides are parsed
            from <strong>your post</strong> and anchored to <strong>{getTopicLabel(topicId) || 'the topic you picked'}</strong>{' '}
            (headlines and stats still come from the same topic in the infographic). Decorative layout only — no
            unrelated “template” storylines.
            {hasOpenAiKey() && slides.some((s) => s.type === 'platform') && (
              <>
                {' '}
                With your OpenAI key saved, the <strong>platform</strong> slide requests one GPT-generated diagram
                (flow, comparison, or schematic) that matches the slide copy — not the old decorative chart strip.
              </>
            )}
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
