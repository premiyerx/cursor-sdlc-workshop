/**
 * ICP critique pass — read each draft back as the target reader (CIO, VP Engineering, CFO,
 * CISO, VP DevOps/DevSecOps, CEO of an enterprise/Fortune 1000) and remove anything that
 * makes it sound like an AI memo instead of a peer-to-peer LinkedIn post.
 *
 * Deterministic only (no extra LLM call) so it adds zero latency. Runs after humanize so it
 * sees the post in the same shape the reader will see it.
 *
 * Hard rules (per founder request):
 *  - No em-dashes (—) or en-dashes (–) anywhere in copy.
 *  - No emojis in hook/body/CTA. (Hashtags untouched.)
 *  - Stronger AI-phrase blocklist than the humanizer's first pass.
 *  - CTA must be a peer-to-peer question to the named ICP roles, not a sermon.
 */

const EM_DASH = /—/g
const EN_DASH = /–/g

/** Broad emoji + dingbat range. Hashtags get a pass; we strip from hook/body/CTA only. */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u2600-\u27BF\u2700-\u27BF\u24C2-\u24FF\u2B05-\u2B07\u2934\u2935\u2139\u2199\u21A9\u21AA\uFE0F]/gu

/** Phrases the founder explicitly does not want, even when soft. Deleted outright. */
const ICP_PHRASE_STRIPS = [
  /\bIn the world of\b/gi,
  /\bAt the heart of\b/gi,
  /\bIt'?s no secret that\b/gi,
  /\bIt is no secret that\b/gi,
  /\bWhen it comes to\b/gi,
  /\bAs we (?:all )?know\b/gi,
  /\bWithout a doubt\b/gi,
  /\bMake no mistake\b/gi,
  /\bThe truth is\b/gi,
  /\bLong story short[,:]?\s*/gi,
  /\bIn essence,?\s*/gi,
  /\bUltimately,?\s*/gi,
  /\bThat said,?\s*/gi,
  /\bAll things considered,?\s*/gi,
  /\bNeedless to say,?\s*/gi,
  /\bSuffice (?:it )?to say,?\s*/gi,
  /\bI'?ll be honest[,:]?\s*/gi,
  /\bTo be honest[,:]?\s*/gi,
  /\bLet me tell you[,:]?\s*/gi,
  /\bHere'?s a (?:hot )?take[,:]?\s*/gi,
  /\bPlot twist[,:]?\s*/gi,
  /\bSpoiler[,:]?\s*/gi,
  /\bSpoiler alert[,:]?\s*/gi,
  /\bMind\s*=\s*blown\b/gi,
  /\bBoom\.?\s*/gi,
  /\bYep\.?\s*/gi,
  /\bThis is huge\.?\s*/gi,
  /\bA must[- ]read\b/gi,
  /\bWelcome to (?:the future|the new normal)\b/gi,
  /\bThe future is here\b/gi,
  /\bThe writing is on the wall\b/gi,
  /\bMoving the needle\b/gi,
  /\bMove the needle\b/gi,
  /\bDouble[- ]click on\b/gi,
  /\bDouble click on\b/gi,
  /\bcircle back\b/gi,
  /\bdeep[- ]dive into\b/gi,
  /\btable stakes\b/gi,
  /\blow[- ]hanging fruit\b/gi,
  /\bnorth star\b/gi,
  /\bbest[- ]in[- ]class\b/gi,
  /\bworld[- ]class\b/gi,
  /\bcutting[- ]edge\b/gi,
  /\bnext[- ]gen(?:eration)?\b/gi,
  /\bmission[- ]critical\b/gi,
  /\bparadigm shift\b/gi,
  /\bnew era of\b/gi,
  /\bturning point\b/gi,
]

/** Soft swaps — keeps the meaning, dumps the corporate tone. */
const ICP_WORD_SWAPS = [
  [/\bnavigate\b/gi, 'handle'],
  [/\bempower(?:s|ed|ing)?\b/gi, (m) => preserveSuffix(m, 'help')],
  [/\baccelerate(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'speed up')],
  [/\bstreamline(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'simplify')],
  [/\boptimize(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'tune')],
  [/\bfacilitate(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'enable')],
  [/\benhance(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'improve')],
  [/\binnovative\b/gi, 'new'],
  [/\bgroundbreaking\b/gi, 'new'],
  [/\brevolutionary\b/gi, 'new'],
  [/\bseamless(?:ly)?\b/gi, 'clean'],
  [/\bfrictionless\b/gi, 'clean'],
  [/\bunparalleled\b/gi, 'rare'],
  [/\bunprecedented\b/gi, 'rare'],
  [/\bpivotal\b/gi, 'key'],
  [/\bquintessential\b/gi, 'classic'],
  [/\bplethora of\b/gi, 'many'],
  [/\bmyriad (?:of\s+)?\b/gi, 'many '],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
]

function preserveSuffix(match, base) {
  const lower = String(match).toLowerCase()
  const cap = /^[A-Z]/.test(match)
  let out = base
  if (lower.endsWith('ing')) out = `${base.replace(/e$/, '')}ing`
  else if (lower.endsWith('ed')) out = `${base}d`
  else if (lower.endsWith('s')) out = `${base}s`
  return cap ? out.charAt(0).toUpperCase() + out.slice(1) : out
}

/**
 * Replace em/en-dashes with the most context-appropriate punctuation:
 *  - " — word"   → ", word"   (parenthetical-style aside)
 *  - "word — word" → "word, word"
 *  - "word—word" (no spaces, mid-word) → "word, word"
 *  - bare line-start em-dash → ""  (drop)
 */
export function stripDashesFromCopy(text) {
  if (!text) return ''
  let t = String(text)
  t = t.replace(/^\s*[—–]\s*/gm, '')
  t = t.replace(/\s*[—–]\s*$/gm, '.')
  t = t.replace(/(\S)\s*[—–]\s*(\S)/g, '$1, $2')
  t = t.replace(EM_DASH, ', ')
  t = t.replace(EN_DASH, ', ')
  t = t.replace(/,\s*,/g, ',')
  t = t.replace(/\s+,/g, ',')
  // Collapse ".)." → ".)" and ")." duplicates that show up after parenthetical injections.
  t = t.replace(/\)\.\s*\./g, ').')
  t = t.replace(/\.\)\s*\./g, '.)')
  return t
}

function dropEmojis(text) {
  if (!text) return ''
  return String(text).replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+\n/g, '\n')
}

function applyIcpSwaps(text) {
  if (!text) return ''
  let t = String(text)
  for (const re of ICP_PHRASE_STRIPS) t = t.replace(re, '')
  for (const [re, rep] of ICP_WORD_SWAPS) t = t.replace(re, rep)
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\s+\n/g, '\n').trim()
}

/**
 * If a sentence reads like an open declaration ("…stack the right tools.") in the CTA,
 * convert it to a peer-to-peer ICP question. Conservative — only triggers when there is
 * no '?' in the cta.
 */
function ensureIcpCtaQuestion(cta) {
  const raw = String(cta || '').trim()
  if (!raw) return 'What is the first thing you would change on your team this quarter?'
  if (/\?/.test(raw)) return raw
  if (/\b(you|your)\b/i.test(raw)) return `${raw.replace(/[.!]+$/, '')}?`
  return `${raw.replace(/[.!]+$/, '')} What would you try first on your team?`
}

/**
 * Critique the post the way a CIO/VP Eng/CFO/CISO would read it: terse, peer-to-peer,
 * no AI tells, no em-dashes, no emojis in body/hook/CTA.
 *
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function applyIcpCritique(post) {
  if (!post) return post
  const hook = stripDashesFromCopy(applyIcpSwaps(dropEmojis(post.hook || '')))
  const body = stripDashesFromCopy(applyIcpSwaps(dropEmojis(post.body || '')))
  const cta = ensureIcpCtaQuestion(stripDashesFromCopy(applyIcpSwaps(dropEmojis(post.cta || ''))))
  const firstComment = stripDashesFromCopy(applyIcpSwaps(dropEmojis(post.firstComment || '')))
  return { ...post, hook, body, cta, firstComment }
}

/**
 * Penalty for dashes/emojis/ICP-banned phrases — used by reach scoring so the editor
 * pipeline actively pushes against these even before they're stripped.
 */
export function scoreIcpPenalty(text) {
  if (!text) return 0
  let p = 0
  p += (text.match(EM_DASH) || []).length * 3
  p += (text.match(EN_DASH) || []).length * 3
  p += (text.match(EMOJI_RE) || []).length * 2
  for (const re of ICP_PHRASE_STRIPS) {
    p += (text.match(re) || []).length * 4
  }
  return Math.min(24, p)
}
