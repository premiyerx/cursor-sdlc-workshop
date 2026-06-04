/**
 * Personal-anchor suggester — Move 1 helper.
 *
 * The whole point of an anchor is that it's TRUE. So this never fabricates a
 * fake "a CISO told me…" story (invented specifics are exactly what erodes
 * trust and what the filter eventually catches). Instead it offers two honest
 * paths:
 *   1. "React to a real number" — built from the verified data registry. The
 *      stat is real, sourced, and current, so a genuine reaction to it reads
 *      human and passes the AI filter. Usable as-is.
 *   2. "Quick-recall prompts" — bracketed scaffolds that jog you to a real
 *      detail from your week in ~10 seconds. You fill the bracket with truth.
 */
import { getVerifiedStatsForTopic } from './verifiedInfographic'

const SCAFFOLDS_BY_TOPIC = {
  cursor: [
    'A [VP Eng / staff engineer] on my team said [day] the real unlock from AI coding tools was not speed, it was [specific — e.g. fewer context-switches in review].',
    'We rolled AI coding tools out to [N] engineers; the surprise was [specific behavior change], not the [metric we expected to move].',
  ],
  investment: [
    'A [partner / operator] I spoke with last [week] is now underwriting AI dev-tool deals on [specific metric — e.g. seat expansion], not [the vanity metric everyone quotes].',
    'The deal detail that changed my mind recently: [specific — e.g. NRR held at X% after the pilot converted].',
  ],
  cio: [
    'A CIO at a [industry] company told me [day] their blocker on AI dev tools was [specific — e.g. SOC2 evidence], not budget.',
    'In a [board / steering] review last [week], the question that stalled the room was [specific question].',
  ],
  roi: [
    'We measured [specific metric] before and after [tool]; the number that actually moved was [X] — the one that did not was [Y].',
    'The payback math that surprised our [CFO / finance partner]: [specific — e.g. 6-week payback on a $Xk seat spend].',
  ],
}

const GENERIC_SCAFFOLDS = [
  'Last [day], a [role] told me [the specific thing they said].',
  'The detail that surprised me this week: [specific number or moment].',
  'Something I changed my mind about recently: [specific], because [what made you rethink it].',
]

function trimContext(ctx, max = 90) {
  const t = String(ctx || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/**
 * @param {string} topicId
 * @returns {{ reactAnchors: {text:string, source:string}[], memoryJogs: string[] }}
 */
export function suggestPersonalAnchors(topicId) {
  const reactAnchors = []
  try {
    const stats = getVerifiedStatsForTopic(topicId, 3)
    for (const s of stats) {
      if (!s || !s.value || s.value === '—') continue
      const ctx = trimContext(s.context)
      const fact = ctx ? `${s.value} — ${ctx}` : s.value
      reactAnchors.push({
        text: `React in your own voice to this real, current number: ${fact} (${s.source}). Say why it does or doesn't match what you're seeing.`,
        source: s.source || 'Registry',
      })
      if (reactAnchors.length >= 2) break
    }
  } catch {
    /* registry unavailable — fall back to scaffolds only */
  }

  const memoryJogs = [...(SCAFFOLDS_BY_TOPIC[topicId] || []), ...GENERIC_SCAFFOLDS].slice(0, 4)
  return { reactAnchors, memoryJogs }
}
