/**
 * Four distinct structural templates the generator rotates through so posts don't all
 * read the same shape. Rotation is mixed across topics: each session gets a different
 * mapping (story / contrarian / before-after / question-led) per topic, and successive
 * generations on the same topic step through the four templates.
 *
 * Always optimized for mobile feed: short opening line(s), blank line break, then proof.
 */

import { fnv1a } from './generationVariety.js'

export const STRUCTURE_TEMPLATES = [
  {
    id: 'short-story',
    label: 'Short story',
    summary: 'A specific moment with a person, time, and outcome — not a framework.',
    rules: [
      'Open with a scene line (a person, time, or place) in 6–10 words. One short opening line, then a blank line for "see more".',
      'Tell what happened in 2–3 plain sentences. Vary length: a one-word reaction is welcome.',
      'No numbered list. No "patterns/lessons" framework. The story IS the proof.',
      'Close with what you DM\'d, asked, or did next — not a moral.',
    ],
    avoid: ['headers', 'numbered lists', 'frameworks', 'three-rules summaries'],
  },
  {
    id: 'contrarian',
    label: 'Contrarian take',
    summary: 'State the consensus view, then disagree with one specific reason.',
    rules: [
      'Open with the consensus line everyone repeats — under 10 words. Blank line. Then your one-line counter.',
      'One concrete data point or named situation that backs the counter. Real number, real role, real outcome.',
      'Up to two short follow-ups in plain sentences (not bullets) — uneven length, mixed rhythm.',
      'End on a question that asks the reader for THEIR counter-evidence.',
    ],
    avoid: ['three-rules lists', 'parallel bullets', 'consultant summaries', 'soft middle'],
  },
  {
    id: 'before-after',
    label: 'Before / after',
    summary: 'A specific team or situation before a change, then after — concrete deltas.',
    rules: [
      'Hook names the team or situation in concrete terms (size, role, sector). 8–12 words.',
      'Body has two short blocks: "Before:" (one line) and "After:" (one line). Then 1–2 sentences on what actually changed (the why), not a list of metrics.',
      'At most ONE numbered list of three items if the deltas are crisp; otherwise plain prose.',
      'Close with a question about the reader\'s own before/after — or what they\'d try first.',
    ],
    avoid: ['vanity metrics with no source', 'four+ bullets', '"key takeaway" line'],
  },
  {
    id: 'question-led',
    label: 'Question-led',
    summary: 'Open with a real question a peer would actually ask. The post is the answer.',
    rules: [
      'Hook IS the question — concrete, peer-to-peer, under 14 words. Includes a number or named role when natural.',
      'First body line: a one-word or one-phrase reaction ("Honestly?" / "Depends on this:") to break the AI cadence.',
      'Then 2–3 short paragraphs answering. Avoid numbered lists unless the answer truly enumerates.',
      'Close with a follow-up question that pushes for THEIR specific answer (not "thoughts?").',
    ],
    avoid: ['rhetorical-then-pivot openers ("Ever wondered...")', '"the answer is simple" framing'],
  },
]

const STRUCTURE_BY_ID = Object.fromEntries(STRUCTURE_TEMPLATES.map((t) => [t.id, t]))

const RECENT_STRUCTURE_KEY = 'lidp_recent_structure_v1'
const MAX_RECENT_STRUCTURE = 6

function sessionGet(key, fallback) {
  try {
    if (typeof sessionStorage === 'undefined') return fallback
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function sessionSet(key, val) {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(key, JSON.stringify(val))
  } catch { /* quota / private */ }
}

/**
 * Per-day, per-browser mapping of topicId → starting structure index.
 * Each topic gets a different starting template every day, so the four pillars
 * never share the same shape on the same day.
 */
function startingStructureIndexForTopic(topicId) {
  const day = new Date().toUTCString().slice(0, 16)
  const seed = fnv1a(`${topicId}|${day}`)
  return seed % STRUCTURE_TEMPLATES.length
}

/**
 * Pick a structure template for this generation. Avoids the last few picked structures
 * for this topic in the current session. Returns the template descriptor.
 */
export function pickStructureTemplate(topicId) {
  const map = sessionGet(RECENT_STRUCTURE_KEY, {})
  const recent = Array.isArray(map[topicId]) ? map[topicId] : []
  const start = startingStructureIndexForTopic(topicId)

  let chosen = STRUCTURE_TEMPLATES[start]
  for (let step = 0; step < STRUCTURE_TEMPLATES.length; step++) {
    const candidate = STRUCTURE_TEMPLATES[(start + step + recent.length) % STRUCTURE_TEMPLATES.length]
    if (!recent.includes(candidate.id)) {
      chosen = candidate
      break
    }
  }

  const next = [chosen.id, ...recent.filter((id) => id !== chosen.id)].slice(0, MAX_RECENT_STRUCTURE)
  map[topicId] = next
  sessionSet(RECENT_STRUCTURE_KEY, map)

  return chosen
}

export function getStructureTemplateById(id) {
  return STRUCTURE_BY_ID[id] || null
}

/** Plain-text block to splice into the LLM user prompt. */
export function buildStructureDirective(template) {
  if (!template) return ''
  const rules = template.rules.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
  const avoid = template.avoid?.length
    ? `\nAvoid for this post: ${template.avoid.join('; ')}.`
    : ''
  return [
    '',
    `STRUCTURE_FOR_THIS_POST: ${template.label} — ${template.summary}`,
    'Rules (mandatory for this generation):',
    rules,
    avoid.trim(),
    'Mobile-first formatting still applies: hook is one short line, blank-line break before body, beats short and scannable.',
    'Format must NOT bleed into a "framework" shape if this template is short-story or question-led.',
    '',
  ]
    .filter(Boolean)
    .join('\n')
}
