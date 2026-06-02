import { scorePost } from '../data/algorithmRules.js'
import { scoreAiTellPenalty, scoreLengthPenalty } from './humanizeLinkedInCopy.js'
import { scoreIncompleteListPenalty } from './postListIntegrity.js'
import { scoreGrammarPenalty } from './postGrammarQuality.js'
import { scorePersonalSpecificityPenalty } from './personalSpecificity.js'
import { scoreSentenceRhythm } from './sentenceRhythm.js'
import { scoreConclusionPenalty } from './postRoughEdit.js'
import { scoreFactualPenalty } from './factualClaims.js'
import { scoreReasoningLeakagePenalty } from './modelReasoningLeakage.js'
import { scoreHookPenalty } from './hookLab.js'
import { scoreTacticStackPenalty } from './viralTactics.js'
import { scoreIcpPenalty, scoreCoherencePenalty } from './icpCritique.js'

/** Gold "Best for reach" bar — net reach strictly above 80 (minimum 81). */
export const REACH_PUBLISH_MIN = 81

/** Full post text for algorithm scoring (no citation footer). */
export function postSectionsToLiveText(post) {
  if (!post) return ''
  return [post.hook, post.body, post.cta, post.hashtags].filter(Boolean).join('\n\n').trim()
}

/** Letter grade from a 0–100-style score (algorithm base). */
export function scoreToGrade(score) {
  if (score >= 92) return 'A'
  if (score >= 80) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

/** Letter grade from penalty points (0 = best). */
export function penaltyToGrade(points, maxPoints = 48) {
  if (points <= 0) return 'A'
  if (points <= maxPoints * 0.15) return 'B'
  if (points <= maxPoints * 0.35) return 'C'
  if (points <= maxPoints * 0.6) return 'D'
  return 'F'
}

export const REACH_PENALTY_SPECS = [
  {
    id: 'aiTell',
    label: 'AI tells',
    maxPoints: 48,
    description: 'Arrow bullets, banned vocab, em-dash spam, bold spam, and over-long numbered lists.',
    score: scoreAiTellPenalty,
  },
  {
    id: 'length',
    label: 'Length',
    maxPoints: 38,
    description: 'Posts over the ideal character band lose reach — short, scannable copy wins.',
    score: scoreLengthPenalty,
  },
  {
    id: 'listIntegrity',
    label: 'List integrity',
    maxPoints: 56,
    description: 'Promised N items in the hook but fewer numbered lines delivered.',
    score: scoreIncompleteListPenalty,
  },
  {
    id: 'grammar',
    label: 'Grammar & clarity',
    maxPoints: 40,
    description: 'Broken phrasing, truncated lines, bare quarters, and vague one-line list beats.',
    score: scoreGrammarPenalty,
  },
  {
    id: 'factual',
    label: 'Factual accuracy',
    maxPoints: 36,
    description: 'Impossible Fortune 500 counts, bad headline grammar, or unverified invented stats.',
    score: scoreFactualPenalty,
  },
  {
    id: 'reasoningLeak',
    label: 'Draft purity',
    maxPoints: 48,
    description: 'Chain-of-thought, word counts, or rubric notes leaked into reader-facing copy.',
    score: scoreReasoningLeakagePenalty,
  },
  {
    id: 'hookStrength',
    label: 'Hook strength',
    maxPoints: 20,
    description: 'Opening archetype + lift: rewards stat/story/contrarian hooks with tension; penalizes dead imperative openers.',
    score: scoreHookPenalty,
  },
  {
    id: 'tacticStack',
    label: 'Tactic stack',
    maxPoints: 18,
    description: 'Viral posts stack 4–6 tactics (quantified proof, open loop, quote, pattern interrupt, social proof).',
    score: scoreTacticStackPenalty,
  },
  {
    id: 'icpVoice',
    label: 'ICP voice',
    maxPoints: 24,
    description: 'Em-dashes, emojis, and AI phrasings the target ICP (CIO/VP Eng/CFO/CISO/VP DevOps) instantly reads as AI.',
    score: scoreIcpPenalty,
  },
  {
    id: 'specificity',
    label: 'Personal specificity',
    maxPoints: 24,
    description: 'Needs lived-in detail: numbers, roles, scenes, time anchors, or named outcomes.',
    score: scorePersonalSpecificityPenalty,
  },
  {
    id: 'rhythm',
    label: 'Sentence rhythm',
    maxPoints: 12,
    description: 'Penalizes three same-length sentences in a row or flat, uniform pacing.',
    score: scoreSentenceRhythm,
  },
  {
    id: 'conclusion',
    label: 'Conclusion tone',
    maxPoints: 24,
    description: 'Lesson/moral wrap-ups (“the takeaway is…”) that read like AI memos.',
    score: scoreConclusionPenalty,
  },
  {
    id: 'coherence',
    label: 'Body coherence',
    maxPoints: 30,
    description: 'Penalizes "Wild." / "Two things can be true at once." filler and orphan "Same X both times" anaphora — the fragmentary one-liner tic that reads as nonsense to a CIO.',
    score: scoreCoherencePenalty,
  },
]

function buildPenalties(text) {
  return REACH_PENALTY_SPECS.map((spec) => {
    const points = spec.score(text)
    return {
      id: spec.id,
      label: spec.label,
      points,
      maxPoints: spec.maxPoints,
      description: spec.description,
      grade: penaltyToGrade(points, spec.maxPoints),
    }
  })
}

/**
 * Full reach breakdown for one post — used by workbench popover and ranking.
 * reachScore = algorithmScore − sum(penalties), clamped at 0.
 */
export function breakdownReachScore(post) {
  const text = postSectionsToLiveText(post)
  const { total, rawRounded, premierAdjusted, details } = scorePost(text)
  const penalties = buildPenalties(text)
  const penaltySum = penalties.reduce((sum, p) => sum + p.points, 0)
  const reachScore = Math.max(0, total - penaltySum)

  return {
    algorithmScore: total,
    algorithmRawWeighted: rawRounded ?? total,
    algorithmPremierBand: premierAdjusted ?? total,
    algorithmGrade: scoreToGrade(total),
    algorithmRules: details.map((rule) => ({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      score: rule.score,
      weighted: Math.round(rule.weighted),
      grade: scoreToGrade(rule.score),
    })),
    penalties,
    penaltySum,
    reachScore,
    reachGrade: scoreToGrade(reachScore),
  }
}

function scoreVariantForReach(post) {
  const breakdown = breakdownReachScore(post)
  return {
    algorithmScore: breakdown.algorithmScore,
    reachScore: breakdown.reachScore,
    reachBreakdown: breakdown,
    aiPenalty: breakdown.penalties.find((p) => p.id === 'aiTell')?.points ?? 0,
  }
}

/**
 * Rank successful variants and attach recommendation metadata for the workbench UI.
 * Winner = highest reachScore for this run; ties break on higher algorithmScore.
 * @param {Array<{ id: string, post?: object, error?: string | null, label?: string }>} variants
 */
export function annotateVariantsWithRecommendation(variants) {
  const scores = []
  for (const v of variants) {
    if (!v.post || v.error) continue
    const s = scoreVariantForReach(v.post)
    const reachClearedBar =
      v.reachClearedBar !== undefined
        ? Boolean(v.reachClearedBar)
        : s.reachScore >= REACH_PUBLISH_MIN
    scores.push({ id: v.id, ...s, reachClearedBar })
  }
  scores.sort((a, b) => b.reachScore - a.reachScore || b.algorithmScore - a.algorithmScore)

  const cleared = scores.filter((s) => s.reachClearedBar)
  const top = cleared.length > 0 ? cleared[0] : scores[0]

  const annotated = variants.map((v) => {
    const row = scores.find((s) => s.id === v.id)
    const clearedBar = row?.reachClearedBar ?? false
    return {
      ...v,
      algorithmScore: row?.algorithmScore ?? v.algorithmScore ?? null,
      reachScore: row?.reachScore ?? v.reachScore ?? null,
      reachBreakdown: row?.reachBreakdown ?? v.reachBreakdown ?? null,
      reachClearedBar: row ? clearedBar : v.reachClearedBar,
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
          reachClearedBar: top.reachClearedBar,
        }
      : null,
  }
}
