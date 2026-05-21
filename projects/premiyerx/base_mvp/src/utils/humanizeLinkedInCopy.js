import { scrubStaleYearClaims } from './dateFreshness.js'

/**
 * Strip common LLM "tells" from LinkedIn drafts so copy reads like a human operator wrote it.
 * Applied after every model parse — not optional polish.
 */

const INLINE_ARROW = /(\S)\s*[→►▸➜➤↳»]\s*(\S)/g
const LINE_ARROW = /^(\s*)(?:→|►|▸|➜|➤|↳|»)\s+(.*)$/
const LINE_BULLET = /^(\s*)[•●◦▪]\s+(.*)$/

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
  /\bIn an era of\b/gi,
  /\bnavigate the (?:complex|challenging)\b/gi,
  /\bsynerg(?:y|ies)\b/gi,
  /\bholistic\b/gi,
  /\bFurthermore,?\s*/gim,
  /\bMoreover,?\s*/gim,
  /\bAdditionally,?\s*/gim,
]

const PHRASE_WORD_SWAP = [
  [/\bleverage\b/gi, 'use'],
  [/\butilize\b/gi, 'use'],
  [/\bdelve into\b/gi, 'look at'],
  [/\brobust\b/gi, 'solid'],
]

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

function softenDashSpam(text) {
  let t = text
  const emCount = (t.match(/—/g) || []).length
  if (emCount > 4) {
    let replaced = 0
    t = t.replace(/—/g, (m) => {
      replaced++
      return replaced % 2 === 0 ? ', ' : m
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

/**
 * Higher = more AI-shaped copy (used to nudge draft ranking, not shown as a public score).
 * @param {string} text
 * @returns {number} 0–40 penalty points
 */
export function scoreAiTellPenalty(text) {
  if (!text) return 0
  let penalty = 0
  penalty += (text.match(/[→►▸➜➤]/g) || []).length * 4
  penalty += (text.match(/\b(?:leverage|utilize|delve|holistic|robust|synergy|game-changer)\b/gi) || []).length * 5
  penalty += (text.match(/\b(?:Furthermore|Moreover|Additionally|In conclusion|Key takeaway)\b/gi) || []).length * 4
  penalty += (text.match(/—/g) || []).length > 6 ? 8 : 0
  penalty += (text.match(/\*\*/g) || []).length >= 2 ? 6 : 0
  return Math.min(40, penalty)
}
