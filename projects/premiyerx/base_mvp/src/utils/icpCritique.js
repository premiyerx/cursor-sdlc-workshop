/**
 * ICP critique pass — read each draft back as the target reader (CIO, VP Engineering, CFO,
 * CISO, VP DevOps/DevSecOps, CEO of an enterprise/Fortune 1000) and remove anything that
 * makes it sound like an AI memo instead of a peer-to-peer LinkedIn post.
 *
 * Deterministic only (no extra LLM call) so it adds zero latency. Runs after humanize so it
 * sees the post in the same shape the reader will see it.
 *
 * Hard rules (per founder request):
 *  - No em-dashes (—) or en-dashes (–) anywhere in copy.
 *  - No emojis in hook/body/CTA. (Hashtags untouched.)
 *  - Stronger AI-phrase blocklist than the humanizer's first pass.
 *  - CTA must be a peer-to-peer question to the named ICP roles, not a sermon.
 */

const EM_DASH = /—/g
const EN_DASH = /–/g

/** Broad emoji + dingbat range. Hashtags get a pass; we strip from hook/body/CTA only. */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u2600-\u27BF\u2700-\u27BF\u24C2-\u24FF\u2B05-\u2B07\u2934\u2935\u2139\u2199\u21A9\u21AA\uFE0F]/gu

/** Phrases the founder explicitly does not want, even when soft. Deleted outright. */
const ICP_PHRASE_STRIPS = [
  /\bIn the world of\b/gi,
  /\bAt the heart of\b/gi,
  /\bIt'?s no secret that\b/gi,
  /\bIt is no secret that\b/gi,
  /\bWhen it comes to\b/gi,
  /\bAs we (?:all )?know\b/gi,
  /\bWithout a doubt\b/gi,
  /\bMake no mistake\b/gi,
  /\bThe truth is\b/gi,
  /\bLong story short[,:]?\s*/gi,
  /\bIn essence,?\s*/gi,
  /\bUltimately,?\s*/gi,
  /\bThat said,?\s*/gi,
  /\bAll things considered,?\s*/gi,
  /\bNeedless to say,?\s*/gi,
  /\bSuffice (?:it )?to say,?\s*/gi,
  /\bI'?ll be honest[,:]?\s*/gi,
  /\bTo be honest[,:]?\s*/gi,
  /\bLet me tell you[,:]?\s*/gi,
  /\bHere'?s a (?:hot )?take[,:]?\s*/gi,
  /\bPlot twist[,:]?\s*/gi,
  /\bSpoiler[,:]?\s*/gi,
  /\bSpoiler alert[,:]?\s*/gi,
  /\bMind\s*=\s*blown\b/gi,
  /\bBoom\.?\s*/gi,
  /\bYep\.?\s*/gi,
  /\bThis is huge\.?\s*/gi,
  /\bA must[- ]read\b/gi,
  /\bWelcome to (?:the future|the new normal)\b/gi,
  /\bThe future is here\b/gi,
  /\bThe writing is on the wall\b/gi,
  /\bMoving the needle\b/gi,
  /\bMove the needle\b/gi,
  /\bDouble[- ]click on\b/gi,
  /\bDouble click on\b/gi,
  /\bcircle back\b/gi,
  /\bdeep[- ]dive into\b/gi,
  /\btable stakes\b/gi,
  /\blow[- ]hanging fruit\b/gi,
  /\bnorth star\b/gi,
  /\bbest[- ]in[- ]class\b/gi,
  /\bworld[- ]class\b/gi,
  /\bcutting[- ]edge\b/gi,
  /\bnext[- ]gen(?:eration)?\b/gi,
  /\bmission[- ]critical\b/gi,
  /\bparadigm shift\b/gi,
  /\bnew era of\b/gi,
  /\bturning point\b/gi,
]

/** Soft swaps — keeps the meaning, dumps the corporate tone. */
const ICP_WORD_SWAPS = [
  [/\bnavigate\b/gi, 'handle'],
  [/\bempower(?:s|ed|ing)?\b/gi, (m) => preserveSuffix(m, 'help')],
  [/\baccelerate(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'speed up')],
  [/\bstreamline(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'simplify')],
  [/\boptimize(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'tune')],
  [/\bfacilitate(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'enable')],
  [/\benhance(?:s|d|ing)?\b/gi, (m) => preserveSuffix(m, 'improve')],
  [/\binnovative\b/gi, 'new'],
  [/\bgroundbreaking\b/gi, 'new'],
  [/\brevolutionary\b/gi, 'new'],
  [/\bseamless(?:ly)?\b/gi, 'clean'],
  [/\bfrictionless\b/gi, 'clean'],
  [/\bunparalleled\b/gi, 'rare'],
  [/\bunprecedented\b/gi, 'rare'],
  [/\bpivotal\b/gi, 'key'],
  [/\bquintessential\b/gi, 'classic'],
  [/\bplethora of\b/gi, 'many'],
  [/\bmyriad (?:of\s+)?\b/gi, 'many '],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
]

function preserveSuffix(match, base) {
  const lower = String(match).toLowerCase()
  const cap = /^[A-Z]/.test(match)
  let out = base
  if (lower.endsWith('ing')) out = `${base.replace(/e$/, '')}ing`
  else if (lower.endsWith('ed')) out = `${base}d`
  else if (lower.endsWith('s')) out = `${base}s`
  return cap ? out.charAt(0).toUpperCase() + out.slice(1) : out
}

/**
 * Replace em/en-dashes with the most context-appropriate punctuation:
 *  - " — word"   → ", word"   (parenthetical-style aside)
 *  - "word — word" → "word, word"
 *  - "word—word" (no spaces, mid-word) → "word, word"
 *  - bare line-start em-dash → ""  (drop)
 */
export function stripDashesFromCopy(text) {
  if (!text) return ''
  let t = String(text)
  t = t.replace(/^\s*[—–]\s*/gm, '')
  t = t.replace(/\s*[—–]\s*$/gm, '.')
  t = t.replace(/(\S)\s*[—–]\s*(\S)/g, '$1, $2')
  t = t.replace(EM_DASH, ', ')
  t = t.replace(EN_DASH, ', ')
  t = t.replace(/,\s*,/g, ',')
  t = t.replace(/\s+,/g, ',')
  // Collapse ".)." → ".)" and ")." duplicates that show up after parenthetical injections.
  t = t.replace(/\)\.\s*\./g, ').')
  t = t.replace(/\.\)\s*\./g, '.)')
  return t
}

function dropEmojis(text) {
  if (!text) return ''
  return String(text).replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/\s+\n/g, '\n')
}

/**
 * Strip reviewer/meta labels that have a habit of leaking into the post body:
 *   "(composite scene — a VP Eng told me last week)"   → "(a VP Eng told me last week)"
 *   "(a CIO told me, composite scene.)"                → "(a CIO told me.)"
 *   "(composite scene.)"                               → ""
 *   "anonymized:"  / "(anonymized)"                    → ""
 *   "hypothetical example,"                            → ""
 *
 * The IDEA — anonymizing roles instead of naming real customers — is correct.
 * The LABELS for that idea are private editorial notes, not reader copy.
 */
function scrubMetaLabels(text) {
  if (!text) return ''
  let t = String(text)

  // 1) Whole parenthetical asides whose ONLY content is a meta-label.
  t = t.replace(
    /\s*\((?:\s*(?:composite\s+(?:scene|vp|story|example)|anonymized(?:\s+(?:scene|story))?|hypothetical(?:\s+example)?))\s*[.!?]?\s*\)/gi,
    '',
  )

  // 2) Meta-label fragments that appear INSIDE an otherwise-real anecdote
  //    parenthetical. We drop just the fragment + any leading "," or "—".
  t = t.replace(
    /,?\s*(?:composite\s+(?:scene|vp|story|example)|anonymized(?:\s+(?:scene|story))?|hypothetical(?:\s+example)?)(?=\s*[.,;)])/gi,
    '',
  )

  // 3) Naked sentence-leading labels: "Composite scene: a VP …", "Anonymized:".
  t = t.replace(
    /(^|\n)\s*(?:composite\s+(?:scene|vp|story|example)|anonymized(?:\s+(?:scene|story))?|hypothetical(?:\s+example)?)\s*[:.]\s*/gi,
    '$1',
  )

  // 4) Bare inline tokens left over ("…here's the pattern. composite scene.")
  t = t.replace(
    /\b(?:composite\s+(?:scene|vp|story|example)|anonymized(?:\s+(?:scene|story))?|hypothetical(?:\s+example)?)\b/gi,
    '',
  )

  // 5) Collapse the punctuation/whitespace fallout from the removals.
  t = t
    .replace(/\(\s*[,.;]\s*/g, '(')
    .replace(/\s*,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s+([.,;!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

function applyIcpSwaps(text) {
  if (!text) return ''
  let t = String(text)
  for (const re of ICP_PHRASE_STRIPS) t = t.replace(re, '')
  for (const [re, rep] of ICP_WORD_SWAPS) t = t.replace(re, rep)
  return t.replace(/[ \t]{2,}/g, ' ').replace(/\s+\n/g, '\n').trim()
}

/**
 * Standalone "punchy" lines that LLMs love to emit but that read as filler.
 * These are matched against an entire trimmed body line — never against
 * substrings — so a sentence like "Wild ride for the dev team this quarter."
 * is kept while a bare "Wild." line is dropped.
 *
 * Why this exists: a real failure case looked like
 *   "A staff engineer deleted 4 AI editors in one sprint."
 *   "Two Fortune 500 calls, 48 hours apart."
 *   "Two things can be true at once."
 *   "Wild."
 *   "Same complaint both times."
 *
 * The hook is fine; the rest is fragmentary one-liners with no connecting
 * tissue. We strip the obvious filler lines and the orphan anaphora.
 */
const AI_FILLER_LINES = [
  /^(?:Wild|Brutal|Real|Truth|Facts?|Yikes|Oof|Welp|Damn|Wow|Same|Both|This|That|Right|Exactly|Indeed|Painful|Honest|Fact|Crazy|Insane)[.!?]*$/i,
  /^(?:Right|Same|This|That)\??$/i,
  /^Two things can be true(?: at once)?[.!?]*$/i,
  /^Two truths(?: at once)?[.!?]*$/i,
  /^Both can be true[.!?]*$/i,
  /^Make it make sense[.!?]*$/i,
  /^Read that again[.!?]*$/i,
  /^Let that sink in[.!?]*$/i,
  /^Let me say that again[.!?]*$/i,
  /^Say it (?:again|louder)(?: for the people in the back)?[.!?]*$/i,
  /^I'?ll wait[.!?]*$/i,
  /^Just saying[.!?]*$/i,
  /^Just sayin[.!?]*$/i,
  /^Make of (?:that|this) what you will[.!?]*$/i,
  /^Food for thought[.!?]*$/i,
  /^Big if true[.!?]*$/i,
  /^Tell me I'?m wrong[.!?]*$/i,
  /^Fight me[.!?]*$/i,
  /^Change my mind[.!?]*$/i,
  /^Trust the process[.!?]*$/i,
  /^Iykyk[.!?]*$/i,
  /^IYKYK[.!?]*$/i,
]

/**
 * Orphan anaphora: "Same complaint both times", "Both teams agreed", "Either
 * way it lands the same" — these phrases REFER to something earlier (the
 * complaint, the teams, the path). If no earlier line in the body has named
 * that subject, the line is dangling and reads incoherent.
 *
 * Implementation: capture the head noun ("complaint" / "teams" / "answer"),
 * scan prior body lines for it (or its singular/plural). If absent, drop.
 */
const ORPHAN_ANAPHORA_PATTERNS = [
  // "Same X both times." / "Same X all around." / "Same X everywhere."
  /^Same\s+(\w+)\s+(?:both\s+(?:times|sides|ways|teams)|all\s+(?:times|around|over|the\s+way)|every\s+time|everywhere)[.!?]*$/i,
  // "Both X said the same thing." / "Both X agreed."
  /^Both\s+(\w+)\s+(?:said|agreed|did|saw|wanted|asked|paused|stalled|froze|laughed)[^.!?\n]*[.!?]*$/i,
  // "Either way, X."  — anaphoric "either way" wants two preceding options
  /^Either\s+way[,.!?]\s*([\w ]+)[.!?]*$/i,
]

/**
 * For an anaphoric line, look back up to 4 prior non-blank lines for any
 * mention of the head noun (with simple plural collapsing). Returns true
 * when an antecedent is present.
 */
function hasAntecedent(noun, priorLines) {
  if (!noun) return false
  const base = noun.toLowerCase().replace(/s$/, '')
  if (!base) return false
  const re = new RegExp(`\\b${base}s?\\b`, 'i')
  let scanned = 0
  for (let i = priorLines.length - 1; i >= 0 && scanned < 4; i--) {
    const line = priorLines[i]
    if (!line.trim()) continue
    scanned++
    if (re.test(line)) return true
  }
  return false
}

/**
 * Pass: drop AI-filler exclamations and orphan-anaphora lines from a body.
 *
 * Hook and CTA are NOT processed — short, punchy hooks are intentional;
 * orphan anaphora doesn't make sense in a 1-line hook anyway, and CTAs
 * sometimes use rhetorical brevity by design.
 */
export function dropFillerAndOrphanLines(text) {
  if (!text) return ''
  const lines = String(text).split('\n')
  const kept = []
  const keptText = [] // for antecedent lookups, mirrors `kept` line-by-line

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      kept.push(raw)
      keptText.push('')
      continue
    }

    if (AI_FILLER_LINES.some((re) => re.test(trimmed))) continue

    let isOrphan = false
    for (const pat of ORPHAN_ANAPHORA_PATTERNS) {
      const m = trimmed.match(pat)
      if (!m) continue
      if (!hasAntecedent(m[1], keptText)) {
        isOrphan = true
        break
      }
    }
    if (isOrphan) continue

    kept.push(raw)
    keptText.push(trimmed)
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Coherence heuristic. Returns a 0-100 score where lower = more fragmentary.
 * Used both as a scoring penalty and as a retry-trigger after stripping.
 *
 * Signals it counts:
 *  - "Substantive line ratio": fraction of non-blank body lines that have
 *    BOTH a verb-shape AND a noun-shape (i.e. read like a complete thought).
 *  - "Orphan anaphora count": lines that refer back to something unstated.
 *  - "Single-word exclamation count": "Wild.", "Brutal.", etc. that survived.
 *  - "Average words per substantive line" (very low = fragmentary).
 *
 * Cheap, deterministic; no LLM call.
 */
export function scoreBodyCoherence(body) {
  if (!body) return 100
  const lines = String(body)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return 100

  let substantive = 0
  let totalWords = 0
  let orphans = 0
  let fillers = 0
  const priorAcc = []

  // Heuristics:
  // - "verb-shape": presence of a common auxiliary, copula, or -ed/-ing verb
  // - "noun-shape": at least one word longer than 3 chars that isn't a stopword
  const VERB_LIKE = /\b(?:is|was|were|are|am|be|been|being|has|have|had|do|does|did|will|would|could|should|may|might|must|can|cannot|won|wo|got|gets|getting|move|moved|moves|moving|tell|told|tells|say|said|says|see|saw|sees|seeing|run|runs|running|ran|cut|cuts|cutting|build|built|building|ship|shipped|ships|shipping|kill|killed|kills|killing|switch|switched|switches|switching|deleted?|removed?|spent|spend|paid|pays|paying|made|makes|making|talk|talks|talking|talked|asked|asks|asking|wrote|writes|writing|sent|sends|sending|gave|gives|giving|set|sets|setting|put|puts|putting|came|come|comes|coming|went|goes|going|left|leaves|leaving|took|takes|taking|let|lets|letting|find|finds|finding|found|know|knows|knowing|knew|need|needs|needed|needing|use|uses|used|using|work|works|worked|working|seem|seems|seemed|seeming|look|looks|looking|looked|feel|feels|felt|feeling|read|reads|reading|hear|hears|hearing|heard)\b|\b\w+(?:ed|ing|s)\b/i
  const NOUN_LIKE = /\b[A-Za-z]{4,}\b/

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean)
    totalWords += words.length

    if (AI_FILLER_LINES.some((re) => re.test(line))) {
      fillers++
      continue
    }

    let isOrphan = false
    for (const pat of ORPHAN_ANAPHORA_PATTERNS) {
      const m = line.match(pat)
      if (m && !hasAntecedent(m[1], priorAcc)) { isOrphan = true; break }
    }
    if (isOrphan) {
      orphans++
      priorAcc.push(line)
      continue
    }

    if (VERB_LIKE.test(line) && NOUN_LIKE.test(line) && words.length >= 4) {
      substantive++
    }
    priorAcc.push(line)
  }

  const substantiveRatio = substantive / lines.length
  const avgWords = totalWords / lines.length
  const fillerRatio = fillers / lines.length
  const orphanRatio = orphans / lines.length

  let score = 100
  score -= (1 - substantiveRatio) * 50          // up to 50 off for fragmentation
  score -= Math.max(0, 7 - avgWords) * 4         // up to ~28 off for sub-7-word lines
  score -= fillerRatio * 50                      // big penalty if filler is dense
  score -= orphanRatio * 40                      // big penalty for unresolved anaphora
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** Lookup table for short + long month names → 0-indexed month. */
const MONTH_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

/**
 * Strip stale calendar-date references from generated copy.
 *
 * Even with tight upstream filters, models trained on older data sometimes
 * improvise a specific historical date ("the Apr 9 Hacker News post",
 * "back in March 22 article…"). To a reader who lives in AI, citing a
 * 6-week-old date in a "what's happening now" post is the killshot for
 * credibility.
 *
 * Strategy: find Month+Day phrases. If the date is older than `staleDays`
 * (computed from "now"), rewrite the phrase to a hedged "recently" / "this
 * week" replacement and drop any trailing "Hacker News post / HN thread /
 * article / piece / story" qualifier that would re-anchor it.
 *
 * Year assumption: we treat the date as the current year. If that puts the
 * date in the future, we assume the prior year (e.g. "Dec 28" generated on
 * Jan 5 → Dec 28 of last year).
 *
 * @param {string} text
 * @param {{ staleDays?: number, now?: Date }} [options]
 */
export function scrubStaleDateRefs(text, options = {}) {
  if (!text) return ''
  const staleDays = options.staleDays ?? 14
  const now = options.now instanceof Date ? options.now : new Date()
  const cutoff = now.getTime() - staleDays * 86_400_000

  const monthAlt = Object.keys(MONTH_INDEX).join('|')
  // Match "Apr 9", "Apr. 9", "April 9", "April 9th", optionally followed by
  // a year ("Apr 9, 2026") and an optional qualifier we want to drop with it
  // ("Hacker News post", "HN thread", "article", "piece", "story", "report").
  const dateRe = new RegExp(
    `\\b(?:on |back on |from |since |last |the )?(?:(${monthAlt})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?)(\\s+(?:(?:Hacker\\s+News|HN)\\s+(?:post|thread|story|article|piece|item)|article|piece|story|post|report|memo|note|piece))?`,
    'gi',
  )

  return text.replace(dateRe, (match, monthRaw, dayRaw, yearRaw, qualifier) => {
    const monthIdx = MONTH_INDEX[String(monthRaw).toLowerCase()]
    if (monthIdx == null) return match
    const day = parseInt(dayRaw, 10)
    if (!Number.isFinite(day) || day < 1 || day > 31) return match

    let year = yearRaw ? parseInt(yearRaw, 10) : now.getFullYear()
    let dateTs = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0)).getTime()
    // If we defaulted year and that puts the date in the future, roll back.
    if (!yearRaw && dateTs > now.getTime()) {
      year -= 1
      dateTs = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0)).getTime()
    }
    if (dateTs >= cutoff) return match // date is fresh enough — keep as-is

    // Stale: replace the whole phrase (date + optional qualifier) with a
    // hedge that doesn't anchor to a calendar day.
    const leading = match.match(/^(on |back on |from |since |last |the )/i)
    const prefix = leading ? '' : ''
    const replacement = qualifier
      ? 'recent reporting'
      : 'recently'
    return `${prefix}${replacement}`
  })
}

/**
 * If a sentence reads like an open declaration ("…stack the right tools.") in the CTA,
 * convert it to a peer-to-peer ICP question. Conservative — only triggers when there is
 * no '?' in the cta.
 */
function ensureIcpCtaQuestion(cta) {
  const raw = String(cta || '').trim()
  if (!raw) return 'What is the first thing you would change on your team this quarter?'
  if (/\?/.test(raw)) return raw
  if (/\b(you|your)\b/i.test(raw)) return `${raw.replace(/[.!]+$/, '')}?`
  return `${raw.replace(/[.!]+$/, '')} What would you try first on your team?`
}

/**
 * Strip external links from the post body — Move 2. A link in the post body
 * costs an estimated 18-60% reach (LinkedIn keeps users off-platform). We pull
 * the URL and tidy any dangling "(source: …)" wrapper or trailing punctuation,
 * so the claim survives but the off-platform link does not. (First-comment copy
 * is left untouched — that's where a link belongs if you must include one.)
 */
const EXTERNAL_URL_RE = /\s*\(?(?:https?:\/\/|www\.)[^\s)]+\)?/gi
export function stripExternalLinks(text) {
  if (!text) return ''
  let t = String(text)
  EXTERNAL_URL_RE.lastIndex = 0
  if (!EXTERNAL_URL_RE.test(t)) return t
  EXTERNAL_URL_RE.lastIndex = 0
  t = t.replace(EXTERNAL_URL_RE, '')
  t = t.replace(/\(\s*(?:source|link|read more|see)\s*:?\s*\)/gi, '')
  t = t.replace(/\(\s*\)/g, '')
  t = t.replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/[ \t]+([.,;:!?])/g, '$1')
  return t.trim()
}

/** Recapitalize the first letter of each sentence (used after a removal that
 * may have promoted a lowercase word to a sentence start). */
function recapitalizeSentences(text) {
  return String(text).replace(
    /(^|[.!?]\s+|\n[ \t]*)([a-z])/g,
    (_m, pre, ch) => pre + ch.toUpperCase(),
  )
}

/**
 * Cap hedge-stacking — Move 1 (anti-AI-detection). LinkedIn's 360Brew flags
 * heavy hedging as an AI tell. We strip pure-filler hedge openers ("Honestly,",
 * "To be fair,", "For what it's worth,") that add nothing, while leaving the
 * one or two genuine reflective hedges that make copy sound human. Conservative
 * by design: only removes throat-clearing, never load-bearing clauses.
 */
const FILLER_HEDGE_OPENERS = [
  /(^|\n)([ \t]*)Honestly,?\s+/gi,
  /(^|\n)([ \t]*)To be fair,?\s+/gi,
  /(^|\n)([ \t]*)If I'?m being honest,?\s+/gi,
  /(^|\n)([ \t]*)For what it'?s worth,?\s+/gi,
  /(^|\n)([ \t]*)Look,\s+/g,
  /(^|\n)([ \t]*)Listen,\s+/g,
  /\bI guess,?\s+/gi,
  /\bI suppose,?\s+/gi,
]
export function capHedgeStacking(text) {
  if (!text) return ''
  let t = String(text)
  let changed = false
  for (const re of FILLER_HEDGE_OPENERS) {
    re.lastIndex = 0
    if (re.test(t)) {
      changed = true
      re.lastIndex = 0
      t = t.replace(re, (_m, pre = '', ws = '') => `${pre}${ws}`)
    }
  }
  return changed ? recapitalizeSentences(t) : t
}

/**
 * Scrub the named AI cliché frame "It's not X, it's Y" (and "this isn't X,
 * it's Y" / "it's not about X, it's about Y"). LinkedIn explicitly called this
 * out as a ChatGPT tell. We collapse it to the assertive second clause.
 *
 * Guarded so it does NOT touch the encouraged reframe "the harder question
 * isn't X, it's Y" — that opens with a noun subject, not "it's/this is".
 */
const AI_CLICHE_FRAME_RE =
  /\b(it'?s|it is|this is|this isn'?t|that'?s)\s+(?:not|isn'?t)\s+(just\s+|only\s+|about\s+)?[^.?!,;]{2,48}[,;]\s*(it'?s about|it'?s|it is|they'?re|that'?s)\s+/gi
export function scrubAiClicheFrames(text) {
  if (!text) return ''
  let t = String(text)
  AI_CLICHE_FRAME_RE.lastIndex = 0
  if (!AI_CLICHE_FRAME_RE.test(t)) return t
  AI_CLICHE_FRAME_RE.lastIndex = 0
  t = t.replace(AI_CLICHE_FRAME_RE, (_m, _subj, about = '', second) =>
    about && about.trim() === 'about' ? `${second} ` : `${second} `,
  )
  return recapitalizeSentences(t)
}

/**
 * Critique the post the way a CIO/VP Eng/CFO/CISO would read it: terse, peer-to-peer,
 * no AI tells, no em-dashes, no emojis in body/hook/CTA.
 *
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function applyIcpCritique(post) {
  if (!post) return post
  const clean = (text, { stripLinks = true } = {}) => {
    const base = scrubStaleDateRefs(scrubMetaLabels(applyIcpSwaps(dropEmojis(text || ''))))
    const linked = stripLinks ? stripExternalLinks(base) : base
    return stripDashesFromCopy(scrubAiClicheFrames(capHedgeStacking(linked)))
  }
  const hook = clean(post.hook)
  // Body gets an extra coherence pass: drop AI-filler one-liners ("Wild.",
  // "Two things can be true at once.") and orphan anaphora ("Same complaint
  // both times" with no antecedent). Hook and CTA stay short by design and
  // are exempt from this pass.
  const body = dropFillerAndOrphanLines(clean(post.body))
  const cta = ensureIcpCtaQuestion(clean(post.cta))
  // First comment is where a link belongs if you must include one — keep it.
  const firstComment = clean(post.firstComment, { stripLinks: false })
  return { ...post, hook, body, cta, firstComment }
}

/**
 * Convert the 0-100 coherence score into a 0-30 reach penalty so a body
 * full of "Wild." / "Two things can be true at once." fragments takes a
 * real bite out of reach score, triggering the editor's anti-fragmentation
 * pass before final output.
 *
 * Scaling chosen so a body that scores 50 (clearly fragmented) loses ~15
 * points, and a body that scores 30 (badly broken) loses the full ~30.
 */
export function scoreCoherencePenalty(text) {
  if (!text) return 0
  const score = scoreBodyCoherence(text)
  if (score >= 80) return 0
  const missing = 80 - score
  return Math.min(30, Math.round(missing * 0.5))
}

/**
 * Penalty for dashes/emojis/ICP-banned phrases — used by reach scoring so the editor
 * pipeline actively pushes against these even before they're stripped.
 */
export function scoreIcpPenalty(text) {
  if (!text) return 0
  let p = 0
  p += (text.match(EM_DASH) || []).length * 3
  p += (text.match(EN_DASH) || []).length * 3
  p += (text.match(EMOJI_RE) || []).length * 2
  for (const re of ICP_PHRASE_STRIPS) {
    p += (text.match(re) || []).length * 4
  }
  return Math.min(24, p)
}
