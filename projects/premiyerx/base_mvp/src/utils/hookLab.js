/**
 * Hook Lab — classifies a post's opening into a hook archetype and scores it against the
 * 2026 engagement-lift data (ViralBrain / LinkPost corpora): stat 1.67x, story 1.51x,
 * direct/utility 1.45x, list-promise 1.11x, contrarian 1.03x, question/quote ~baseline,
 * and imperative ("Stop doing X", "Read this") ≈ 0.02x — functionally dead under 360Brew.
 *
 * Used both as a reach penalty (refines ranking, nudges the editors) and as prompt guidance.
 */

export const HOOK_ARCHETYPES = {
  stat: { label: 'Stat', lift: 1.67 },
  story: { label: 'Story', lift: 1.51 },
  direct: { label: 'Direct / utility', lift: 1.45 },
  listPromise: { label: 'List promise', lift: 1.11 },
  contrarian: { label: 'Contrarian', lift: 1.03 },
  question: { label: 'Question', lift: 1.0 },
  quote: { label: 'Quote', lift: 1.0 },
  imperative: { label: 'Imperative (dead)', lift: 0.02 },
}

const DEAD_IMPERATIVE_RE =
  /^\s*(stop|don'?t|quit|read this|here'?s the truth|here is the truth|avoid|never|listen up|attention|breaking:)\b/i

const TENSION_RE =
  /\b(vs\.?|versus|but|until|even though|nobody|everybody|everyone|wrong|stop|cost|risk|fail(?:ed|ing)?|broke|broken|surprised|mistake|hard truth|nobody tells)\b|[—–]/i

const OPEN_LOOP_RE =
  /(here'?s why|what happened|the reason|turns out|by the end|keep reading|read on|three (?:things|reasons|patterns|ways)|two (?:things|reasons)|:\s*$|\.\.\.$|…$)/im

const CONTRARIAN_RE =
  /\b(everyone|most people|conventional wisdom|unpopular opinion|hot take|the myth|nobody tells|contrary to)\b/i

const FIRST_PERSON_STORY_RE = /^\s*(i |we |last (?:week|month|quarter|year)|yesterday|a few (?:days|weeks)|back in)/i

/** First 1–2 lines that act as the visible hook before LinkedIn's "see more" cut (~210 chars). */
export function extractHookText(fullTextOrHook) {
  const t = String(fullTextOrHook || '').replace(/\r\n/g, '\n').trim()
  if (!t) return ''
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return ''
  let hook = lines[0]
  if (hook.length < 45 && lines[1]) hook = `${hook} ${lines[1]}`
  return hook.slice(0, 240)
}

export function classifyHook(hookText) {
  const h = String(hookText || '').trim()
  if (!h) return 'direct'
  if (DEAD_IMPERATIVE_RE.test(h)) return 'imperative'
  if (CONTRARIAN_RE.test(h)) return 'contrarian'
  if (/^["“']/.test(h) || /[""].{12,}[""]/.test(h)) return 'quote'
  if (/\b(\d+(?:\.\d+)?%|\$\s?\d|\d+x\b|\b\d{2,})/.test(h)) return 'stat'
  if (/\?\s*$/.test(h) || /^(why|how|what|when|who|which|is|are|should|can|do|does)\b/i.test(h)) return 'question'
  if (/^\s*\d+\s+(things|reasons|ways|lessons|patterns|mistakes)\b/i.test(h)) return 'listPromise'
  if (FIRST_PERSON_STORY_RE.test(h)) return 'story'
  return 'direct'
}

export function analyzeHook(fullTextOrHook) {
  const hook = extractHookText(fullTextOrHook)
  const archetype = classifyHook(hook)
  return {
    hook,
    archetype,
    archetypeLabel: HOOK_ARCHETYPES[archetype]?.label || 'Direct',
    lift: HOOK_ARCHETYPES[archetype]?.lift ?? 1,
    chars: hook.length,
    hasNumber: /\d/.test(hook),
    hasTension: TENSION_RE.test(hook),
    hasOpenLoop: OPEN_LOOP_RE.test(hook),
  }
}

/**
 * Reach penalty (0 = best, capped at 20). Modest by design so it refines ranking and
 * steers the editor passes without dragging every draft below the publish bar.
 */
export function scoreHookPenalty(text) {
  const a = analyzeHook(text)
  if (!a.hook) return 12
  let pts = 0
  if (a.archetype === 'imperative') pts += 14
  if (a.archetype === 'question' && !a.hasNumber) pts += 4
  if (!a.hasNumber && !a.hasTension && a.archetype !== 'story' && a.archetype !== 'contrarian') pts += 6
  // Open-loop / tension is a soft signal; only penalize when BOTH are missing AND there's no number.
  if (!a.hasOpenLoop && !a.hasTension && !a.hasNumber) pts += 4
  if (a.chars > 220) pts += 6
  return Math.min(20, pts)
}

/** Prompt block telling the model to open with a high-lift hook archetype. */
export function buildHookLabDirective() {
  return [
    '',
    'HOOK LAB (2026 engagement-lift data — the opening line decides reach):',
    '- Best lift: STAT hook (lead with a specific number/%, 1.67x) or STORY hook (first-person scene, 1.51x), then DIRECT/utility (1.45x).',
    '- Contrarian works only with a specific counter-fact. Questions are fine ONLY if they carry a number or sharp tension.',
    '- DEAD on arrival (never use): imperative/command openers like "Stop doing…", "Read this", "Here\'s the truth nobody tells you" — 360Brew flags these as templated and suppresses reach.',
    '- The first 1–2 lines (≤210 characters, before "see more") must create tension or an open loop AND promise specific value — not context or a warm-up.',
  ].join('\n')
}
