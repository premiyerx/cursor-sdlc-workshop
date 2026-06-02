/**
 * Viral tactic-stacking — the strongest signal in 2026 viral-post corpora (LinkPost n=4,353)
 * is that top posts STACK 4–6 high-leverage tactics, not that they have any single one.
 * Most over-represented vs. baseline: quantified proof (61%), open loop (47%),
 * memorable quote (45%), pattern interrupt (26%), social proof / polarization (25%).
 *
 * We detect which tactics a draft already stacks and penalize thin (1–2 tactic) drafts.
 * We also expose the highest-lift post "skeletons" as prompt guidance.
 */

const TACTIC_TESTS = {
  quantifiedProof: (t) => /(\b\d+(?:\.\d+)?%|\$\s?\d[\d.,]*[bmk]?\b|\b\d+x\b|\b\d{2,}\b)/i.test(t),
  openLoop: (t) =>
    /(here'?s why|what happened|the reason|turns out|by the end|keep reading|three (?:things|reasons|patterns|ways)|two (?:things|reasons))/i.test(
      t,
    ) || /:\s*$/m.test(t),
  memorableQuote: (t) => /[""].{12,}[""]|"[^"]{12,}"/.test(t),
  patternInterrupt: (t) =>
    /^(?:\s*)(wrong\.|nope\.|honestly\?|two things\.|wild\.|here'?s the thing|plot twist)/im.test(t) ||
    /\n\s*\S{1,18}[.?!]\s*\n/.test(t),
  polarization: (t) =>
    /\b(everyone|most people|conventional wisdom|unpopular opinion|hot take|controversial|nobody tells|the myth)\b/i.test(
      t,
    ),
  openQuestion: (t) => /\?\s*$/m.test(t),
  socialProof: (t) =>
    /\b(VP|CIO|CTO|director|customers?|enterprises?|Fortune 500|F500|\d+\s+(?:companies|teams|engineers|customers))\b/i.test(
      t,
    ),
  vulnerability: (t) => /\b(i was wrong|my mistake|i failed|i screwed|embarrassing|i didn'?t|i used to think)\b/i.test(t),
  personalInsight: (t) => /\b(i learned|what i (?:now )?(?:know|do)|the lesson i|i keep seeing|in my experience)\b/i.test(t),
}

/** Returns { count, tactics: { name: bool } } for the high-leverage tactic set. */
export function detectTactics(text) {
  const t = String(text || '')
  const tactics = {}
  let count = 0
  for (const [name, test] of Object.entries(TACTIC_TESTS)) {
    const hit = !!t && test(t)
    tactics[name] = hit
    if (hit) count += 1
  }
  return { count, tactics }
}

/**
 * Reach penalty (0 = best, capped at 18). Viral drafts stack 4+ tactics; thin drafts lose reach.
 */
export function scoreTacticStackPenalty(text) {
  const { count } = detectTactics(text)
  if (count >= 5) return 0
  if (count === 4) return 2
  if (count === 3) return 6
  if (count === 2) return 11
  return 18
}

/** Highest-lift post skeletons from the 2026 corpora — used as prompt guidance, not rigid templates. */
export const VIRAL_SKELETONS = [
  {
    id: 'feature-deep-dive',
    label: 'Feature Deep-Dive',
    lift: '4.58x',
    shape: 'Direct/utility hook → tight value beats (a real method or teardown) → resource-style CTA that earns saves.',
  },
  {
    id: 'identity-pivot',
    label: 'Identity Pivot Narrative',
    lift: '3.48x',
    shape: 'Story hook (who you were → the turn) → one concrete scene with a number → reflective open question.',
  },
  {
    id: 'full-circle',
    label: 'Full-Circle Reflection',
    lift: '3.30x',
    shape: 'Story/stat hook → mid-post tension or mistake → callback to the opening line with the payoff.',
  },
  {
    id: 'counterpoint-invite',
    label: 'Counterpoint Invitation',
    lift: '~2x',
    shape: 'Contrarian hook with a specific counter-fact → proof beat → invite the reader to argue the other side.',
  },
]

/** Prompt block: stack tactics + lean on a proven skeleton. */
export function buildTacticStackDirective() {
  return [
    '',
    'VIRAL TACTIC STACK (2026 data — viral posts stack 4–6 of these, not just one):',
    '- Quantified proof (a real number/%/$), an open loop early, one memorable one-line quote, a pattern interrupt (a 1–3 word line), and social proof (a named role/scale).',
    '- Stack at least 4 of these naturally across hook + body. A single-tactic post rarely travels.',
    '- Reward depth over polish: one specific, save-worthy insight beats five generic lines.',
    'PROVEN SKELETONS (pick whichever fits the angle; do not announce it):',
    ...VIRAL_SKELETONS.map((s) => `  • ${s.label} (${s.lift}): ${s.shape}`),
  ].join('\n')
}
