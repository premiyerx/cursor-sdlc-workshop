/**
 * Keeps numbered-list promises in sync with actual items (e.g. "Three patterns" → 1. 2. 3.).
 */
import { shortenLineSafely } from './postSentenceIntegrity.js'

const COUNT_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
}

const COUNT_LABEL = ['', 'One', 'Two', 'Three', 'Four', 'Five']

const PROMISE_RE =
  /\b(one|two|three|four|five|\d)\s+(patterns?|things?|reasons?|ways?|mistakes?|signals?|beats?|lessons?|truths?|myths?|steps?|rules?|levers?|shifts?|trends?|insights?|picks?|rollouts?)\b/gi

const NUMBERED_LINE_RE = /^\d+\.\s/

export function countNumberedListItems(text) {
  if (!text) return 0
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => NUMBERED_LINE_RE.test(l)).length
}

/**
 * A phrase like "Three patterns" or "Two reasons" is only a *list promise* when:
 *  - the count is >= 2 (we never treat "one X" as a list tease — "one rule" is plain English), AND
 *  - the matched span is followed by `:` within 80 chars OR a numbered "1. " line appears
 *    anywhere after the match.
 * This avoids false positives like "one rule", "two retries", "two things can be true".
 */
function isActualPromise(text, matchIndex, count) {
  if (count < 2) return false
  const tail = text.slice(matchIndex, matchIndex + 80)
  if (/:\s/.test(tail)) return true
  const rest = text.slice(matchIndex)
  if (/(?:^|\n)\s*1\.\s/.test(rest)) return true
  return false
}

/** @returns {number} highest promised count in text, or 0 */
export function getMaxPromisedCount(text) {
  if (!text) return 0
  let max = 0
  for (const m of text.matchAll(PROMISE_RE)) {
    const raw = String(m[1] || '').toLowerCase()
    const n = COUNT_WORDS[raw] ?? parseInt(raw, 10)
    if (!Number.isFinite(n)) continue
    if (!isActualPromise(text, m.index ?? 0, n)) continue
    if (n > max) max = n
  }
  return max
}

function singularize(noun) {
  const n = String(noun || '').toLowerCase()
  if (n.endsWith('ies')) return `${n.slice(0, -3)}y`
  if (n.endsWith('s') && n.length > 3) return n.slice(0, -1)
  return n
}

function pluralize(noun, count) {
  const base = singularize(noun)
  if (count === 1) return base
  if (base.endsWith('y')) return `${base.slice(0, -1)}ies`
  return `${base}s`
}

function rewritePromisePhrase(_full, _countToken, noun, actualCount) {
  const countWord = COUNT_LABEL[actualCount] || String(actualCount)
  const nounOut = pluralize(noun, actualCount)
  if (actualCount === 1) {
    return `One ${nounOut}`
  }
  return `${countWord} ${nounOut}`
}

/**
 * Fix "Three patterns…" when only 1–2 numbered lines exist; renumber 1. 2. 3. without gaps.
 */
export function repairPromisedLists(post) {
  if (!post) return post
  let hook = post.hook || ''
  let body = post.body || ''
  const numbered = countNumberedListItems(body)
  const promised = getMaxPromisedCount(`${hook}\n${body}`)

  if (promised > 0 && numbered > 0 && promised > numbered) {
    const fixLine = (line) => {
      if (!PROMISE_RE.test(line)) return line
      PROMISE_RE.lastIndex = 0
      return line.replace(PROMISE_RE, (full, _c, noun) => {
        const replacement = rewritePromisePhrase(full, _c, noun, numbered)
        return replacement
      })
    }
    hook = hook
      .split('\n')
      .map((l) => fixLine(l))
      .join('\n')
    body = body
      .split('\n')
      .map((l) => (NUMBERED_LINE_RE.test(l.trim()) ? l : fixLine(l)))
      .join('\n')
  }

  if (promised > 0 && numbered === 0) {
    const stripPromise = (line) => {
      if (!PROMISE_RE.test(line)) return line
      PROMISE_RE.lastIndex = 0
      return line.replace(PROMISE_RE, '').replace(/\s{2,}/g, ' ').replace(/:\s*$/, '').trim()
    }
    hook = hook
      .split('\n')
      .map((l) => stripPromise(l))
      .filter(Boolean)
      .join('\n')
    body = body
      .split('\n')
      .map((l) => (NUMBERED_LINE_RE.test(l.trim()) ? l : stripPromise(l)))
      .filter(Boolean)
      .join('\n')
  }

  body = renumberListItems(body)

  return { ...post, hook: hook.trim(), body: body.trim() }
}

export function renumberListItems(body) {
  if (!body) return ''
  let n = 0
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!NUMBERED_LINE_RE.test(trimmed)) return line
      n += 1
      const content = trimmed.replace(/^\d+\.\s*/, '')
      return `${n}. ${content}`
    })
    .join('\n')
}

/** @deprecated Prefer shortenLineSafely — keeps sentence boundaries intact. */
export function shortenLineWords(line, wordsToDrop = 5) {
  return shortenLineSafely(line, wordsToDrop)
}

/** Penalty when post teases N list items but delivers fewer. */
export function scoreIncompleteListPenalty(text) {
  const promised = getMaxPromisedCount(text || '')
  const actual = countNumberedListItems(text || '')
  if (promised > 0 && actual > 0 && actual < promised) {
    return (promised - actual) * 14
  }
  if (promised > 0 && actual === 0) return promised * 10
  return 0
}
