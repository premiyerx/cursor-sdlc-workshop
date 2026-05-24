/**
 * Keeps numbered-list promises in sync with actual items (e.g. "Three patterns" → 1. 2. 3.).
 */

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

/** @returns {number} highest promised count in text, or 0 */
export function getMaxPromisedCount(text) {
  if (!text) return 0
  let max = 0
  for (const m of text.matchAll(PROMISE_RE)) {
    const raw = String(m[1] || '').toLowerCase()
    const n = COUNT_WORDS[raw] ?? parseInt(raw, 10)
    if (Number.isFinite(n) && n > max) max = n
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

export function shortenLineWords(line, wordsToDrop = 5) {
  const words = line.trim().split(/\s+/)
  if (words.length <= 7) return line.trim()
  return words.slice(0, Math.max(6, words.length - wordsToDrop)).join(' ')
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
