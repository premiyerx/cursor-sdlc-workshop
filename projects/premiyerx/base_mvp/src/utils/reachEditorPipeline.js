/**
 * Editors 2 & 3 (plus optional boost) revise drafts toward the reach bar.
 * Drafts are always returned for copy — the bar gates the gold "Best for reach" badge only.
 */
import { generateRawCompletion } from './llmPostClient.js'
import {
  breakdownReachScore,
  postSectionsToLiveText,
  REACH_PUBLISH_MIN,
} from './draftRecommendation.js'
import {
  applyDeterministicReachFixes,
  applyAggressiveDeterministicReachFixes,
} from './reachScoreOptimizer.js'
import { POST_LENGTH } from '../data/contentStrategy.js'

export { REACH_PUBLISH_MIN }

/** Target shown to editors (over 80). */
export const REACH_TARGET_HINT = 85

const MAX_LLM_EDITOR_PASSES = 2

function formatPostForPrompt(post) {
  return `HOOK:
${post.hook || ''}

BODY:
${post.body || ''}

CTA:
${post.cta || ''}

HASHTAGS:
${post.hashtags || ''}

FIRST_COMMENT:
${post.firstComment || ''}`
}

function formatBreakdownBrief(breakdown) {
  if (!breakdown) return ''
  const penaltyLines = (breakdown.penalties || [])
    .filter((p) => p.points > 0)
    .map((p) => `  • ${p.label}: −${p.points} pts (${p.grade}) — ${p.description}`)
    .join('\n')
  const weakRules = [...(breakdown.algorithmRules || [])]
    .sort((a, b) => a.score - b.score)
    .slice(0, 4)
    .map((r) => `  • ${r.label}: ${r.score}/100 (${r.grade})`)
    .join('\n')

  return `
CURRENT NET REACH SCORE: ${breakdown.reachScore} (target > ${REACH_PUBLISH_MIN - 1} — aim for ${REACH_TARGET_HINT}+)
Algorithm base: ${breakdown.algorithmScore} − penalties ${breakdown.penaltySum} = ${breakdown.reachScore}

PENALTIES TO FIX FIRST:
${penaltyLines || '  • (none — push algorithm: hook, dwell, scannability, comment CTA)'}

WEAKEST ALGORITHM PILLARS:
${weakRules || '  • (n/a)'}

SCORING CHEAT SHEET (what moves the needle):
- Hook: 8–12 words, include a number, parenthetical re-hook on line 2.
- Body: ${POST_LENGTH.minDoubleLineBreaks}+ blank-line breaks; mix one-word lines with longer lines.
- CTA: one "you/your" question (not "thoughts?").
- Specificity: one number + one named role or scene.
- Length: stay ${POST_LENGTH.charIdealMax}–${POST_LENGTH.charSoftMax} chars total.
`.trim()
}

function buildEditorUserPrompt(post, breakdown, editorIndex) {
  const passLabel =
    editorIndex === 1 ? 'Editor 2' : editorIndex === 2 ? 'Editor 3' : 'Reach boost editor'
  return `${passLabel} — revise this LinkedIn draft so NET reach score is above ${REACH_PUBLISH_MIN - 1} (target ${REACH_TARGET_HINT}+).

${formatBreakdownBrief(breakdown)}

RULES (non-negotiable):
- Keep Prem Iyer's voice: operator + investor, peer to CIOs/VPs — not generic AI LinkedIn.
- Add or sharpen ONE lived-in detail if specificity is weak: a number, named role, scene, time anchor, or mistake.
- Vary sentence length; break three same-length sentences in a row; one short reaction line is fine.
- Every line must be grammatically complete (ends with . ! or ?; all parentheses closed). Never stop mid-phrase or mid-parenthetical.
- Facts: never "500+ Fortune 500" (only 500 companies). Use "back to the terminal" not "back terminal". No naked "The demo passes." — say where it passes or stalls.
- Ban: game-changer, leverage, unlock, dive into, in today's fast-paced, the bottom line, here's the thing, crucial, vital, landscape, ever-evolving, arc, → arrows, bold headers, lesson/moral closers.
- HOOK+BODY+CTA+HASHTAGS ≤ ${POST_LENGTH.charSoftMax} chars (ideal ${POST_LENGTH.charIdealMax}–${POST_LENGTH.charSoftMax}).
- Mobile: short hook line, blank line, scannable body with ${POST_LENGTH.minDoubleLineBreaks}+ paragraph breaks.
- CTA must be a real question using "you/your" — not "thoughts?" or "agree?".
- List integrity: if you promise "three X", ship 1. 2. 3. or drop the count.
- Do not invent customer names or funding; hedge stats you cannot source.

CURRENT DRAFT:
${formatPostForPrompt(post)}

Output ONLY the revised post using the same section labels (HOOK, BODY, CTA, HASHTAGS, FIRST_COMMENT). No commentary.`
}

function finishPipelineResult(current, editorPasses) {
  const breakdown = breakdownReachScore(current)
  const reachClearedBar = breakdown.reachScore >= REACH_PUBLISH_MIN
  const reachWarning = reachClearedBar
    ? null
    : `Reach ${breakdown.reachScore} — below the ${REACH_PUBLISH_MIN - 1}+ bar after editor review. You can still copy this draft, or regenerate for a higher score.`

  return {
    post: current,
    published: true,
    reachClearedBar,
    reachScore: breakdown.reachScore,
    reachBreakdown: breakdown,
    editorPasses,
    reachWarning,
    message: null,
  }
}

/**
 * @param {object} params
 */
export async function runReachEditorPipeline({
  post,
  profile,
  systemPrompt,
  apiKey,
  parseRevision,
  finalizeOptions = {},
  onProgress,
}) {
  if (!post?.hook && !post?.body) {
    return {
      post: null,
      published: false,
      reachClearedBar: false,
      reachScore: 0,
      reachBreakdown: null,
      editorPasses: [],
      reachWarning: null,
      message: 'Empty draft — nothing to edit.',
    }
  }

  let current = { ...post }
  const editorPasses = []

  const scoreStep = (label) => {
    const breakdown = breakdownReachScore(current)
    const reachClearedBar = breakdown.reachScore >= REACH_PUBLISH_MIN
    editorPasses.push({ label, reachScore: breakdown.reachScore, reachClearedBar })
    return { breakdown, reachClearedBar }
  }

  onProgress?.('Scoring draft for reach…', 0)
  let { breakdown, reachClearedBar } = scoreStep('Initial draft')
  if (reachClearedBar) return finishPipelineResult(current, editorPasses)

  onProgress?.('Applying reach fixes…', 1)
  current = applyDeterministicReachFixes(current, {
    allowList: finalizeOptions.allowList,
    rhythmSeed: finalizeOptions.rhythmSeed,
    penaltyHints: breakdown.penalties,
  })
  ;({ breakdown, reachClearedBar } = scoreStep('After reach fixes'))
  if (reachClearedBar) return finishPipelineResult(current, editorPasses)

  const editorSystem = `${systemPrompt}

You are a LinkedIn reach editor. Raise measurable reach above ${REACH_PUBLISH_MIN - 1} by fixing hook (number + curiosity), mobile line breaks, comment-driving CTA, specificity, and penalties — without ChatGPT cadence.`

  for (let i = 0; i < MAX_LLM_EDITOR_PASSES; i++) {
    const editorNum = i + 1
    onProgress?.(`Editor ${editorNum + 1} reviewing (${profile.shortLabel})…`, i + 2)
    breakdown = breakdownReachScore(current)

    try {
      const raw = await generateRawCompletion(profile, {
        systemPrompt: editorSystem,
        userPrompt: buildEditorUserPrompt(current, breakdown, editorNum),
        apiKey,
      })
      current = parseRevision(raw)
    } catch (e) {
      editorPasses.push({
        label: `Editor ${editorNum + 1} parse failed`,
        reachScore: breakdown.reachScore,
        reachClearedBar: false,
        error: e?.message,
      })
      continue
    }

    if (!current?.hook?.trim() && !current?.body?.trim()) continue

    current = applyDeterministicReachFixes(current, {
      allowList: finalizeOptions.allowList,
      rhythmSeed: (finalizeOptions.rhythmSeed || 0) + editorNum,
      penaltyHints: breakdown.penalties,
    })

    ;({ breakdown, reachClearedBar } = scoreStep(`Editor ${editorNum + 1}`))
    if (reachClearedBar) return finishPipelineResult(current, editorPasses)
  }

  onProgress?.('Final reach boost…', 5)
  current = applyAggressiveDeterministicReachFixes(current, {
    allowList: finalizeOptions.allowList,
    rhythmSeed: (finalizeOptions.rhythmSeed || 0) + 9,
    penaltyHints: breakdown.penalties,
  })
  ;({ breakdown, reachClearedBar } = scoreStep('Final boost'))
  if (reachClearedBar) return finishPipelineResult(current, editorPasses)

  try {
    const raw = await generateRawCompletion(profile, {
      systemPrompt: editorSystem,
      userPrompt: buildEditorUserPrompt(current, breakdown, 3),
      apiKey,
    })
    current = parseRevision(raw)
    current = applyAggressiveDeterministicReachFixes(current, {
      allowList: finalizeOptions.allowList,
      rhythmSeed: (finalizeOptions.rhythmSeed || 0) + 12,
      penaltyHints: breakdown.penalties,
    })
    scoreStep('Reach boost editor')
  } catch {
    /* keep best effort */
  }

  return finishPipelineResult(current, editorPasses)
}
