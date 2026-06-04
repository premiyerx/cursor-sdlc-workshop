/**
 * Golden-hour kit — Move 3 of the LinkedIn distribution playbook.
 *
 * Reach is decided in the first 60–90 minutes by engagement velocity and
 * REPLY QUALITY (LinkedIn weights comments over ~12 words far more than likes).
 * This builds a small launch kit per draft:
 *   - 3–5 substantive seed-reply scaffolds the author PERSONALIZES (never auto-
 *     posts — LinkedIn now also demotes generic/bot AI comments).
 *   - A checklist of the highest-leverage golden-hour behaviors.
 *
 * Everything here is deterministic (no API cost) and derived from the draft.
 */

const STAT_RE = /(\$[\d.]+\s?[bmkBMK]?(?:illion)?|\d+(?:\.\d+)?\s?%|\b\d+x\b|\b\d{2,}\b)/

function firstStat(text) {
  const m = String(text || '').match(STAT_RE)
  return m ? m[1].trim() : ''
}

/** Pull a short, human noun phrase to anchor a reply (topic label, else hook keyword). */
function anchorPhrase(topicLabel, hook) {
  const label = String(topicLabel || '').trim()
  if (label) return label.toLowerCase()
  const h = String(hook || '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
  return h.split(/\s+/).slice(0, 4).join(' ').toLowerCase() || 'this'
}

/**
 * Build the golden-hour kit for a finished post.
 * @param {{hook?:string, body?:string, cta?:string}} post
 * @param {{topicLabel?:string}} [opts]
 * @returns {{seedReplies: string[], checklist: string[], note: string}}
 */
export function buildGoldenHourKit(post, opts = {}) {
  const hook = post?.hook || ''
  const body = post?.body || ''
  const stat = firstStat(`${hook}\n${body}`)
  const anchor = anchorPhrase(opts.topicLabel, hook)

  const statClause = stat
    ? `the ${stat} number`
    : 'that number'

  // Scaffolds are intentionally specific-but-incomplete: each has a [bracket]
  // the author fills with a REAL detail so the comment reads human, not bot.
  const seedReplies = [
    `Worth adding: when we ran into ${anchor} at [company/team], the part that actually bit us was [specific surprise] — not the headline metric. Anyone else see that?`,
    `Pushback worth airing: ${statClause} looks great until [the trade-off you keep hitting]. How are you accounting for that on your side?`,
    `The detail people skip: [a named role — e.g. a CISO] told me last [day] that [specific concern]. Curious whether that matches what others are hearing.`,
    `If you only change one thing this quarter on ${anchor}, I'd argue it's [the one lever] — because [the second-order reason]. Disagree?`,
    `Follow-up for the comments: did this play out top-down for you, or did [engineers/teams] force it from the bottom up? The difference changes everything downstream.`,
  ]

  const checklist = [
    'Reply to every comment within the first 60 minutes — early reply velocity is a top-weighted golden-hour signal.',
    'Keep each reply 12+ words and end with a question, so the commenter comes back for a second visit (it doubles their dwell contribution).',
    'Privately nudge 5–10 relevant peers right after posting — a genuine "thought you\'d have a take" DM, never "please like".',
    'Do not edit the post in the first hour (edits can reset distribution). If you must share a link, drop it in a reply, not the body.',
    'Personalize each seed reply with one real detail before you use it — LinkedIn now demotes generic/AI-sounding comments too.',
  ]

  return {
    seedReplies,
    checklist,
    note: 'Personalize the [brackets] with a real specific before posting. These are starters, not copy-paste.',
  }
}
