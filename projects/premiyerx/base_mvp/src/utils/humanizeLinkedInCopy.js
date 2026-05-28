import { scrubStaleYearClaims } from './dateFreshness.js'
import { POST_LENGTH } from '../data/contentStrategy.js'
import {
  countNumberedListItems,
  getMaxPromisedCount,
  repairPromisedLists,
  shortenLineWords,
} from './postListIntegrity.js'
import { repairSentenceIntegrityInPost } from './postSentenceIntegrity.js'

/**
 * Strip common LLM "tells" from LinkedIn drafts so copy reads like a human operator wrote it.
 * Applied after every model parse — not optional polish.
 */

const INLINE_ARROW = /(\S)\s*[→►▸➜➤↳»]\s*(\S)/g
const LINE_ARROW = /^(\s*)(?:→|►|▸|➜|➤|↳|»)\s+(.*)$/
const LINE_BULLET = /^(\s*)[•●◦▪]\s+(.*)$/

/**
 * Phrases removed outright (deletion, not replacement). Anything users explicitly banned
 * lives here: see the founder voice rules in voiceProfile.js for the source list.
 */
const PHRASE_STRIPS = [
  /\bIn today's fast[- ]paced\b/gi,
  /\bIn this day and age\b/gi,
  /\bLet's dive (?:in|into)?\b/gi,
  /\bgame[- ]?changer\b/gi,
  /\bthoughts\?\s*$/gim,
  /\bagree\?\s*$/gim,
  /\bComment (?:below|YES)\b/gi,
  /\bAt the end of the day,?\s*/gi,
  /\bIt'?s worth noting that\s*/gi,
  /\bIt goes without saying\b/gi,
  /\bIn conclusion,?\s*/gi,
  /\bTo summarize,?\s*/gi,
  /\bSimply put,?\s*/gi,
  /\bThe bottom line is\b/gi,
  /\bThe bottom line:?\s*/gim,
  /\bKey takeaway:?\s*/gim,
  /\bHere's the thing:?\s*/gim,
  /\bHere is the thing:?\s*/gim,
  /\bUnpacking this:?\s*/gim,
  /\bLet me be clear:?\s*/gim,
  /\bI'?m excited to share\b/gi,
  /\bI'?m thrilled to\b/gi,
  /\bHarness the power of\b/gi,
  /\bUnlock the power of\b/gi,
  /\bIn the ever[- ]evolving\b/gi,
  /\bever[- ]evolving\b/gi,
  /\bIn an era of\b/gi,
  /\bnavigate the (?:complex|challenging)\b/gi,
  /\bsynerg(?:y|ies)\b/gi,
  /\bholistic\b/gi,
  /\bFurthermore,?\s*/gim,
  /\bMoreover,?\s*/gim,
  /\bAdditionally,?\s*/gim,
  /\bI wanted to share\b/gi,
  /\bI am (?:pleased|excited) to\b/gi,
  /\bAs (?:we all know|a reminder)\b/gi,
  /\bIn summary,?\s*/gim,
  /\bThis is a (?:reminder|testament)\b/gi,
  /\bNow more than ever\b/gi,
  /\bThe reality is\b/gi,
  /\bWhat this means is\b/gi,
  /\bLet that sink in\b/gi,
  /\bRead that again\b/gi,
  /\bSwipe (?:left|through)\b/gi,
  /\bBuckle up[,.!]?\s*/gi,
  /\b\d{1,2}:\d{2}\s*AM\s+field memo\b/gi,
  /\bfield memo for (?:CIOs?|CFOs?|VPs?)\b/gi,
  /\bWhat changed:\s*/gim,
  /\bMy read:\s*/gim,
  /\bThe market turning adult\.?\s*/gi,
  /\bCapital is not chasing\b/gi,
  /\bThe TAM is not\b/gi,
  /\bgovernance theater\b/gi,
  /\bunit economics do not work\b/gi,
  /\b\(not because [^)]{8,120}\)\s*/gi,
]

/**
 * In-place word replacements — the term still earns its keep, but in plain English.
 * Uses concrete, conversational substitutes (no "leverage", no "unlock").
 */
const PHRASE_WORD_SWAP = [
  [/\bleverage(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'use')],
  [/\butilize(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'use')],
  [/\bdelve into\b/gi, 'look at'],
  [/\bdive into\b/gi, 'look at'],
  [/\brobust\b/gi, 'solid'],
  [/\bunlock(?:s|ed|ing)?\b/gi, (m) => preserveSuffix(m, 'open')],
  [/\bcrucial\b/gi, 'core'],
  [/\bvital\b/gi, 'core'],
  [/\bever[- ]evolving\b/gi, 'shifting'],
  [/\b(?:the\s+)?landscape\b/gi, 'market'],
  // "the AI arc" / "this arc" — kill the word "arc" used as a buzzword.
  [/\b(?:the|this|that|every)\s+arc\b/gi, 'the shift'],
  [/\b\barc\b(?=\s+(?:of|toward|to))/gi, 'shift'],
]

/** Keep "uses/used/using" instead of dropping plain "use" when source word was conjugated. */
function preserveSuffix(match, base) {
  const lower = String(match).toLowerCase()
  const cap = /^[A-Z]/.test(match)
  let out = base
  if (lower.endsWith('ing')) out = `${base.replace(/e$/, '')}ing`
  else if (lower.endsWith('ed')) out = `${base}d`
  else if (lower.endsWith('s')) out = `${base}s`
  return cap ? out.charAt(0).toUpperCase() + out.slice(1) : out
}

const NUMBERED_LINE_RE = /^\d+\.\s/

function humanizeListLines(text) {
  const lines = text.split('\n')
  const out = []
  for (const line of lines) {
    const arrow = line.match(LINE_ARROW)
    if (arrow) {
      out.push(arrow[2].trim())
      continue
    }
    const bullet = line.match(LINE_BULLET)
    if (bullet) {
      out.push(bullet[2].trim())
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/**
 * Em-dash policy: real writers use them — but not on every line.
 * Allow up to 3 em-dashes; collapse the rest to commas so the post still feels conversational.
 */
function softenDashSpam(text) {
  let t = text
  const emCount = (t.match(/—/g) || []).length
  if (emCount > 3) {
    let kept = 0
    t = t.replace(/—/g, () => {
      kept++
      return kept <= 3 ? '—' : ', '
    })
  }
  t = t.replace(/\s+-\s+-/g, ' - ')
  return t
}

/**
 * @param {string} text
 * @returns {string}
 */
export function humanizeLinkedInText(text) {
  if (!text) return ''
  let t = String(text).replace(/\r\n/g, '\n')

  t = t.replace(INLINE_ARROW, '$1 to $2')
  t = humanizeListLines(t)
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
  t = t.replace(/__([^_]+)__/g, '$1')
  t = t.replace(/[✅❌✔️☑️🔥🚀💪👇]/g, '')
  t = t.replace(/^\s*#{1,6}\s+/gm, '')

  for (const re of PHRASE_STRIPS) {
    t = t.replace(re, '')
  }
  for (const [re, rep] of PHRASE_WORD_SWAP) {
    t = t.replace(re, rep)
  }

  t = softenDashSpam(t)
  t = scrubStaleYearClaims(t)
  t = t.replace(/[ \t]+\n/g, '\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t.replace(/  +/g, ' ')
  return t.trim()
}

/**
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function humanizePostSections(post) {
  if (!post) return post
  return {
    hook: humanizeLinkedInText(post.hook || ''),
    body: humanizeLinkedInText(post.body || ''),
    cta: humanizeLinkedInText(post.cta || ''),
    hashtags: humanizeLinkedInText(post.hashtags || ''),
    firstComment: humanizeLinkedInText(post.firstComment || ''),
  }
}

export function livePostCharCount(post) {
  if (!post) return 0
  return [post.hook, post.body, post.cta, post.hashtags].filter(Boolean).join('\n\n').trim().length
}

function splitBodyLines(body) {
  return (body || '').split('\n').map((l) => l.trim()).filter(Boolean)
}

function joinBodyLines(lines) {
  return lines.join('\n\n')
}

function compressPostToFit(post, maxChars) {
  let p = { ...post }
  let guard = 0

  while (livePostCharCount(p) > maxChars && guard++ < 48) {
    const before = livePostCharCount(p)
    const promised = getMaxPromisedCount(`${p.hook || ''}\n${p.body || ''}`)
    const numberedCount = countNumberedListItems(p.body || '')
    let bodyLines = splitBodyLines(p.body)

    if ((p.hashtags || '').length > 40) {
      const tags = (p.hashtags || '').split(/\s+/).filter(Boolean)
      if (tags.length > 4) {
        p = { ...p, hashtags: tags.slice(0, 4).join(' ') }
        continue
      }
    }

    if ((p.cta || '').split(/\s+/).length > 14) {
      const nextCta = shortenLineWords(p.cta, 4)
      if (nextCta) p = { ...p, cta: nextCta }
      continue
    }

    if ((p.hook || '').split(/\s+/).length > 14) {
      const nextHook = shortenLineWords(p.hook, 3)
      if (nextHook) p = { ...p, hook: nextHook }
      continue
    }

    const introIdx = bodyLines.map((l, i) => (!NUMBERED_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0)
    const numberedIdx = bodyLines.map((l, i) => (NUMBERED_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0)

    let shortened = false
    for (const i of [...introIdx].reverse()) {
      if (bodyLines[i].split(/\s+/).length > 12) {
        const next = shortenLineWords(bodyLines[i], 4)
        if (next) bodyLines[i] = next
        else bodyLines.splice(i, 1)
        shortened = true
        break
      }
    }
    if (shortened) {
      p = { ...p, body: joinBodyLines(bodyLines) }
      continue
    }

    for (const i of [...numberedIdx].reverse()) {
      if (bodyLines[i].split(/\s+/).length > 14) {
        const next = shortenLineWords(bodyLines[i], 5)
        if (next) bodyLines[i] = next
        else bodyLines.splice(i, 1)
        shortened = true
        break
      }
    }
    if (shortened) {
      p = { ...p, body: joinBodyLines(bodyLines) }
      continue
    }

    if (introIdx.length > 0) {
      bodyLines.splice(introIdx[introIdx.length - 1], 1)
      p = { ...p, body: joinBodyLines(bodyLines) }
      continue
    }

    if (numberedIdx.length > 0 && (!promised || numberedIdx.length > promised)) {
      bodyLines.splice(numberedIdx[numberedIdx.length - 1], 1)
      p = { ...p, body: joinBodyLines(bodyLines) }
      continue
    }

    if (numberedIdx.length > 1) {
      bodyLines.splice(numberedIdx[numberedIdx.length - 1], 1)
      p = { ...p, body: joinBodyLines(bodyLines) }
      continue
    }

    if (livePostCharCount(p) >= before) break
  }

  return p
}

/**
 * Hard trim after models — never leave "Three patterns…" with only item 1.
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function enforceConcisePost(post, maxChars = POST_LENGTH.charHardMax) {
  if (!post) return post
  let p = repairPromisedLists(post)
  if (livePostCharCount(p) <= maxChars) return p

  p = compressPostToFit(p, maxChars)
  p = repairPromisedLists(p)
  if (livePostCharCount(p) <= maxChars) return p

  let bodyLines = splitBodyLines(p.body)
  const promised = getMaxPromisedCount(`${p.hook || ''}\n${p.body || ''}`)

  while (livePostCharCount(p) > maxChars && bodyLines.length > 1) {
    const last = bodyLines[bodyLines.length - 1]
    const isNumbered = NUMBERED_LINE_RE.test(last)
    const numberedLeft = bodyLines.filter((l) => NUMBERED_LINE_RE.test(l)).length

    if (isNumbered && promised > 0 && numberedLeft <= promised) {
      const introIdx = bodyLines.findIndex((l) => !NUMBERED_LINE_RE.test(l))
      if (introIdx >= 0) {
        bodyLines.splice(introIdx, 1)
      } else if ((p.hook || '').length > 48) {
        p = { ...p, hook: shortenLineWords(p.hook, 5) }
      } else {
        break
      }
    } else {
      bodyLines.pop()
    }
    p = { ...p, body: joinBodyLines(bodyLines) }
  }

  while (livePostCharCount(p) > maxChars && bodyLines.length > 0) {
    const last = bodyLines[bodyLines.length - 1]
    if (last.length < 36 || NUMBERED_LINE_RE.test(last)) {
      bodyLines.pop()
    } else {
      const next = shortenLineWords(last, 8)
      if (next) bodyLines[bodyLines.length - 1] = next
      else bodyLines.pop()
    }
    p = { ...p, body: joinBodyLines(bodyLines) }
  }

  if (livePostCharCount(p) > maxChars && (p.hook || '').length > 72) {
    const nextHook = shortenLineWords(p.hook, 6)
    if (nextHook) p = { ...p, hook: nextHook }
  }

  return repairSentenceIntegrityInPost(repairPromisedLists(p))
}

/** Penalty points for ranking — long posts lose "best for reach". */
export function scoreLengthPenalty(text) {
  const n = (text || '').length
  if (n <= POST_LENGTH.charIdealMax) return 0
  if (n <= POST_LENGTH.charSoftMax) return 4
  if (n <= 820) return 10
  if (n <= 950) return 20
  if (n <= 1100) return 30
  return 38
}

/**
 * Banned vocabulary, single regex used by both the scrubber and the AI-tell scorer.
 * Sources: founder ban list (May 2026) plus historic LLM tells.
 */
export const BANNED_VOCAB_RE =
  /\b(?:leverage|utilize|delve|holistic|robust|synergy|game[- ]?changer|dive into|in today's fast[- ]paced|it'?s worth noting|at the end of the day|the reality is|buckle up|the bottom line|let that sink in|here's the thing|crucial|vital|landscape|ever[- ]evolving|arc)\b/gi

/**
 * Higher = more AI-shaped copy (used to nudge draft ranking, not shown as a public score).
 * Counts arrow bullets, banned vocab hits, transition tells, em-dash spam, bold spam, and
 * over-numbered lists.
 * @param {string} text
 * @returns {number} 0–48 penalty points
 */
export function scoreAiTellPenalty(text) {
  if (!text) return 0
  let penalty = 0
  penalty += (text.match(/[→►▸➜➤]/g) || []).length * 4
  penalty += (text.match(BANNED_VOCAB_RE) || []).length * 6
  penalty += (text.match(/\b(?:Furthermore|Moreover|Additionally|In conclusion|Key takeaway)\b/gi) || []).length * 4
  penalty += (text.match(/—/g) || []).length > 4 ? 8 : 0
  penalty += (text.match(/\*\*/g) || []).length >= 2 ? 6 : 0
  penalty += (text.match(/\b(?:field memo|What changed:|My read:|The market turning adult)\b/gi) || []).length * 6
  penalty += (text.match(/^\s*\d+\.\s+/gm) || []).length > 4 ? 10 : 0
  return Math.min(48, penalty)
}

export { scoreIncompleteListPenalty, repairPromisedLists } from './postListIntegrity.js'
