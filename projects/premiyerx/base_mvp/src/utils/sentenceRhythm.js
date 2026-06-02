/**
 * Sentence-rhythm analysis. Real writers vary length aggressively; AI defaults to
 * three medium-length sentences in a row. We score how uniform the rhythm feels and
 * penalize over-symmetry. Also remixes prose by inserting a one-word reaction line
 * where the body has been three "samey" sentences in a row.
 */

const SENTENCE_SPLIT_RE = /(?<=[.!?…])\s+(?=[A-Z(])/

/** Words in a sentence, ignoring trailing punctuation. */
function wordCount(s) {
  return String(s || '')
    .replace(/[—–:-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/** Bucket: very-short (≤4), short (5–9), medium (10–18), long (19+). */
function lengthBucket(n) {
  if (n <= 4) return 'vs'
  if (n <= 9) return 's'
  if (n <= 18) return 'm'
  return 'l'
}

/**
 * Returns sentence buckets across the full prose body (skipping numbered list items
 * and hashtags so the analyzer only judges flowing prose).
 */
export function analyzeProseSentences(text) {
  if (!text) return { buckets: [], sentences: [] }
  const lines = String(text).split('\n')
  const proseLines = []
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    if (/^\d+\.\s/.test(t)) continue
    if (/^#\w/.test(t)) continue
    proseLines.push(t)
  }
  const flat = proseLines.join(' ')
  const sentences = flat.split(SENTENCE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
  const buckets = sentences.map((s) => lengthBucket(wordCount(s)))
  return { buckets, sentences }
}

/**
 * @returns {number} penalty points (0–24) — higher means too symmetrical.
 * Triggers:
 *  - three consecutive sentences in the SAME bucket
 *  - all sentences in {short, medium} only (no very-short, no long → flat rhythm)
 *  - >= 4 sentences and standard deviation of word counts < 3
 */
export function scoreSentenceRhythm(text) {
  const { buckets, sentences } = analyzeProseSentences(text)
  if (buckets.length < 3) return 0

  let penalty = 0
  for (let i = 2; i < buckets.length; i++) {
    if (buckets[i] === buckets[i - 1] && buckets[i] === buckets[i - 2]) {
      penalty += 2
      break
    }
  }

  const set = new Set(buckets)
  if (buckets.length >= 6 && !set.has('vs') && !set.has('l')) {
    penalty += 3
  }

  if (sentences.length >= 6) {
    const counts = sentences.map(wordCount)
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
    const sd = Math.sqrt(variance)
    if (sd < 2.2) penalty += 3
  }

  return Math.min(12, penalty)
}

const ONE_WORD_REACTIONS = [
  'Honestly?',
  'Look.',
  'Quietly.',
  'Wild.',
  'So.',
  'Read that twice.',
]

/**
 * If the body has three consecutive medium-length sentences with no short break, insert
 * a one-word reaction line between sentence 2 and 3 to break the AI cadence.
 * Conservative: only acts on the first run of three same-bucket sentences in the body.
 */
export function injectRhythmBreak(body, seed = 0) {
  if (!body) return body
  const lines = body.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim()
    if (!line || /^\d+\.\s/.test(line)) continue
    const sentences = line.split(SENTENCE_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
    if (sentences.length < 3) continue
    const buckets = sentences.map((s) => lengthBucket(wordCount(s)))
    let runStart = -1
    for (let i = 2; i < buckets.length; i++) {
      if (buckets[i] === buckets[i - 1] && buckets[i] === buckets[i - 2]) {
        runStart = i - 2
        break
      }
    }
    if (runStart < 0) continue
    const reaction = ONE_WORD_REACTIONS[Math.abs(seed) % ONE_WORD_REACTIONS.length]
    const before = sentences.slice(0, runStart + 2).join(' ')
    const after = sentences.slice(runStart + 2).join(' ')
    lines.splice(li, 1, before, reaction, after)
    return lines.join('\n')
  }
  return body
}
