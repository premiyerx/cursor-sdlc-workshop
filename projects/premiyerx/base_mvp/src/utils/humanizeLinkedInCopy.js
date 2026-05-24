import { scrubStaleYearClaims } from './dateFreshness.js'

import { POST_LENGTH } from '../data/contentStrategy.js'

import {

  countNumberedListItems,

  getMaxPromisedCount,

  repairPromisedLists,

  shortenLineWords,

} from './postListIntegrity.js'



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



const PHRASE_WORD_SWAP = [

  [/\bleverage\b/gi, 'use'],

  [/\butilize\b/gi, 'use'],

  [/\bdelve into\b/gi, 'look at'],

  [/\brobust\b/gi, 'solid'],

]



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

      p = { ...p, cta: shortenLineWords(p.cta, 4) }

      continue

    }



    if ((p.hook || '').split(/\s+/).length > 14) {

      p = { ...p, hook: shortenLineWords(p.hook, 3) }

      continue

    }



    const introIdx = bodyLines.map((l, i) => (!NUMBERED_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0)

    const numberedIdx = bodyLines.map((l, i) => (NUMBERED_LINE_RE.test(l) ? i : -1)).filter((i) => i >= 0)



    let shortened = false

    for (const i of [...introIdx].reverse()) {

      if (bodyLines[i].split(/\s+/).length > 12) {

        bodyLines[i] = shortenLineWords(bodyLines[i], 4)

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

        bodyLines[i] = shortenLineWords(bodyLines[i], 5)

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

      bodyLines[bodyLines.length - 1] = shortenLineWords(last, 8)

    }

    p = { ...p, body: joinBodyLines(bodyLines) }

  }



  if (livePostCharCount(p) > maxChars && (p.hook || '').length > 72) {

    p = { ...p, hook: shortenLineWords(p.hook, 6) }

  }



  return repairPromisedLists(p)

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

  penalty += (text.match(/\b(?:field memo|What changed:|My read:|The market turning adult)\b/gi) || []).length * 6

  penalty += (text.match(/^\s*\d+\.\s+/gm) || []).length > 4 ? 10 : 0

  return Math.min(40, penalty)

}



export { scoreIncompleteListPenalty, repairPromisedLists } from './postListIntegrity.js'


