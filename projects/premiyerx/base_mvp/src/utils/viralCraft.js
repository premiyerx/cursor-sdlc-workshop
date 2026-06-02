/**
 * Structural patterns from high-performing *operator* LinkedIn writers (not celebrity influencers).
 * Archetypes: field memo, spreadsheet truth, myth-bust, anonymized VP story, decision fork.
 */
import { fnv1a, mulberry32 } from './generationVariety'
import { buildNorthStarBlock, CURSOR_COMPETITIVE_SHADE, CURSOR_SIGNATURE_PHRASES } from '../data/contentStrategy'

const VIRAL_OPERATOR_ARCHETYPES = [
  {
    id: 'field_memo',
    label: 'Field memo',
    pattern:
      'Open like a one-paragraph memo to your peer group: "Three things I\'m seeing this week…" then numbered beats. Feels exclusive, not performative.',
    structure: 'Hook (time-stamped) → three short lines (blank line between) → one "so what" line → question',
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
    voice: 'Provocateur + news-wire: contrarian but fair. Acknowledge why the myth is tempting.',
  },
  {
    id: 'composite_vp',
    label: 'Anonymized VP story',
    pattern:
      'One anonymized scene ("A VP of Eng told me last Tuesday…"). Story earns the framework. NEVER write the meta-words "composite" or "anonymized" inside the post itself — they are reviewer notes, not reader copy.',
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
  'Invite a counterexample respectfully: "Where has this NOT worked for you?"',
  'Invite a threaded reply: "Push back if you disagree—what nuance am I missing for your industry?"',
  'Ask for a single workflow: "Which one process would you automate first if you trusted the audit trail?"',
  'Surface procurement reality: "What would unblock a wider rollout at your company—security, cost, or change management?"',
  'Ask for receipts: "What evidence would change your mind on this in the next 90 days?"',
  'Compare two failure modes: "Where do you see pilots die first—policy, latency, or trust?"',
  'Ask for a metric tradeoff: "If you could only move one number this quarter, which would it be?"',
  'Invite a scenario: "What would you do differently if the tool understood your whole repo, not just the current file?"',
  'Ask for scope: "What would you refuse to let an agent touch without a human in the loop?"',
  'Invite DM (sparingly): "If you are rolling this out at enterprise scale, DM me — happy to share the one-page checklist we use with strategic accounts."',
  'Invite conversation: "If this matches a live pursuit on your side, DM me ROLLOUT — I will point you to the right next conversation."',
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

  const cursorShade =
    topicId === 'cursor'
      ? CURSOR_COMPETITIVE_SHADE[fnv1a(`${topicId}:shade`) % CURSOR_COMPETITIVE_SHADE.length]
      : ''
  const cursorPhrase =
    topicId === 'cursor'
      ? CURSOR_SIGNATURE_PHRASES[fnv1a(`${topicId}:sig`) % CURSOR_SIGNATURE_PHRASES.length]
      : ''

  return [
    '',
    buildNorthStarBlock(),
    '',
    'VIRAL OPERATOR CRAFT (this run):',
    `- Archetype: ${archetype.label} — ${archetype.pattern}`,
    `- Structure: ${archetype.structure}`,
    `- Voice: ${archetype.voice}`,
    `- Scroll: ${stopper}`,
    `- Comment magnet: ${comment}`,
    cursorPhrase ? `- Cursor angle (one phrase max): ${cursorPhrase}` : '',
    cursorShade ? `- Implicit competitive contrast (do not name competitors): ${cursorShade}` : '',
    '- Provocative is OK — tension drives views; no personal attacks or named customers.',
    '- Do NOT sound like generic LinkedIn AI ("Key takeaway", "leverage", "game-changer", "let\'s dive").',
    '- Do NOT use → arrow bullets or markdown bold.',
    '- Target ~750–1,150 characters in BODY with 8+ blank-line breaks (mobile scan).',
    '',
  ].join('\n')
}

export { VIRAL_OPERATOR_ARCHETYPES }
