/**
 * Detect and repair truncated / dangling lines (unclosed parens, mid-phrase cuts).
 * Used after length compression and on every finalized draft.
 */
import { balanceParentheses } from './completeSentence.js'

const TERMINAL_END_RE = /[.!?…)"'\]]$/

function parenDepth(text) {
  let depth = 0
  for (const ch of String(text || '')) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth = Math.max(0, depth - 1)
  }
  return depth
}

/**
 * True when a line reads like it was cut off or never finished (not intentional hook fragments).
 * @param {string} line
 * @param {{ allowFragment?: boolean }} [options]
 */
export function isLineIncomplete(line, options = {}) {
  const t = String(line || '').trim()
  if (!t) return false

  // Hashtag-only lines (e.g. "#CISO #AIGovernance") are valid structural blocks, not prose.
  if (/^#\w/.test(t) && t.split(/\s+/).every((tok) => /^#\w/.test(tok))) return false

  const words = t.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  if (parenDepth(t) > 0) return true
  if (/\([^)]*$/.test(t)) return true

  if (wordCount <= 2) {
    return !TERMINAL_END_RE.test(t) && !/^\d+\.\s/.test(t)
  }

  if (TERMINAL_END_RE.test(t) && parenDepth(t) === 0) {
    if (/\b(was|is|were|are)\s+(?:a|an|the)\s+[\w-]+\.\s*$/i.test(t)) {
      const beforePeriod = t.replace(/[.!?…]+$/, '').trim()
      if (/\b\d+-\w+\s+\w+$/i.test(beforePeriod)) return true
    }
    return false
  }

  if (options.allowFragment && wordCount <= 5 && /^[A-Z(]/.test(t)) {
    return false
  }

  if (wordCount >= 4 && !TERMINAL_END_RE.test(t)) return true

  if (/\b(a|an|the|our|their|your|my|its|this|that)\s+[\w-]+$/i.test(t) && !TERMINAL_END_RE.test(t)) {
    return true
  }

  if (/\b(was|is|were|are|been|being)\s+(?:a|an|the)?\s*[\w-]*$/i.test(t) && !TERMINAL_END_RE.test(t)) {
    return true
  }

  if (/—\s*[^.!?)]*$/.test(t) && wordCount >= 5 && !TERMINAL_END_RE.test(t)) return true

  if (/\b(in|on|at|for|with|from|to|into|through|before|after|during|of)\s*$/i.test(t)) return true

  if (/\b\d+-\w+\s+\w+$/i.test(t) && !TERMINAL_END_RE.test(t)) return true

  return false
}

/**
 * Remove a dangling opening parenthetical or drop the line if it cannot be salvaged.
 */
export function repairIncompleteLine(line) {
  let t = String(line || '').trim()
  if (!t) return ''
  if (!isLineIncomplete(t)) return t

  const openIdx = t.lastIndexOf('(')
  if (openIdx >= 0 && parenDepth(t) > 0) {
    const before = t.slice(0, openIdx).trim()
    const afterClose = balanceParentheses(t.slice(openIdx))
    if (afterClose !== t.slice(openIdx) && !isLineIncomplete(before)) {
      t = before
    } else if (before.length >= 12 && !isLineIncomplete(before)) {
      t = before
    } else {
      return ''
    }
  }

  for (const sep of ['. ', '? ', '! ']) {
    const idx = t.lastIndexOf(sep)
    if (idx > 20) {
      const cut = t.slice(0, idx + 1).trim()
      if (!isLineIncomplete(cut)) return cut
    }
  }

  const em = t.lastIndexOf(' — ')
  if (em > 24) {
    const cut = t.slice(0, em).trim()
    if (cut.length >= 12 && !isLineIncomplete(cut)) {
      return cut.endsWith('.') ? cut : `${cut}.`
    }
  }

  const comma = t.lastIndexOf(', ')
  if (comma > 28) {
    const cut = t.slice(0, comma).trim()
    if (!isLineIncomplete(cut)) return cut.endsWith('.') ? cut : `${cut}.`
  }

  return ''
}

function repairSectionText(text) {
  if (!text) return ''
  const lines = String(text).split('\n')
  const out = []
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      out.push(raw)
      continue
    }
    const fixed = repairIncompleteLine(trimmed)
    if (fixed) out.push(fixed)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function repairSentenceIntegrityInPost(post) {
  if (!post) return post
  return {
    ...post,
    hook: repairSectionText(post.hook || ''),
    body: repairSectionText(post.body || ''),
    cta: repairSectionText(post.cta || ''),
    firstComment: repairSectionText(post.firstComment || ''),
  }
}

/**
 * Shorten for char cap without mid-phrase truncation. Returns '' if the line cannot shrink safely.
 */
export function shortenLineSafely(line, wordsToDrop = 5) {
  const t = String(line || '').trim()
  if (!t) return ''
  const words = t.split(/\s+/)
  if (words.length <= 7) {
    return isLineIncomplete(t) ? repairIncompleteLine(t) || '' : t
  }

  const targetLen = Math.max(6, words.length - wordsToDrop)
  let candidate = words.slice(0, targetLen).join(' ')

  if (!isLineIncomplete(candidate)) return candidate

  for (const sep of ['. ', '? ', '! ']) {
    const joined = words.join(' ')
    let pos = joined.length
    while (pos > 28) {
      const idx = joined.lastIndexOf(sep, pos)
      if (idx < 28) break
      const cut = joined.slice(0, idx + 1).trim()
      if (cut.split(/\s+/).length >= 5 && !isLineIncomplete(cut)) return cut
      pos = idx - 1
    }
  }

  const emIdx = candidate.lastIndexOf(' — ')
  if (emIdx > 20) {
    candidate = candidate.slice(0, emIdx).trim()
    if (!isLineIncomplete(candidate)) {
      return candidate.endsWith('.') ? candidate : `${candidate}.`
    }
  }

  const repaired = repairIncompleteLine(t)
  if (repaired && repaired.length >= 12) return repaired

  return ''
}

/** @returns {number} penalty points for reach ranking */
export function scoreIncompleteSentencePenalty(text) {
  if (!text) return 0
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let penalty = 0
  for (const line of lines) {
    if (isLineIncomplete(line)) penalty += 16
    else if (parenDepth(line) > 0) penalty += 12
  }
  return Math.min(40, penalty)
}

export function incompleteSentenceIssues(post) {
  const sections = [
    ['hook', post?.hook],
    ['body', post?.body],
    ['cta', post?.cta],
  ]
  const issues = []
  for (const [name, text] of sections) {
    if (!text) continue
    for (const line of String(text).split('\n')) {
      const t = line.trim()
      if (t && isLineIncomplete(t)) issues.push(`${name}: unfinished line (“${t.slice(0, 48)}…”)`)
    }
  }
  return issues
}
