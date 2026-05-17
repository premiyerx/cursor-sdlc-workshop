/**
 * Structural patterns from high-performing *operator* LinkedIn writers (not celebrity influencers).
 * Archetypes: field memo, spreadsheet truth, myth-bust, composite VP story, decision fork.
 */
import { fnv1a, mulberry32 } from './generationVariety'

const VIRAL_OPERATOR_ARCHETYPES = [
  {
    id: 'field_memo',
    label: 'Field memo',
    pattern:
      'Open like a one-paragraph memo to your peer group: "Three things I\'m seeing this week…" then numbered beats. Feels exclusive, not performative.',
    structure: 'Hook (time-stamped) → 3 bullets with → arrows → one "so what" line → question',
    voice: 'Calm authority. No hype adjectives. Sounds like a text to another exec.',
  },
  {
    id: 'spreadsheet_truth',
    label: 'Spreadsheet truth',
    pattern:
      'Make one economic argument visceral: back-of-napkin math in the body (sourced or hedged). Viral operators show the math, not the mantra.',
    structure: 'Hook with number → re-hook "(here\'s the math)" → 4-line ROI stack → flip → question',
    voice: 'CFO-adjacent. Concrete nouns: seats, payback, margin, cycle time.',
  },
  {
    id: 'myth_bust',
    label: 'Myth → receipt',
    pattern:
      'Name a comfortable lie the feed believes, then dismantle with 2–3 receipts (headline + stat). End before sounding smug.',
    structure: 'Hook names the myth → "Actually:" → evidence stack → respectful reframe → question',
    voice: 'Contrarian but fair. Acknowledge why the myth is tempting.',
  },
  {
    id: 'composite_vp',
    label: 'Composite VP story',
    pattern:
      'One anonymized scene ("A VP of Eng told me last Tuesday…") — composite OK if honest. Story earns the framework.',
    structure: 'Scene hook → tension → what they did wrong → what worked instead → question',
    voice: 'Storytelling without name-dropping clients. "I\'ve seen" / "last quarter" anchors.',
  },
  {
    id: 'decision_fork',
    label: 'Decision fork',
    pattern:
      'Present two paths executives confuse. Show the wrong default, the right fork, and the cost of waiting. Highly saveable.',
    structure: 'Hook = the fork → Path A vs Path B → evidence → "most teams pick wrong because…" → question',
    voice: 'Advisory, not preachy. Peer-to-peer.',
  },
  {
    id: 'news_receipt',
    label: 'News receipt',
    pattern:
      'Lead with a fresh headline as receipt, then immediately translate: "So what for your org?" Never paste the headline as the hook verbatim.',
    structure: 'Hook = your take on the news → cite signal in body → 3 implications → question',
    voice: 'Journalist speed + operator judgment. Paraphrase news; add POV.',
  },
]

const SCROLL_STOPPERS = [
  'First line must pass the "would a busy CIO stop scrolling?" test — specificity beats cleverness.',
  'No throat-clearing. No "I\'ve been thinking about…" — start mid-thought.',
  'One idea per post. If you have two theses, cut the weaker one.',
  'End the body on a forward-looking line, not a summary.',
]

const COMMENT_MAGNETS = [
  'Ask for a specific artifact: "What metric does YOUR board actually track?"',
  'Offer two options in the question: "Bottom-up adoption or top-down mandate — which won in your org?"',
  'Invite a counterexample respectfully: "Where has this NOT worked for you?"',
  'Invite a threaded reply: "Push back if you disagree—what nuance am I missing for your industry?"',
]

/**
 * Pick one viral archetype for this generation run (stable per hour+topic).
 */
export function pickViralArchetype(topicId) {
  const hour = Math.floor(Date.now() / 3_600_000)
  const seed = fnv1a(`${topicId}:viral:${hour}:${Math.random()}`) >>> 0
  const rng = mulberry32(seed || 0xabc123)
  const idx = Math.floor(rng() * VIRAL_OPERATOR_ARCHETYPES.length) % VIRAL_OPERATOR_ARCHETYPES.length
  return VIRAL_OPERATOR_ARCHETYPES[idx]
}

/**
 * Plain-text block for AI prompts.
 */
export function buildViralCraftBlock(topicId) {
  const archetype = pickViralArchetype(topicId)
  const stopper = SCROLL_STOPPERS[fnv1a(topicId + 'stop') % SCROLL_STOPPERS.length]
  const comment = COMMENT_MAGNETS[fnv1a(topicId + 'cmt') % COMMENT_MAGNETS.length]

  return [
    '',
    'VIRAL OPERATOR CRAFT (non-celebrity B2B patterns — stay in Prem\'s voice):',
    `- Archetype this run: ${archetype.label} — ${archetype.pattern}`,
    `- Structure: ${archetype.structure}`,
    `- Voice: ${archetype.voice}`,
    `- Scroll: ${stopper}`,
    `- Comment magnet: ${comment}`,
    '- Do NOT sound like a generic LinkedIn guru, life coach, or engagement bait ("Agree?", "Thoughts?", "Comment YES").',
    '- Sound like a peer operator who invests, sells to CxOs, and has seen rollouts — not a motivational poster.',
    '',
  ].join('\n')
}

export { VIRAL_OPERATOR_ARCHETYPES }
