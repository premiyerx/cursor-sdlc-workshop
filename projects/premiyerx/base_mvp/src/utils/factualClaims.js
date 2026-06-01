/**
 * Factual + grammar guardrails for posts, infographics, and carousels.
 * Prevents impossible claims (e.g. "500+ Fortune 500") and common headline grammar slips.
 */

import { extractClaimsFromText } from './dataRegistry.js'

/** Canonical on-visual labels for registry rows (value + context must be logically consistent). */
const REGISTRY_DISPLAY = {
  cursor_fortune500: {
    value: '50%+',
    context: 'of Fortune 500 companies use Cursor',
    sourceNote: 'Majority of the F500 list — never "500+" customers',
  },
  cursor_businesses: {
    value: '50,000+',
    context: 'businesses on Cursor',
  },
  cursor_arr: {
    value: '$2B+',
    context: 'annualized revenue (reported 2026)',
  },
  cursor_users: {
    value: '1M+',
    context: 'daily active users',
  },
  ai_tools_adoption: {
    value: '73%',
    context: 'of Fortune 500 run AI dev tool pilots',
  },
}

const HEADLINE_GRAMMAR_FIXES = [
  [/\bBack to Terminal\b/g, 'Back to the Terminal'],
  [/\bback to terminal\b/g, 'back to the terminal'],
  [/\bwent back terminal\b/gi, 'went back to the terminal'],
  [/\b(returned|shifted|moved)\s+terminal\b/gi, '$1 to the terminal'],
  [/\bto Terminal Over\b/gi, 'to the Terminal Over'],
  [/\bOver Narrow\b/g, 'Over Narrow'], // keep — "Over Narrow Copilots" is OK as headline chunk
]

const IMPOSSIBLE_F500_RE =
  /\b(\d{3,})\+?\s*(?:of\s+)?Fortune\s*500\b|\bFortune\s*500\s*(?:companies|customers|accounts)?\s*[:\-]?\s*(\d{3,})\+?/gi

const WEAK_FRAGMENT_RE =
  /^(the\s+)?(demo|pilot|rollout|tool|agent|model|workflow)\s+(passes|works|wins|stalls)\.?$/i

/**
 * @param {string} text
 * @returns {string[]}
 */
export function detectFactualIssues(text) {
  const issues = []
  const t = String(text || '')
  if (!t) return issues

  let m
  IMPOSSIBLE_F500_RE.lastIndex = 0
  while ((m = IMPOSSIBLE_F500_RE.exec(t)) !== null) {
    const n = parseInt(m[1] || m[2] || '0', 10)
    if (n >= 500) {
      issues.push(`Impossible: ${n}+ Fortune 500 (the list has only 500 companies)`)
    }
  }
  if (/\b500\+\s*Fortune\s*500/i.test(t)) {
    issues.push('Impossible: "500+ Fortune 500" — use "50%+" or "majority of Fortune 500"')
  }
  if (/\bQ([1-4])\b/i.test(t.split('\n')[0] || '') && !/\bquarter\b/i.test(t.split('\n')[0] || '')) {
    issues.push('Ambiguous: spell out "Q2" as "Q2 (second quarter)" in the hook if used')
  }
  if (/\bback terminal\b/i.test(t) && !/\bto the terminal\b/i.test(t)) {
    issues.push('Grammar: use "back to the terminal" not "back terminal"')
  }

  for (const line of t.split('\n')) {
    const bare = line.replace(/^\d+\.\s*/, '').trim()
    if (WEAK_FRAGMENT_RE.test(bare)) {
      issues.push(`Vague line: "${bare}" — add context (e.g. where it passes or stalls)`)
    }
  }

  return issues
}

export function sanitizeHeadlineGrammar(title) {
  let t = String(title || '').trim()
  if (!t) return t
  for (const [re, rep] of HEADLINE_GRAMMAR_FIXES) {
    t = t.replace(re, rep)
  }
  t = t.replace(/\bDraws Developers Back to the Terminal Over\b/i, 'Draws Developers Back to the Terminal Over')
  return t.replace(/\s+/g, ' ').trim()
}

function fixImpossibleFortune500Phrase(text) {
  let t = String(text || '')
  t = t.replace(/\b500\+\s*Fortune\s*500\s*(companies|customers|accounts)?/gi, 'majority of Fortune 500 companies')
  t = t.replace(/\b(\d{3,})\+?\s*(?:of\s+)?Fortune\s*500\s*(companies|customers|accounts)?/gi, (full, n) => {
    const num = parseInt(n, 10)
    if (num >= 500) return 'majority of Fortune 500 companies'
    return full
  })
  return t
}

function strengthenWeakFragment(line) {
  const t = line.trim()
  if (!WEAK_FRAGMENT_RE.test(t)) return line
  const m = t.match(WEAK_FRAGMENT_RE)
  const subject = (m[1] || m[2] || 'The demo').trim()
  const verb = (m[3] || 'passes').toLowerCase()
  if (verb === 'passes') {
    return `${subject.charAt(0).toUpperCase() + subject.slice(1)} passes in the demo — then stalls in production`
  }
  return line
}

/**
 * @param {{ value?: string, context?: string, source?: string, registryId?: string }} stat
 */
export function formatStatForDisplay(stat) {
  if (!stat) return { value: '—', context: '', source: '' }

  if (stat.registryId && REGISTRY_DISPLAY[stat.registryId]) {
    const d = REGISTRY_DISPLAY[stat.registryId]
    return {
      value: d.value,
      context: d.context,
      source: stat.source || '',
      registryId: stat.registryId,
    }
  }

  let value = String(stat.value || '').trim()
  let context = String(stat.context || '').trim()
  const combined = `${value} ${context}`

  if (IMPOSSIBLE_F500_RE.test(combined) || /\b500\+\s*Fortune\s*500/i.test(combined)) {
    return {
      value: '50%+',
      context: 'of Fortune 500 companies',
      source: stat.source || 'Cursor, 2026',
      registryId: stat.registryId || 'cursor_fortune500',
    }
  }

  return { value, context, source: stat.source || '', registryId: stat.registryId }
}

/**
 * Line for DALL·E / GPT image prompts — numbers must be copied exactly.
 */
export function formatStatForPrompt(stat, index = 0) {
  const d = formatStatForDisplay(stat)
  return `${index + 1}. RENDER EXACTLY — Figure: "${d.value}" Label: "${d.context}" (source: ${d.source || 'verified'}). Do NOT change the figure or imply more than 500 Fortune 500 companies.`
}

export function sanitizeCopyText(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => {
      let t = fixImpossibleFortune500Phrase(line)
      for (const [re, rep] of HEADLINE_GRAMMAR_FIXES) {
        t = t.replace(re, rep)
      }
      t = strengthenWeakFragment(t)
      return t
    })
    .join('\n')
}

/**
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 */
export function repairFactualInPost(post) {
  if (!post) return post
  return {
    ...post,
    hook: sanitizeHeadlineGrammar(sanitizeCopyText(post.hook || '')),
    body: sanitizeCopyText(post.body || ''),
    cta: sanitizeCopyText(post.cta || ''),
    hashtags: post.hashtags || '',
    firstComment: sanitizeCopyText(post.firstComment || ''),
  }
}

/**
 * Only registry-backed stats with fresh sources; each stat normalized for display.
 */
export function normalizeVerifiedStats(stats = []) {
  return (stats || [])
    .map((s) => formatStatForDisplay(s))
    .filter((s) => s.value && s.value !== '—')
}

/**
 * Drop unverified numeric claims from carousel bullets when possible.
 */
export function sanitizeCarouselBulletText(text) {
  const t = sanitizeCopyText(text)
  const claims = extractClaimsFromText(t)
  const hasUnknown = claims.some((c) => c.status === 'unknown' && /\d/.test(c.text))
  if (!hasUnknown) return t
  const unknownNums = claims.filter((c) => c.status === 'unknown')
  let out = t
  for (const c of unknownNums) {
    out = out.replace(c.text, '').replace(/\s{2,}/g, ' ')
  }
  return out.trim() || t
}

export function scoreFactualPenalty(text) {
  return detectFactualIssues(text).length * 12
}
