/**
 * Entropy + anti-repetition for template picks and AI prompts.
 * Hooks are stored in sessionStorage (session-only) to nudge the model away from near-duplicates.
 */

const RECENT_HOOKS_KEY = 'lidp_recent_hooks_v1'
const RECENT_TPL_KEY = 'lidp_recent_tpl_idx_v1'
const MAX_RECENT_HOOKS = 14
const MAX_RECENT_TPL = 7

export function fnv1a(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** Seeded PRNG — exported for carousel / UI tie-breaks that should vary per session. */
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sessionGet(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function sessionSet(key, val) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val))
  } catch { /* quota / private mode */ }
}

export function getRecentHooks(limit = 10) {
  const arr = sessionGet(RECENT_HOOKS_KEY, [])
  return Array.isArray(arr) ? arr.slice(0, limit) : []
}

export function recordGeneratedHook(hook) {
  if (!hook || typeof hook !== 'string') return
  const line = hook.split('\n')[0].trim().slice(0, 220)
  if (line.length < 12) return
  const prev = getRecentHooks(MAX_RECENT_HOOKS)
  const next = [line, ...prev.filter((h) => h !== line)].slice(0, MAX_RECENT_HOOKS)
  sessionSet(RECENT_HOOKS_KEY, next)
}

function getRecentTemplateIndices(topicId) {
  const o = sessionGet(RECENT_TPL_KEY, {})
  return Array.isArray(o[topicId]) ? o[topicId] : []
}

function pushRecentTemplateIndex(topicId, idx) {
  const o = sessionGet(RECENT_TPL_KEY, {})
  const prev = Array.isArray(o[topicId]) ? o[topicId] : []
  const next = [idx, ...prev.filter((i) => i !== idx)].slice(0, MAX_RECENT_TPL)
  o[topicId] = next
  sessionSet(RECENT_TPL_KEY, o)
}

/**
 * Picks a template index biased away from the last few picks for this topic.
 */
export function pickTemplateIndex(topicId, templateCount) {
  if (templateCount <= 1) return 0
  const recent = getRecentTemplateIndices(topicId)
  const seed =
    fnv1a(String(topicId)) ^
    (Date.now() & 0xffffffff) ^
    ((typeof performance !== 'undefined' && performance.now ? performance.now() : 0) * 1e6) ^
    (Math.random() * 0x7fffffff) >>> 0
  const rng = mulberry32(seed >>> 0)
  let pick = Math.floor(rng() * templateCount) % templateCount
  for (let attempt = 0; attempt < 32 && recent.includes(pick); attempt++) {
    pick = Math.floor(rng() * templateCount) % templateCount
  }
  pushRecentTemplateIndex(topicId, pick)
  return pick
}

const DEFAULT_LENSES = [
  'Treat this as a memo from the field: what changed in the last 7–14 days that a busy exec would miss.',
  'Write as if you are translating a board conversation into one actionable post—no fluff.',
  'Contrast two opposing instincts in the market (speed vs. safety, build vs. buy) and resolve with evidence.',
  'Anchor on a specific workflow pain (PR review, security review, hiring loop, vendor bake-off) and go deep.',
  'Use a "before AI / after AI" arc for one concrete team outcome—numbers only where sourced.',
  'Frame as lessons from three anonymous patterns you keep seeing (composite, not invented stats).',
  'Lead with a decision tree: the one fork most teams get wrong, and what the data says instead.',
]

const LENSES_BY_TOPIC = {
  cursor: [
    ...DEFAULT_LENSES,
    'Focus on agentic workflows, context windows, or SDLC integration—not generic "AI coding" hype.',
    'Pick one: developer trust, auditability, enterprise rollout, or security review of AI tools.',
  ],
  investment: [
    ...DEFAULT_LENSES,
    'Tie capital flows to second-order effects: talent markets, M&A, platform shifts, or infra spend.',
    'What would a skeptical CFO ask next—answer it with disciplined, cited reasoning.',
  ],
  cio: [
    ...DEFAULT_LENSES,
    'Write for a CIO who already approved pilots—what breaks at scale (governance, data, org design)?',
    'Balance enablement vs. control: one concrete policy or operating model move.',
  ],
  roi: [
    ...DEFAULT_LENSES,
    'Force a single ROI storyline: payback, risk reduction, or revenue velocity—pick one and prove it.',
    'Expose a hidden cost center that AI shifts (meetings, rework, incidents)—stay sourced.',
  ],
}

const HOOK_MODES = [
  'Hook opens with a sharp time or market anchor (this week / Q2 / "since last month")—not a platitude.',
  'Hook uses a tension pair in one line (e.g. speed vs. safety) with a number in 8–12 words.',
  'Hook opens with a specific scenario ("A team of 40 just…")—composite/anonymized is fine if honest.',
  'Hook leads with one counterintuitive claim, then the body earns it with sourced proof.',
  'Hook is a crisp question-shaped headline that still includes a number (yes, questions can carry numerals).',
]

const BODY_SHAPES = [
  'Body: PAS (problem → agitate → solution) but swap in fresh examples—no recycled phrasing from prior runs.',
  'Body: "Myth → reality → playbook" in three beats; each beat has at least one cited stat or defensible directional claim.',
  'Body: numbered "rules of thumb" (4 max) executives can forward; each ties to a sourced or hedged claim.',
  'Body: one short anecdote + teardown of the wrong takeaway + what you would do instead this quarter.',
  'Body: "what changed / so what / now what" with aggressive line breaks and arrow lists.',
]

const VOICE_MODULATORS = [
  'Voice: more surgical and terse than usual—cut 10% of adjectives you would normally use.',
  'Voice: one deliberate metaphor max; prefer concrete nouns (systems, contracts, SLAs, boards).',
  'Voice: include one respectful nod to an opposing view, then rebut with evidence.',
]

const BANNED_OPENERS = [
  'In today\'s fast-paced',
  'In the world of',
  'Let\'s dive',
  'Let\'s talk about',
  'game-changer',
  'Game changer',
  'Unlock the power',
  'synergy',
  'At the end of the day',
  'It goes without saying',
]

/**
 * Unique run envelope for the model (plain text block appended to the user prompt).
 */
export function buildVarietyEnvelope(topicId, topicLabel) {
  const perf = typeof performance !== 'undefined' ? String(performance.now()) : '0'
  const seed =
    (Date.now() ^
      fnv1a(`${topicId}:${perf}`) ^
      (Math.imul(fnv1a(String(Math.random())), 2654435761) >>> 0)) >>>
    0
  const rng = mulberry32(seed === 0 ? 0x9e3779b9 : seed)
  const pick = (arr) => {
    if (!arr || arr.length === 0) return ''
    return arr[Math.floor(rng() * arr.length) % arr.length]
  }

  const pool = LENSES_BY_TOPIC[topicId] || DEFAULT_LENSES
  const runId = `${Date.now().toString(36)}-${(Math.random() + '').slice(2, 11)}`
  const recent = getRecentHooks(8)

  const lines = [
    '',
    '=== UNIQUE GENERATION RUN (mandatory) ===',
    `RUN_ID: ${runId} — treat this as a fresh composition; do not self-plagiarize from typical LinkedIn-AI patterns.`,
    `PILLAR: "${topicLabel}" (${topicId})`,
    `LOCAL_TIME_ANCHOR: ${new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    '',
    `CREATIVE_LENS (primary): ${pick(pool)}`,
    `HOOK_MODE: ${pick(HOOK_MODES)}`,
    `BODY_SHAPE: ${pick(BODY_SHAPES)}`,
    `VOICE_MODULATOR: ${pick(VOICE_MODULATORS)}`,
    '',
    'ANTI-REPETITION:',
    '- Do NOT reuse hook openings, metaphors, or numbered frameworks from your own typical outputs.',
    `- Banned weak openers (do not use these phrases anywhere in the hook): ${BANNED_OPENERS.join('; ')}`,
    '- Vary sentence rhythm: mix very short lines with one longer evidence line; avoid parallel cliché triplets.',
    '',
  ]

  if (recent.length > 0) {
    lines.push('RECENT_HOOKS_FROM_THIS_BROWSER_SESSION (do not closely imitate; write something clearly different):')
    recent.forEach((h, i) => lines.push(`${i + 1}. ${h}`))
    lines.push('')
  }

  lines.push(
    'FRESHNESS: Reference models, agents, funding, regulation, or enterprise adoption ONLY with sourced or hedged language ("reports suggest", "vendors claim", "our teams see"). Never invent dates, rounds, or model names.',
    'OUTPUT: This exact run must feel like a 1-of-1; a second generation the same day should choose a different angle, hook shape, and evidence mix.',
    '=== END UNIQUE RUN ===',
    '',
  )

  return lines.join('\n')
}

/**
 * Rotate which slice of headlines to emphasize (caller passes headline count).
 */
export function headlinePromptOffset(headlineCount, topicId) {
  if (headlineCount <= 1) return 0
  const day = new Date().toDateString()
  return fnv1a(topicId + day + String(Math.floor(Date.now() / 3_600_000))) % headlineCount
}
