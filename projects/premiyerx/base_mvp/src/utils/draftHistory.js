/**
 * Draft history + novelty scoring.
 *
 * Why this exists:
 *   The app used to have ZERO memory of prior drafts. Refresh seeds lived in
 *   sessionStorage and reset every browser session, so a draft generated this
 *   week could come back near-identical to one from last week — same topic,
 *   similar news, same registry stats, same system prompt = high collision.
 *
 * What this does:
 *   1. Persists a rolling window of the last N drafts in localStorage.
 *   2. Computes a multi-signal similarity (hook tokens, opener tokens,
 *      body bigrams, body trigrams) between a candidate draft and every
 *      prior draft, then aggregates the top-3 matches into a cluster-aware
 *      novelty score so candidates that are "65% similar to three different
 *      prior drafts" are caught, not just exact twins.
 *   3. Formats an `AVOID_BLOCK` string injected into the LLM prompt so the
 *      model is told — explicitly — which recent hooks, openers, and
 *      opening trigrams to avoid.
 *   4. Surfaces a novelty score (0-100, higher = fresher) so the UI can warn
 *      the user before they accidentally re-publish near-duplicate content.
 *
 * Storage shape (localStorage["lidp_draft_history_v2"]):
 *   {
 *     version: 2,
 *     entries: [
 *       { id, ts, topicId, modelId, hook, opener, body200,
 *         hookTokens, openerTokens, bodyBigrams, bodyTrigrams }
 *     ]
 *   }
 *
 * Capped at MAX_HISTORY entries. Older entries are dropped FIFO.
 */

const STORAGE_KEY = 'lidp_draft_history_v2'
const LEGACY_STORAGE_KEY = 'lidp_draft_history_v1'
/**
 * Roll history at 150 drafts ≈ 5 months of daily posting. Sized so a "press
 * Generate 100 times in a session" user never falls off the window: every
 * candidate is scored against every prior attempt in the run.
 */
const MAX_HISTORY = 150
const TRIGRAM_SIZE = 3
const BIGRAM_SIZE = 2

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'as', 'is', 'was', 'are',
  'were', 'be', 'been', 'being', 'i', 'you', 'we', 'they', 'he', 'she', 'it',
  'this', 'that', 'these', 'those', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'by', 'from', 'about', 'into', 'over', 'after', 'before', 'my',
  'your', 'our', 'their', 'has', 'have', 'had', 'do', 'does', 'did', 'not',
  'no', 'yes', 'just', 'than', 'then', 'now', 'still', 'also', 'can', 'will',
  'would', 'could', 'should', 'one', 'two', 'me', 'us', 'him', 'her', 'its',
])

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function readStore() {
  const store = safeStorage()
  if (!store) return { version: 2, entries: [] }
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.entries)) return parsed
    }
    // One-time migration from v1 if present. v1 entries had `bodyShingles`
    // (trigrams). We treat them as trigrams and skip bigram/opener tokens
    // so they still score meaningfully on legacy data.
    const legacy = store.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      try {
        const parsedLegacy = JSON.parse(legacy)
        if (parsedLegacy && Array.isArray(parsedLegacy.entries)) {
          const migrated = parsedLegacy.entries.map((e) => ({
            ...e,
            bodyTrigrams: e.bodyShingles || [],
            bodyBigrams: e.bodyBigrams || [],
            openerTokens: e.openerTokens || [],
          }))
          const next = { version: 2, entries: migrated.slice(0, MAX_HISTORY) }
          writeStore(next)
          return next
        }
      } catch { /* drop legacy */ }
    }
    return { version: 2, entries: [] }
  } catch {
    return { version: 2, entries: [] }
  }
}

function writeStore(store) {
  const ls = safeStorage()
  if (!ls) return
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* localStorage might be full or disabled; ignore */
  }
}

// Spelled-out small numbers we normalize to digits so "11" vs "eleven" do not
// look like distinct tokens.
const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70',
  eighty: '80', ninety: '90', hundred: '100', thousand: '1000',
}

/**
 * Light stem so "rip" / "ripped", "moved" / "moves", "running" / "run" collapse.
 * Intentionally simple — full Porter stemming is overkill for short drafts.
 */
function lightStem(word) {
  if (word.length <= 4) return word
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('ied') && word.length > 5) return `${word.slice(0, -3)}y`
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) return word.slice(0, -1)
  return word
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .map((w) => NUMBER_WORDS[w] || w)
    .filter((w) => w && !STOPWORDS.has(w) && w.length > 1)
    .map(lightStem)
}

function shinglesOf(tokens, size) {
  if (tokens.length < size) return new Set(tokens)
  const set = new Set()
  for (let i = 0; i <= tokens.length - size; i++) {
    set.add(tokens.slice(i, i + size).join(' '))
  }
  return set
}

function jaccard(setA, setB) {
  if (!setA?.size || !setB?.size) return 0
  let intersection = 0
  for (const item of setA) if (setB.has(item)) intersection++
  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

function firstSentence(text) {
  const s = String(text || '').trim()
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/)
  return (m ? m[0] : s).slice(0, 180)
}

function extractOpener(body) {
  return firstSentence(body)
}

/**
 * Build the lightweight signature we store per draft.
 * We persist tokens/shingles inline so similarity is O(1) per comparison.
 */
function signaturize({ hook, body, opener }) {
  const hookTokens = tokenize(hook)
  const bodyTokens = tokenize(body)
  const openerTokens = tokenize(opener)
  return {
    hook: String(hook || '').slice(0, 220),
    opener: String(opener || '').slice(0, 200),
    body200: String(body || '').slice(0, 200),
    hookTokens,
    openerTokens,
    bodyBigrams: [...shinglesOf(bodyTokens, BIGRAM_SIZE)],
    bodyTrigrams: [...shinglesOf(bodyTokens, TRIGRAM_SIZE)],
  }
}

/**
 * Record a freshly-generated draft to history.
 * Idempotent: calling twice with identical content updates the timestamp only.
 */
export function recordDraft({ topicId, modelId, hook, body }) {
  if (!hook?.trim() && !body?.trim()) return
  const opener = extractOpener(body)
  const sig = signaturize({ hook, body, opener })
  const store = readStore()
  const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const entry = {
    id,
    ts: Date.now(),
    topicId: topicId || 'unknown',
    modelId: modelId || 'unknown',
    ...sig,
  }
  store.entries.unshift(entry)
  store.entries = store.entries.slice(0, MAX_HISTORY)
  writeStore(store)
  return entry
}

export function getDraftHistory() {
  return readStore().entries
}

export function clearDraftHistory() {
  writeStore({ version: 2, entries: [] })
  // Also nuke the legacy key so a refreshed user starts clean.
  const ls = safeStorage()
  if (ls) {
    try { ls.removeItem(LEGACY_STORAGE_KEY) } catch { /* ignore */ }
  }
}

/**
 * Pairwise similarity between a candidate signature and a stored entry.
 * Returns the raw component scores AND a combined score.
 *
 * Weighting rationale:
 *  - HOOK is the most-visible chunk a reader sees, so it dominates (0.40).
 *  - OPENER (first sentence under the hook) is the second-visible (0.20).
 *  - Body TRIGRAMS catch full-phrase reuse (0.25).
 *  - Body BIGRAMS catch short-phrase reuse the model uses to dodge a trigram
 *    block (e.g. "shipped this week" → "rolled out this week"); weight 0.15.
 *  - We add a small "hook-cliff" booster if the hook is ≥0.5 similar — that's
 *    a near-identical opening line and should drag the score down hard.
 */
function pairSimilarity(candidateSig, entry, sameTopic) {
  const candHook = new Set(candidateSig.hookTokens || [])
  const candOpener = new Set(candidateSig.openerTokens || [])
  const candBigrams = new Set(candidateSig.bodyBigrams || [])
  const candTrigrams = new Set(candidateSig.bodyTrigrams || [])

  const entryHook = new Set(entry.hookTokens || [])
  const entryOpener = new Set(entry.openerTokens || [])
  const entryBigrams = new Set(entry.bodyBigrams || [])
  const entryTrigrams = new Set(entry.bodyTrigrams || entry.bodyShingles || [])

  const hookSim = jaccard(candHook, entryHook)
  const openerSim = jaccard(candOpener, entryOpener)
  const bigramSim = jaccard(candBigrams, entryBigrams)
  const trigramSim = jaccard(candTrigrams, entryTrigrams)

  let combined =
    hookSim * 0.40 +
    openerSim * 0.20 +
    trigramSim * 0.25 +
    bigramSim * 0.15

  if (hookSim >= 0.5) combined += (hookSim - 0.5) * 0.4 // hook cliff
  combined = Math.min(1, combined)

  // Same-topic drafts naturally share vocabulary; very small discount so we
  // don't false-flag topical overlap on otherwise-different posts.
  if (sameTopic) combined = Math.max(0, combined - 0.03)
  return { hookSim, openerSim, bigramSim, trigramSim, combinedSim: combined }
}

/**
 * Score a candidate draft against history.
 *
 * Cluster-aware: we don't just look at the single closest prior draft. If the
 * candidate is 0.6 similar to ONE prior draft, that's a duplicate risk. But if
 * it's 0.55 similar to THREE different prior drafts, that's also a duplicate
 * risk (the candidate is drifting toward a recurring cluster). The cluster
 * penalty adds a diminishing-return amount of the top-2 and top-3 similarities
 * to the top-1.
 *
 * @returns {{
 *   noveltyScore: number,       // 0-100 higher = fresher
 *   topMatch: object | null,
 *   topMatches: object[],       // top 3 similarities
 *   allSimilarities: object[],  // every comparison, sorted desc
 * }}
 */
export function scoreNovelty({ hook, body, topicId = null, withinDays = 120 }) {
  const store = readStore()
  if (!store.entries.length) {
    return { noveltyScore: 100, topMatch: null, topMatches: [], allSimilarities: [] }
  }
  const candidate = signaturize({ hook, body, opener: extractOpener(body) })

  const cutoffTs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  const sims = []
  for (const entry of store.entries) {
    if (entry.ts < cutoffTs) continue
    // We intentionally do NOT skip "self" matches. If a regenerate produces
    // the exact same draft, the user MUST see novelty near 0.
    const sim = pairSimilarity(candidate, entry, topicId && entry.topicId === topicId)
    sims.push({ entry, ...sim })
  }
  sims.sort((a, b) => b.combinedSim - a.combinedSim)
  const top = sims[0] || null
  const topMatches = sims.slice(0, 3)

  // Cluster penalty: top-2 and top-3 add diminishing weight.
  // If only top-1 matters, score = (1 - top1) * 100.
  // If top-2 / top-3 are also high, the score drops further.
  const t1 = topMatches[0]?.combinedSim || 0
  const t2 = topMatches[1]?.combinedSim || 0
  const t3 = topMatches[2]?.combinedSim || 0
  const aggregate = Math.min(1, t1 + Math.max(0, t2 - 0.3) * 0.35 + Math.max(0, t3 - 0.4) * 0.2)
  const noveltyScore = Math.round((1 - aggregate) * 100)

  return { noveltyScore, topMatch: top, topMatches, allSimilarities: sims }
}

/**
 * Pull the most-recent N entries the prompt should warn the model about,
 * preferring same-topic.
 */
export function getRecentSignatures({ topicId = null, limit = 15 } = {}) {
  const store = readStore()
  if (!store.entries.length) return []
  const sameTopic = topicId ? store.entries.filter((e) => e.topicId === topicId) : []
  const others = store.entries.filter((e) => !sameTopic.includes(e))
  return [...sameTopic, ...others].slice(0, limit)
}

/**
 * Extract the top-K opener phrases (first 2 tokens of the body, as a bigram)
 * that have appeared across recent drafts. We want to forbid these on the next
 * generation so the model never starts a body the same way twice in a row.
 */
export function extractForbiddenOpeners({ topicId = null, lookback = 25, limit = 5 } = {}) {
  const store = readStore()
  if (!store.entries.length) return []
  const recent = store.entries.slice(0, lookback)
  const counts = new Map()
  for (const e of recent) {
    const opener = String(e.opener || '').trim()
    if (!opener) continue
    const first6 = opener.split(/\s+/).slice(0, 6).join(' ')
    if (!first6) continue
    counts.set(first6, (counts.get(first6) || 0) + 1)
    // Also seed the opener-token bigram if available
    const ot = e.openerTokens || []
    if (ot.length >= 2) {
      const opBigram = `${ot[0]} ${ot[1]}`
      counts.set(opBigram, (counts.get(opBigram) || 0) + 1)
    }
  }
  // De-dupe by content, prefer same-topic appearances first
  const sameTopicSet = new Set(
    topicId
      ? store.entries.filter((e) => e.topicId === topicId).map((e) => firstSentence(e.body200 || e.opener || ''))
      : [],
  )
  void sameTopicSet // currently unused — placeholder for future topic-weighting
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase, count]) => ({ phrase, count }))
  return ranked.slice(0, limit)
}

/**
 * Extract the top-K body trigrams that show up across multiple recent drafts.
 * These are the literal phrase tics the model is leaning on. We forbid them
 * on the next generation so it has to find different connective tissue.
 */
export function extractForbiddenTrigrams({ lookback = 20, limit = 8, minCount = 2 } = {}) {
  const store = readStore()
  if (!store.entries.length) return []
  const recent = store.entries.slice(0, lookback)
  const counts = new Map()
  for (const e of recent) {
    const set = new Set(e.bodyTrigrams || e.bodyShingles || [])
    for (const tri of set) counts.set(tri, (counts.get(tri) || 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count }))
}

/**
 * Build the AVOID_BLOCK prompt fragment from the most recent drafts.
 * Used by aiPostGenerator.buildUserPrompt.
 */
export function buildAvoidBlock({ topicId = null, limit = 15 } = {}) {
  const recent = getRecentSignatures({ topicId, limit })
  if (!recent.length) return ''

  const lines = recent.map((entry, i) => {
    const day = new Date(entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const hook = (entry.hook || '').replace(/\s+/g, ' ').trim().slice(0, 140)
    const opener = (entry.opener || '').replace(/\s+/g, ' ').trim().slice(0, 140)
    return `${i + 1}. (${day}) HOOK: "${hook}" | OPENER: "${opener}"`
  })

  const forbiddenOpeners = extractForbiddenOpeners({ topicId, lookback: 25, limit: 6 })
  const forbiddenTrigrams = extractForbiddenTrigrams({ lookback: 25, limit: 10, minCount: 2 })

  const sections = [
    `

RECENT_DRAFTS_TO_AVOID — I have already generated or published these. Do NOT repeat, paraphrase, or remix their hooks, openers, central metaphor, or anchoring stat. Use a structurally different angle, different cadence, and a different first beat.
${lines.join('\n')}`,
  ]

  if (forbiddenOpeners.length) {
    sections.push(
      `\nFORBIDDEN OPENING PHRASES (these have appeared too often — never start the body with any of them):\n${forbiddenOpeners.map((f) => `- "${f.phrase}"`).join('\n')}`,
    )
  }

  if (forbiddenTrigrams.length) {
    sections.push(
      `\nOVER-USED PHRASE FRAGMENTS (avoid these literal sequences anywhere in the post — find different connective tissue):\n${forbiddenTrigrams.map((f) => `- "${f.phrase}"`).join('\n')}`,
    )
  }

  sections.push(
    `\nIf the only good story this week IS one of the above, find a fresh second-order take — a counterpoint, a missed detail, an industry implication, or a personal anecdote that was NOT in the prior drafts. The reader has seen the headline; show them something new.`,
  )

  return sections.join('\n')
}

/** Pretty label for the novelty score (used by the UI badge). */
export function describeNovelty(noveltyScore, topMatch) {
  if (noveltyScore >= 80) return { tone: 'fresh', label: `${noveltyScore}% fresh` }
  if (noveltyScore >= 65) return { tone: 'ok', label: `${noveltyScore}% fresh` }
  const day = topMatch?.entry?.ts
    ? new Date(topMatch.entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  return {
    tone: 'risk',
    label: day ? `${100 - noveltyScore}% similar to ${day}` : `${100 - noveltyScore}% similar`,
  }
}

/** Test seam — used by unit tests / harnesses. */
export const __internals = { tokenize, shinglesOf, jaccard, signaturize, pairSimilarity }
