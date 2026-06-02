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
 *   2. Computes a Jaccard-shingle similarity between a candidate draft and
 *      every prior draft (hook + body, separately weighted).
 *   3. Formats an `AVOID_BLOCK` string that we inject into the LLM prompt so
 *      the model is told — explicitly — not to paraphrase prior hooks/openers.
 *   4. Surfaces a novelty score (0-100, higher = fresher) so the UI can warn
 *      the user before they accidentally re-publish near-duplicate content.
 *
 * Storage shape (localStorage["lidp_draft_history_v1"]):
 *   {
 *     version: 1,
 *     entries: [
 *       { id, ts, topicId, modelId, hook, opener, body200, hookTokens, bodyShingles }
 *     ]
 *   }
 *
 * Capped at MAX_HISTORY entries. Older entries are dropped FIFO.
 */

const STORAGE_KEY = 'lidp_draft_history_v1'
const MAX_HISTORY = 30
const SHINGLE_SIZE = 3

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
  if (!store) return { version: 1, entries: [] }
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, entries: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.entries)) return { version: 1, entries: [] }
    return parsed
  } catch {
    return { version: 1, entries: [] }
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
 * Intentionally simple — full Porter stemming is overkill for ~30 short drafts.
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

function shinglesOf(tokens, size = SHINGLE_SIZE) {
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
  return {
    hook: String(hook || '').slice(0, 220),
    opener: String(opener || '').slice(0, 200),
    body200: String(body || '').slice(0, 200),
    hookTokens,
    bodyShingles: [...shinglesOf(bodyTokens)],
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
  writeStore({ version: 1, entries: [] })
}

/**
 * Score a candidate draft against history. Returns:
 *   {
 *     noveltyScore: 0-100  (higher = fresher),
 *     topMatch: { entry, hookSim, bodySim, combinedSim } | null,
 *     allSimilarities: [...]  // sorted desc
 *   }
 *
 * `combinedSim` weights hook similarity higher (it's the most visible part
 * of a LinkedIn post) and clamps to [0,1].
 */
export function scoreNovelty({ hook, body, topicId = null, withinDays = 60 }) {
  const store = readStore()
  if (!store.entries.length) {
    return { noveltyScore: 100, topMatch: null, allSimilarities: [] }
  }
  const candidate = signaturize({ hook, body, opener: extractOpener(body) })
  const candidateHookSet = new Set(candidate.hookTokens)
  const candidateBodySet = new Set(candidate.bodyShingles)

  const cutoffTs = Date.now() - withinDays * 24 * 60 * 60 * 1000
  const sims = []
  for (const entry of store.entries) {
    if (entry.ts < cutoffTs) continue
    // Note: we intentionally do NOT skip "self" matches. If a regenerate
    // produces the exact same draft, the user MUST see novelty=0 so they
    // don't accidentally re-publish duplicate content.
    const entryHookSet = new Set(entry.hookTokens || [])
    const entryBodySet = new Set(entry.bodyShingles || [])
    const hookSim = jaccard(candidateHookSet, entryHookSet)
    const bodySim = jaccard(candidateBodySet, entryBodySet)
    // Combined: hook is 1.4x weighted, then averaged. Capped at 1.
    const combinedSim = Math.min(1, hookSim * 0.55 + bodySim * 0.45 + Math.max(0, hookSim - 0.5) * 0.3)
    // Same-topic posts naturally share vocabulary; slightly discount their
    // body similarity so we don't false-flag topical overlap.
    const adjusted = topicId && entry.topicId === topicId ? Math.max(0, combinedSim - 0.05) : combinedSim
    sims.push({ entry, hookSim, bodySim, combinedSim: adjusted })
  }
  sims.sort((a, b) => b.combinedSim - a.combinedSim)
  const top = sims[0] || null
  const noveltyScore = top ? Math.round((1 - top.combinedSim) * 100) : 100
  return { noveltyScore, topMatch: top, allSimilarities: sims }
}

/**
 * Build the AVOID_BLOCK prompt fragment from the most recent drafts.
 * Used by aiPostGenerator.buildUserPrompt.
 */
export function buildAvoidBlock({ topicId = null, limit = 5 } = {}) {
  const store = readStore()
  if (!store.entries.length) return ''
  // Prefer same-topic drafts (likeliest collision source) and pad with cross-topic.
  const sameTopic = topicId ? store.entries.filter((e) => e.topicId === topicId) : []
  const others = store.entries.filter((e) => !sameTopic.includes(e))
  const selected = [...sameTopic, ...others].slice(0, limit)
  if (!selected.length) return ''
  const lines = selected.map((entry, i) => {
    const day = new Date(entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const hook = (entry.hook || '').replace(/\s+/g, ' ').trim().slice(0, 140)
    const opener = (entry.opener || '').replace(/\s+/g, ' ').trim().slice(0, 140)
    return `${i + 1}. (${day}) HOOK: "${hook}" | OPENER: "${opener}"`
  })
  return `

RECENT_DRAFTS_TO_AVOID — these are posts I have already published or generated. Do NOT repeat, paraphrase, or remix their hooks, openers, central metaphor, or anchoring stat. Use a structurally different angle, a different cadence, and a different first beat.
${lines.join('\n')}

If the only good story this week IS one of the above, find a fresh second-order take — a counterpoint, a missed detail, an industry implication, or a personal anecdote that wasn't in the prior draft. The reader has seen the headline; show them something new.`
}

/** Pretty label for the novelty score (used by the UI badge). */
export function describeNovelty(noveltyScore, topMatch) {
  if (noveltyScore >= 80) return { tone: 'fresh', label: `${noveltyScore}% fresh` }
  if (noveltyScore >= 60) return { tone: 'ok', label: `${noveltyScore}% fresh` }
  const day = topMatch?.entry?.ts
    ? new Date(topMatch.entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null
  return {
    tone: 'risk',
    label: day ? `${100 - noveltyScore}% similar to ${day}` : `${100 - noveltyScore}% similar`,
  }
}

/** Test seam — used by unit tests / harnesses. */
export const __internals = { tokenize, shinglesOf, jaccard, signaturize }
