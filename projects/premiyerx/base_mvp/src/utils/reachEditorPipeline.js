/**
 * Second and third editor passes — revise drafts until net reach score exceeds 85.
 * Only posts that clear the bar are returned for display.
 */
import { generateRawCompletion } from './llmPostClient.js'
import { breakdownReachScore, postSectionsToLiveText, REACH_PUBLISH_MIN } from './draftRecommendation.js'
import { applyDeterministicReachFixes } from './reachScoreOptimizer.js'
import { POST_LENGTH } from '../data/contentStrategy.js'

export { REACH_PUBLISH_MIN }

export const REACH_TARGET_HINT = 88

/** Editor 2 and Editor 3 — two LLM revision passes after deterministic fixes. */
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
CURRENT NET REACH SCORE: ${breakdown.reachScore} (must be > 85 to publish — aim for ${REACH_TARGET_HINT}+)
Algorithm base: ${breakdown.algorithmScore} − penalties ${breakdown.penaltySum} = ${breakdown.reachScore}

PENALTIES TO FIX FIRST:
${penaltyLines || '  • (none — push algorithm: hook, dwell, scannability, comment CTA)'}

WEAKEST ALGORITHM PILLARS:
${weakRules || '  • (n/a)'}
`.trim()
}

function buildEditorUserPrompt(post, breakdown, editorIndex) {
  const passLabel = editorIndex === 1 ? 'Editor 2' : editorIndex === 2 ? 'Editor 3' : 'Editor 4 (final boost)'
  return `${passLabel} — revise this LinkedIn draft so NET reach score exceeds 85 (target ${REACH_TARGET_HINT}+).

${formatBreakdownBrief(breakdown)}

RULES (non-negotiable):
- Keep Prem Iyer's voice: operator + investor, peer to CIOs/VPs — not generic AI LinkedIn.
- Add or sharpen ONE lived-in detail if specificity is weak: a number, named role, scene, time anchor, or mistake.
- Vary sentence length; break three same-length sentences in a row; one short reaction line is fine.
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

/**
 * @param {object} params
 * @param {object} params.post
 * @param {object} params.profile — text model profile used for generation
 * @param {string} params.systemPrompt — author voice / algorithm block
 * @param {string} params.apiKey
 * @param {function(string): Promise<string>} params.parseRevision — raw LLM text → finalized post
 * @param {object} params.finalizeOptions
 * @param {function(string, number)} [params.onProgress]
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
      reachScore: 0,
      reachBreakdown: null,
      editorPasses: [],
      message: 'Empty draft — nothing to edit.',
    }
  }

  let current = { ...post }
  const editorPasses = []

  const scoreAndMaybePublish = (label) => {
    const breakdown = breakdownReachScore(current)
    const published = breakdown.reachScore >= REACH_PUBLISH_MIN
    editorPasses.push({ label, reachScore: breakdown.reachScore, published })
    return { breakdown, published }
  }

  onProgress?.('Scoring draft for reach…', 0)
  let { breakdown, published } = scoreAndMaybePublish('Initial draft')
  if (published) {
    return {
      post: current,
      published: true,
      reachScore: breakdown.reachScore,
      reachBreakdown: breakdown,
      editorPasses,
      message: null,
    }
  }

  onProgress?.('Applying reach fixes (deterministic)…', 1)
  current = applyDeterministicReachFixes(current, {
    allowList: finalizeOptions.allowList,
    rhythmSeed: finalizeOptions.rhythmSeed,
    penaltyHints: breakdown.penalties,
  })
  ;({ breakdown, published } = scoreAndMaybePublish('After deterministic fixes'))
  if (published) {
    return {
      post: current,
      published: true,
      reachScore: breakdown.reachScore,
      reachBreakdown: breakdown,
      editorPasses,
      message: null,
    }
  }

  const editorSystem = `${systemPrompt}

You are a LinkedIn reach editor (not the author). Your job is to raise the measurable reach score above 85 by fixing hook strength, mobile scannability, comment-driving CTA, penalties (AI tells, length, specificity, rhythm), and list integrity — without sounding like ChatGPT.`

  for (let i = 0; i < MAX_LLM_EDITOR_PASSES; i++) {
    const editorNum = i + 1
    onProgress?.(`Editor ${editorNum + 1} reviewing (${profile.shortLabel})…`, i + 2)
    breakdown = breakdownReachScore(current)

    const raw = await generateRawCompletion(profile, {
      systemPrompt: editorSystem,
      userPrompt: buildEditorUserPrompt(current, breakdown, editorNum),
      apiKey,
    })

    try {
      current = parseRevision(raw)
    } catch (e) {
      editorPasses.push({
        label: `Editor ${editorNum + 1} parse failed`,
        reachScore: breakdown.reachScore,
        published: false,
        error: e?.message,
      })
      continue
    }

    if (!current?.hook?.trim() && !current?.body?.trim()) {
      editorPasses.push({
        label: `Editor ${editorNum + 1} empty`,
        reachScore: breakdown.reachScore,
        published: false,
      })
      continue
    }

    current = applyDeterministicReachFixes(current, {
      allowList: finalizeOptions.allowList,
      rhythmSeed: (finalizeOptions.rhythmSeed || 0) + editorNum,
      penaltyHints: breakdown.penalties,
    })

    ;({ breakdown, published } = scoreAndMaybePublish(`Editor ${editorNum + 1}`))
    if (published) {
      return {
        post: current,
        published: true,
        reachScore: breakdown.reachScore,
        reachBreakdown: breakdown,
        editorPasses,
        message: null,
      }
    }
  }

  const finalBreakdown = breakdownReachScore(current)
  const livePreview = postSectionsToLiveText(current).slice(0, 120)

  return {
    post: null,
    published: false,
    reachScore: finalBreakdown.reachScore,
    reachBreakdown: finalBreakdown,
    editorPasses,
    message: `Reach score ${finalBreakdown.reachScore} is still below ${REACH_PUBLISH_MIN} after ${MAX_LLM_EDITOR_PASSES} editor passes. Regenerate or tweak angle. Preview: "${livePreview}…"`,
  }
}
