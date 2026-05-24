import { scorePost } from '../data/algorithmRules.js'
import { scoreAiTellPenalty, scoreLengthPenalty } from './humanizeLinkedInCopy.js'
import { scoreIncompleteListPenalty } from './postListIntegrity.js'
import { scoreGrammarPenalty } from './postGrammarQuality.js'

/** Full post text for algorithm scoring (no citation footer). */
export function postSectionsToLiveText(post) {
  if (!post) return ''
  return [post.hook, post.body, post.cta, post.hashtags].filter(Boolean).join('\n\n').trim()
}

function scoreVariantForReach(post) {
  const text = postSectionsToLiveText(post)
  const { total } = scorePost(text)
  const aiPenalty = scoreAiTellPenalty(text)
  const lengthPenalty = scoreLengthPenalty(text)
  const listPenalty = scoreIncompleteListPenalty(text)
  const reachScore = Math.max(0, total - aiPenalty - lengthPenalty - listPenalty)
  return { algorithmScore: total, reachScore, aiPenalty }
}

/**
 * Rank successful variants and attach recommendation metadata for the workbench UI.
 * @param {Array<{ id: string, post?: object, error?: string | null, label?: string }>} variants
 */
export function annotateVariantsWithRecommendation(variants) {
  const scores = []
  for (const v of variants) {
    if (!v.post || v.error) continue
    const s = scoreVariantForReach(v.post)
    scores.push({ id: v.id, ...s })
  }
  scores.sort((a, b) => b.reachScore - a.reachScore || b.algorithmScore - a.algorithmScore)
  const top = scores[0]

  const annotated = variants.map((v) => {
    const row = scores.find((s) => s.id === v.id)
    return {
      ...v,
      algorithmScore: row?.algorithmScore ?? null,
      reachScore: row?.reachScore ?? null,
      isRecommended: Boolean(top && v.id === top.id && v.post && !v.error),
    }
  })

  const winner = top ? variants.find((v) => v.id === top.id) : null
  return {
    variants: annotated,
    recommendation: top
      ? {
          variantId: top.id,
          label: winner?.label || '',
          algorithmScore: top.algorithmScore,
          reachScore: top.reachScore,
        }
      : null,
  }
}
