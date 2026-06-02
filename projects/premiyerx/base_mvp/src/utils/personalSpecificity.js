/**
 * "Personal specificity" gate — every post must include at least one specific detail
 * only someone with direct experience would know: a number, a named role, a concrete
 * outcome, or a named mistake. Generic observations get penalized.
 *
 * This is a heuristic: it counts signals in the body+hook combined and returns a
 * penalty when none are found.
 */

const NUMBER_RE = /\b\d{1,3}(?:[.,]\d+)?(?:%|\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|quarters?|engineers?|reps?|seats?|pilots?|customers?|deals?|reviews?|PRs?|repos?|incidents?|deploys?|releases?|checks?|standups?))?\b/i

const NAMED_ROLE_RE =
  /\b(VP\s+(?:of\s+)?(?:Engineering|Eng|Product|Sales)|VPE|CIO|CISO|CTO|CDO|CEO|CFO|VPM|VP|Director|Head\s+of|Founder|Engineering\s+Director|VP\s+Eng)\b/

const SCENE_VERBS_RE =
  /\b(?:told me|texted me|DM(?:'?d)?\s*me|emailed me|asked me|pinged me|cornered me|stopped me|walked (?:into|me through)|sat across|called me|messaged me|put it (?:bluntly|to me)|said (?:it|that to me)|shared (?:the|a) (?:post-?mortem|note|memo|finding)|on a (?:call|Friday|recent (?:call|conversation)))\b/i

const TIME_ANCHOR_RE =
  /\b(?:last (?:Tuesday|Wednesday|Thursday|Friday|Monday|week|month|quarter|night|sprint|standup|board|QBR|review)|this (?:morning|afternoon|week|sprint|quarter)|on (?:Monday|Tuesday|Wednesday|Thursday|Friday)|yesterday|two weeks ago|a week ago)\b/i

const NAMED_MISTAKE_RE =
  /\b(?:I (?:was )?wrong|I missed|I (?:misread|underestimated|over[- ]?indexed|chased|skipped)|got it wrong|the mistake (?:I|we) made|I should have|we shipped (?:too|the wrong))\b/i

const OUTCOME_RE =
  /\b(?:closed|shipped|cut|killed|landed|cancelled|paused|expanded|renewed|expanded\s+to|rolled\s+out\s+to|pulled\s+from|saved\s+\$?\d|added\s+\d|dropped\s+by\s+\d)\b/i

/**
 * Count signals of "lived-in" detail in the post.
 * @returns {{ score: number, hits: string[] }}
 */
export function detectPersonalSpecificity(text) {
  const t = String(text || '')
  const hits = []
  let score = 0

  if (NUMBER_RE.test(t)) {
    hits.push('number')
    score += 2
  }
  if (NAMED_ROLE_RE.test(t)) {
    hits.push('named-role')
    score += 1
  }
  if (SCENE_VERBS_RE.test(t)) {
    hits.push('scene-verb')
    score += 2
  }
  if (TIME_ANCHOR_RE.test(t)) {
    hits.push('time-anchor')
    score += 1
  }
  if (NAMED_MISTAKE_RE.test(t)) {
    hits.push('named-mistake')
    score += 2
  }
  if (OUTCOME_RE.test(t)) {
    hits.push('outcome')
    score += 1
  }

  return { score, hits }
}

/**
 * @returns {number} 0–24 penalty points. 0 means at least two distinct specificity
 * signals were detected; higher means generic / abstract / no lived-in detail.
 */
export function scorePersonalSpecificityPenalty(text) {
  const { hits } = detectPersonalSpecificity(text || '')
  const distinctHits = new Set(hits).size
  if (distinctHits >= 2) return 0
  if (distinctHits === 1) return 12
  return 24
}

/**
 * Surface-level summary used by ranking UI / inline warnings.
 */
export function specificityIssuesSummary(post) {
  const text = [post?.hook, post?.body].filter(Boolean).join('\n')
  const { hits } = detectPersonalSpecificity(text)
  const distinct = new Set(hits)
  const issues = []
  if (distinct.size === 0) {
    issues.push('no concrete number, named role, scene, time anchor, mistake, or outcome — reads generic')
  } else if (distinct.size === 1) {
    issues.push(`only ${[...distinct][0]} as specificity signal — add one more (number, role, scene, mistake, or outcome)`)
  }
  return issues
}
