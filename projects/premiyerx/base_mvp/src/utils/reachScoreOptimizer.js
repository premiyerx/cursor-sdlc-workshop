/**
 * Deterministic reach fixes (no extra LLM) — run before / between editor passes.
 */
import { humanizePostSections, enforceConcisePost } from './humanizeLinkedInCopy.js'
import { repairGrammarInPost } from './postGrammarQuality.js'
import { repairPromisedLists } from './postListIntegrity.js'
import { applyRoughEdit } from './postRoughEdit.js'
import { injectRhythmBreak } from './sentenceRhythm.js'
import { POST_LENGTH } from '../data/contentStrategy.js'

/**
 * Re-run post-processor stack targeting the worst penalty dimensions.
 * @param {object} post
 * @param {{ allowList?: boolean, rhythmSeed?: number, penaltyHints?: Array<{ id: string, points: number }> }} options
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

  const allowList = Boolean(options.allowList)
  p = applyRoughEdit(p, { allowList })

  if (topIds.has('rhythm') || topIds.has('aiTell')) {
    p = {
      ...p,
      body: injectRhythmBreak(p.body || '', options.rhythmSeed ?? 0),
      hook: injectRhythmBreak(p.hook || '', (options.rhythmSeed ?? 0) + 1),
    }
  }

  if (topIds.has('length') || topIds.has('conclusion')) {
    p = enforceConcisePost(p, POST_LENGTH.charIdealMax)
  } else {
    p = enforceConcisePost(p, POST_LENGTH.charHardMax)
  }

  return repairGrammarInPost(p)
}
