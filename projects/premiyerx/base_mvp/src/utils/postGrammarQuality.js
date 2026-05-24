/**
 * Grammar, clarity, and "solid English" checks for LinkedIn drafts (all models).
 */

const LINE_FIXES = [
  [/\bwent back terminal\b/gi, 'went back to the terminal'],
  [/\bwent back command[- ]?line\b/gi, 'went back to the command line'],
  [/\bwent back cli\b/gi, 'went back to the CLI'],
  [/\bdevs went back terminal\b/gi, 'devs went back to the terminal'],
  [/\bback terminal\b/gi, 'back to the terminal'],
  [/\bback to terminal\b/gi, 'back to the terminal'],
  [/\breturned terminal\b/gi, 'returned to the terminal'],
]

const WEAK_BEAT_RE =
  /^(the\s+)?(demo|pilot|rollout|tool|agent|model|workflow|context|review)\s+(passes|works|wins|fails|stalls)\.?$/i

const BARE_QUARTER_RE = /\bQ([1-4])\b(?!['s]?\s*(?:\(|quarter|QTR|fiscal|calendar|FY))/i

function applyLineFixes(line) {
  let t = line
  for (const [re, rep] of LINE_FIXES) {
    t = t.replace(re, rep)
  }
  return t
}

function clarifyBareQuarterInHook(hook) {
  if (!hook) return hook
  const firstLine = hook.split('\n')[0] || hook
  if (!BARE_QUARTER_RE.test(firstLine)) return hook
  if (/\bquarter\b/i.test(firstLine)) return hook
  const fixedFirst = firstLine.replace(
    /\bQ([1-4])\b/gi,
    (_, n) => {
      const labels = ['', 'first', 'second', 'third', 'fourth']
      return `Q${n} (${labels[Number(n)]} quarter)`
    },
  )
  return hook.replace(firstLine, fixedFirst)
}

const WEAK_BEAT_EXPANSIONS = {
  'the demo passes': 'The demo passes — the rollout stalls',
  'the pilot passes': 'The pilot passes — production stalls',
  'the rollout stalls': 'The rollout stalls after the demo',
  'the tool works': 'The tool works in a tab — not across the repo',
  'the agent wins': 'The agent wins the demo — not the audit',
  'the model is strong': 'The model is strong — the workflow is thin',
  'the workflow is thin': 'The workflow is thin — no path from issue to PR',
}

function strengthenWeakBeat(line) {
  const t = line.trim().replace(/\.$/, '')
  const key = t.toLowerCase()
  if (WEAK_BEAT_EXPANSIONS[key]) return WEAK_BEAT_EXPANSIONS[key]
  if (WEAK_BEAT_RE.test(`${t}.`) && t.split(/\s+/).length <= 4) {
    return `${t.charAt(0).toUpperCase() + t.slice(1)} — say what breaks next`
  }
  return line
}

function fixSection(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => {
      let t = applyLineFixes(line)
      if (/^\d+\.\s/.test(t.trim())) {
        const num = t.match(/^(\d+\.\s*)/)?.[1] || ''
        const rest = t.replace(/^\d+\.\s*/, '').trim()
        const improved = strengthenWeakBeat(rest)
        if (improved !== rest) t = `${num}${improved}`
      } else {
        t = strengthenWeakBeat(t)
      }
      return t
    })
    .join('\n')
}

/**
 * Auto-fix common model grammar slips before the draft is shown or copied.
 */
export function repairGrammarInPost(post) {
  if (!post) return post
  let hook = fixSection(post.hook || '')
  hook = clarifyBareQuarterInHook(hook)
  return {
    ...post,
    hook,
    body: fixSection(post.body || ''),
    cta: fixSection(post.cta || ''),
    hashtags: post.hashtags || '',
    firstComment: fixSection(post.firstComment || ''),
  }
}

/** @returns {number} penalty points for reach ranking */
export function scoreGrammarPenalty(text) {
  if (!text) return 0
  let penalty = 0
  const hookLine = (text.split('\n').find((l) => l.trim()) || '').trim()

  if (/\bwent back terminal\b/i.test(text) || /\bback terminal\b/i.test(text)) penalty += 18
  if (BARE_QUARTER_RE.test(hookLine) && !/\bquarter\b/i.test(hookLine)) penalty += 12
  if (/\bQ2 has\b/i.test(hookLine) && !/\bquarter\b/i.test(hookLine)) penalty += 8

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const bare = line.replace(/^\d+\.\s*/, '')
    if (WEAK_BEAT_RE.test(bare)) penalty += 10
    if (/^\d+\.\s/.test(line) && bare.split(/\s+/).length <= 4 && !/\b(and|but|because|when|where|that|which)\b/i.test(bare)) {
      penalty += 4
    }
  }

  return Math.min(32, penalty)
}

export function grammarIssuesSummary(post) {
  const text = [post?.hook, post?.body, post?.cta].filter(Boolean).join('\n')
  const issues = []
  if (/\bwent back terminal\b/i.test(text)) issues.push('missing “to the” before terminal')
  const hook = (post?.hook || '').split('\n')[0] || ''
  if (BARE_QUARTER_RE.test(hook) && !/\bquarter\b/i.test(hook)) issues.push('Q1–Q4 needs “quarter” spelled out once')
  if ((post?.body || '').split('\n').some((l) => WEAK_BEAT_RE.test(l.replace(/^\d+\.\s*/, '').trim()))) {
    issues.push('vague list beats (e.g. “The demo passes”)')
  }
  return issues
}
