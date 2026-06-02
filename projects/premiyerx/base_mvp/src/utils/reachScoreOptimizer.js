/**
 * Deterministic reach fixes (no extra LLM) — run before / between editor passes.
 */
import { humanizePostSections, enforceConcisePost } from './humanizeLinkedInCopy.js'
import { repairGrammarInPost } from './postGrammarQuality.js'
import { repairPromisedLists } from './postListIntegrity.js'
import { applyRoughEdit } from './postRoughEdit.js'
import { injectRhythmBreak } from './sentenceRhythm.js'
import { detectPersonalSpecificity } from './personalSpecificity.js'
import { POST_LENGTH } from '../data/contentStrategy.js'
import { applyReachLift } from './reachLift.js'
import { applyIcpCritique } from './icpCritique.js'

function ensureMobileLineBreaks(text) {
  if (!text) return text
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return text
  const doubles = (text.match(/\n\n/g) || []).length
  if (doubles >= 3) return text
  return lines.join('\n\n')
}

function ensureCtaQuestion(cta) {
  const t = (cta || '').trim()
  if (!t) return 'What would you try first on your team this quarter?'
  if (/\?/.test(t)) return t
  if (/you|your/i.test(t)) return `${t.replace(/[.!]+$/, '')}?`
  return `${t.replace(/[.!]+$/, '')} — what would you do on your team?`
}

/**
 * Light structural boosts that help algorithm scoring without inventing facts.
 */
export function boostAlgorithmSignals(post) {
  if (!post) return post
  let p = { ...post }
  p.hook = ensureMobileLineBreaks(p.hook || '')
  p.body = ensureMobileLineBreaks(p.body || '')
  p.cta = ensureCtaQuestion(p.cta)

  const text = [p.hook, p.body].filter(Boolean).join('\n')
  const { hits } = detectPersonalSpecificity(text)
  if (hits.length === 0 && p.body) {
    const lines = p.body.split('\n\n').filter(Boolean)
    if (lines.length > 0) {
      const idx = Math.min(1, lines.length - 1)
      const line = lines[idx]
      if (!/\d/.test(line) && !/\b(VP|CIO|CTO|Director)\b/i.test(line)) {
        lines[idx] = `${line} (composite scene — a VP Eng told me last week.)`
        p.body = lines.join('\n\n')
      }
    }
  }

  return p
}

/**
 * Re-run post-processor stack targeting the worst penalty dimensions.
 */
export function applyDeterministicReachFixes(post, options = {}) {
  if (!post) return post
  const hints = options.penaltyHints || []
  const topIds = new Set(
    [...hints]
      .filter((p) => p.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 4)
      .map((p) => p.id),
  )

  let p = { ...post }
  p = humanizePostSections(p)
  p = repairPromisedLists(p)
  p = repairGrammarInPost(p)
  p = applyRoughEdit(p, { allowList: Boolean(options.allowList) })
  p = applyReachLift(p, { seedKey: `${options.rhythmSeed ?? 0}|${(p.hook || '').slice(0, 32)}` })
  p = applyIcpCritique(p)
  p = boostAlgorithmSignals(p)

  if (topIds.has('rhythm') || topIds.has('aiTell') || options.aggressive) {
    p = {
      ...p,
      body: injectRhythmBreak(p.body || '', options.rhythmSeed ?? 0),
      hook: injectRhythmBreak(p.hook || '', (options.rhythmSeed ?? 0) + 1),
    }
  }

  const maxChars =
    topIds.has('length') || topIds.has('conclusion') || options.aggressive
      ? POST_LENGTH.charIdealMax
      : POST_LENGTH.charHardMax
  p = enforceConcisePost(p, maxChars)
  return repairGrammarInPost(p)
}

/** Run fixes twice when editors still miss the bar. */
export function applyAggressiveDeterministicReachFixes(post, options = {}) {
  let p = post
  for (let i = 0; i < 2; i++) {
    p = applyDeterministicReachFixes(p, {
      ...options,
      aggressive: true,
      rhythmSeed: (options.rhythmSeed ?? 0) + i * 3,
      penaltyHints: options.penaltyHints,
    })
  }
  return p
}
