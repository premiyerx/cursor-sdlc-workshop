/**
 * Strip chain-of-thought / rubric meta that models (especially Gemini 3.x) leak into drafts.
 */

const LEAK_LINE_PATTERNS = [
  /^\s*\d+\s+words?\.?\s*$/i,
  /^\s*\d+\s+characters?\.?\s*(good\.?)?\s*$/i,
  /^good\s+variation\.?\s*$/i,
  /^final\s+first[_\s]?comment/i,
  /^prem\s+uses\s+/i,
  /^actually,?\s+let'?s\s+(look|check|count)/i,
  /^let\s+me\s+(count|check|look)/i,
  /^let'?s\s+(look|check)\s+at\s+the\s+(sample|hook|post)/i,
  /\bHOOK_MODE\b/i,
  /\bRECENT_HOOKS\b/i,
  /\bSTRUCTURE_FOR_THIS_POST\b/i,
  /\bGENERATION_RUN\b/i,
  /\bCURRENT_PERIOD_UTC\b/i,
  /\bCAPITAL_PILLAR_FOCUS\b/i,
  /^\s*\d+\s*\)\s*\([^)]+\)\s*$/i,
  /(?:^|\s)\d+\([a-z][a-z'-]*\)/i,
  /\bword\s+count\b/i,
  /\btoken\s+analysis\b/i,
  /\bstyle\s+note\b/i,
  /\bchain[-\s]?of[-\s]?thought\b/i,
  /\bmeta[-\s]?note\b/i,
  /\bnote\s+to\s+self\b/i,
  /\binternal\s+draft\b/i,
  /\bre-?hook\b/i,
  /\balt[-\s]?hook\b/i,
]

/** True when text looks like model self-talk, not LinkedIn copy. */
export function textHasReasoningLeakage(text) {
  const t = String(text || '')
  if (!t.trim()) return false
  let hits = 0
  for (const re of LEAK_LINE_PATTERNS) {
    if (re.test(t)) hits += 1
  }
  const lines = t.split('\n').filter((l) => l.trim())
  const badLines = lines.filter((line) => LEAK_LINE_PATTERNS.some((re) => re.test(line.trim())))
  if (badLines.length >= 2) return true
  if (hits >= 2) return true
  if (/\d+\([a-z][a-z'-]*\).*\d+\([a-z]/i.test(t)) return true
  return false
}

export function postSectionsHaveReasoningLeakage(post) {
  if (!post) return false
  const merged = [post.hook, post.body, post.cta, post.firstComment].filter(Boolean).join('\n\n')
  return textHasReasoningLeakage(merged)
}

/** Keep only the last structured HOOK/BODY block if the model echoed analysis first. */
export function extractLastStructuredPostBlock(text) {
  let t = String(text || '').replace(/\r\n/g, '\n')
  const re = /(?:^|\n)\s*HOOK:\s*\n/gi
  const matches = [...t.matchAll(re)]
  if (matches.length < 2) return t
  const last = matches[matches.length - 1]
  const start = last.index + (last[0].startsWith('\n') ? 1 : 0)
  return t.slice(start).trim()
}

/** Remove lines that are clearly drafting meta, not reader copy. */
export function lineLooksLikeReasoningLeak(line) {
  const L = String(line || '').trim()
  if (!L) return false
  return LEAK_LINE_PATTERNS.some((re) => re.test(L))
}

export function stripReasoningLeakageLines(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => {
      const L = line.trim()
      if (!L) return true
      return !lineLooksLikeReasoningLeak(L)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Normalize raw model text before HOOK/BODY parsing.
 * @param {string} raw
 * @param {{ aggressive?: boolean }} [opts]
 */
export function prepareModelTextForParsing(raw, opts = {}) {
  let t = String(raw || '').replace(/\r\n/g, '\n').trim()
  t = extractLastStructuredPostBlock(t)
  t = stripReasoningLeakageLines(t)
  if (opts.aggressive) {
    const hookIdx = t.search(/\bHOOK:\s*\n/i)
    if (hookIdx > 120) t = t.slice(hookIdx).trim()
  }
  return t
}

/** Reach penalty: leaked chain-of-thought / rubric in live post text. */
export function scoreReasoningLeakagePenalty(text) {
  if (!text?.trim()) return 0
  if (!textHasReasoningLeakage(text)) return 0
  let pts = 28
  const lines = text.split('\n').filter((l) => l.trim())
  const bad = lines.filter((line) => LEAK_LINE_PATTERNS.some((re) => re.test(line.trim())))
  pts += Math.min(20, bad.length * 6)
  if (/\d+\([a-z][a-z'-]*\)/i.test(text)) pts += 12
  return Math.min(48, pts)
}

/** Last-pass cleanup on parsed post sections. */
export function repairReasoningInPost(post) {
  if (!post) return post
  const fix = (s) => stripReasoningLeakageLines(String(s || ''))
  return {
    ...post,
    hook: fix(post.hook),
    body: fix(post.body),
    cta: fix(post.cta),
    hashtags: fix(post.hashtags),
    firstComment: fix(post.firstComment),
  }
}

export const ANTI_LEAK_OUTPUT_SUFFIX = `

OUTPUT RULES (mandatory — violation makes the draft unusable):
- Output ONLY the section labels HOOK, BODY, CTA, HASHTAGS, FIRST_COMMENT and the LinkedIn copy under each.
- NEVER include word counts, character counts, style analysis, token lists, numbered parenthetical word breakdowns, "Good variation", "let's look at the sample", voice-rubric notes, or any chain-of-thought.
- Do not discuss how you are writing the post — write the post.`
