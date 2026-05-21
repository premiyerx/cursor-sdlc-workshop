/**
 * Prem Iyer / LinkedInfluence — locked content strategy (from founder Q&A).
 * Drives prompts, scoring sweet spots, and north-star craft references.
 */

/** 90-day growth targets (used in prompts + UI copy). */
export const GROWTH_TARGETS = {
  followersDelta: 6000,
  impressionsPerPost: 25000,
  commentsPerPost: 20,
}

/** Primary ICP + goals */
export const AUDIENCE_PRIMARY = 'CIOs and VPs of Engineering'
export const GROWTH_GOALS = [
  'followers',
  'inbound DMs',
  'strategic account conversations with customers',
]

/** What “pipeline” means for Prem — drives CTA + FIRST_COMMENT tone */
export const PIPELINE_PRIORITY = {
  wins: [
    'Inbound LinkedIn DMs from ICP (CIO / VP Engineering)',
    'Strategic account conversations with existing or target customers',
  ],
  ctaGuidance:
    'CTAs should surface rollout pain, procurement blockers, or “what would you ship first” — so the right readers DM or book a conversation. Comments are secondary but still valuable for algorithm reach.',
  dmInvite:
    'Occasionally (not every post) invite a low-friction DM: e.g. “DM me ROLLOUT if you want the 3-slide checklist” — never link-stuffing or “comment YES” bait.',
}

/**
 * Future ingest — Granola confirmed; Gong TBD.
 * Transcripts → anonymized composite beats in posts (no named customers).
 */
export const TRANSCRIPT_INGEST = {
  granola: {
    status: 'ready_to_plug',
    note: 'Founder has Granola meeting transcripts. Use for fresh operator angles, quoted patterns, and myth-busts — always composite/anonymized.',
  },
  gong: {
    status: 'verify_export',
    note: 'Confirm Gong transcript export or API; same anonymization rules as Granola when available.',
  },
}

/** Post length — mobile-first; shorter than old 1800-char default */
export const POST_LENGTH = {
  /** Hard cap for generation prompts */
  charSoftMax: 1150,
  charHardMax: 1300,
  /** ~38–55 sec read on phone — still enough for dwell if line-broken */
  wordSweetMin: 120,
  wordSweetMax: 200,
  hookMaxChars: 58,
  rehookMaxChars: 120,
  minDoubleLineBreaks: 8,
}

/** Default posting window (founder: 10–11a CT weekdays; skip Thu if needed) */
export const POSTING_WINDOW_CT = '10:00–11:00 CT on Tue/Wed/Fri (Mon ok); avoid Thu this week if overloaded'

/**
 * North-star creators: built large followings *before* mainstream fame.
 * We mimic structure + cadence, not voice cloning.
 */
export const NORTH_STAR_CREATORS = [
  {
    name: 'Justin Welsh',
    built: 'Solo-operator brand from ~0 to 500k+; systems not hustle porn',
    steal: 'One idea per post; numbered framework; hook under 12 words; zero throat-clearing',
  },
  {
    name: 'Lara Acosta',
    built: 'Personal-brand flywheel without celebrity; heavy document/carousel use',
    steal: 'Punchy “see more” line; contrarian hook; one story beat then proof',
  },
  {
    name: 'Nicolas Cole',
    built: 'Atomic essay cadence on LinkedIn before mainstream fame',
    steal: 'Single thesis; 3 implications; high save rate; no second thesis',
  },
  {
    name: 'Dickie Bush',
    built: 'Ship-30 clarity; writing craft over influencer performance',
    steal: 'Short lines; one lesson; respect the reader’s time',
  },
  {
    name: 'Aadit Sheth',
    built: 'Data hooks without being a household name',
    steal: 'Lead with one sourced number; translate to operator action',
  },
  {
    name: 'Matt Gray',
    built: 'Founder systems content; consistent visual brand',
    steal: 'Name the system; 3 steps; one question',
  },
  {
    name: 'Adam Robinson (RB2B)',
    built: 'B2B GTM operator voice; peer to revenue leaders',
    steal: 'GTM math; pipeline reality; no generic “thought leadership”',
  },
]

/** Cursor-forward phrases — use sparingly, never all in one post */
export const CURSOR_SIGNATURE_PHRASES = [
  'repo-wide context, not file-at-a-time autocomplete',
  'agents that ship diffs, not chat that suggests snippets',
  'enduring software at scale (when speaking to enterprise buyers)',
  'the SDLC your board actually funds — not another pilot',
  'production rollout with owners, dates, and audit trails',
]

/** Competitive shade — implicit only; never name-and-shame */
export const CURSOR_COMPETITIVE_SHADE = [
  'The gap is not “more AI suggestions” — it is whether the tool understands the whole codebase.',
  'Autocomplete on one file is not the same as reasoning across services, tests, and migrations.',
  'Teams do not fail because the model is dumb; they fail because context stops at the open tab.',
]

export function buildNorthStarBlock() {
  const lines = NORTH_STAR_CREATORS.map(
    (c) => `• ${c.name}: ${c.steal}`,
  )
  return [
    'NORTH-STAR CRAFT (non-celebrity operators who scaled from zero — mimic structure, not voice):',
    ...lines,
    'Prem stays provocateur + news-wire: contrarian hook, sourced receipt, respectful edge.',
  ].join('\n')
}

export function buildPipelineBlock() {
  return [
    'PIPELINE (how LinkedIn ties to revenue):',
    `• Primary wins: ${PIPELINE_PRIORITY.wins.join('; ')}.`,
    `• ${PIPELINE_PRIORITY.ctaGuidance}`,
    `• ${PIPELINE_PRIORITY.dmInvite}`,
  ].join('\n')
}

export function buildPremStrategyBlock() {
  return [
    'FOUNDER STRATEGY (non-negotiable):',
    `• Audience: ${AUDIENCE_PRIMARY}. Goals: ${GROWTH_GOALS.join(' + ')}.`,
    buildPipelineBlock(),
    '• Tone: more provocative than typical B2B — earn the swipe with tension, not cruelty.',
    '• Length: SHORT mobile posts — target ~750–1,150 characters with aggressive line breaks (not essay walls).',
    '• Stories: composite VP/CIO scenes OK; never name a specific customer.',
    '• No Prem headshot/photo in generated visuals. No competitor logos; no faces in graphics.',
    '• Cursor: promote with implicit contrast (repo context, agents, rollout) — subtle shade, no direct attacks.',
    '• Hashtags: 3–5 topical only. Sources in caption OK for defensibility.',
    '• Opinion-only posts allowed when substantive + a fresh angle not repeated from recent runs.',
    '• Cadence: 3–5 posts/week; rotate pillars (Cursor, investment, CIO, ROI).',
    '• Carousel caption teases the deck; do not repeat final-slide question verbatim.',
    `• Posting window: ${POSTING_WINDOW_CT}.`,
    `• Targets (90d): +${GROWTH_TARGETS.followersDelta} followers, ~${GROWTH_TARGETS.impressionsPerPost} impressions/post, ${GROWTH_TARGETS.commentsPerPost}+ comments/post.`,
  ].join('\n')
}

export function buildGoldenHourBlock() {
  return [
    'GOLDEN HOUR (still weighted in 2026 heuristics — not an official LinkedIn formula):',
    '• First ~60 minutes after publish disproportionately affect distribution in creator data.',
    '• Post FIRST_COMMENT immediately after publishing: one new stat or angle NOT in the body + a second question.',
    '• Reply to every substantive comment in that hour with 2+ sentences — threads beat likes.',
    '• Pinning on LinkedIn: publish post → comment your FIRST_COMMENT text as a normal comment → click ••• on that comment → Pin.',
  ].join('\n')
}
