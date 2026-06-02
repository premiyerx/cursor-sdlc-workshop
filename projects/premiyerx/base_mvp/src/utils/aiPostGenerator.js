import TOPICS from '../data/postTemplates'
import { getActiveProfile } from '../data/voiceProfile'
import { fetchRealtimeContext, formatRealtimeForPrompt, invalidateRealtimeCache } from './realtimeData'
import { buildVarietyEnvelope, recordGeneratedHook } from './generationVariety'
import { getTopicNarrative } from '../data/topicNarratives'
import { bumpRefreshSeed } from './freshnessRotation'
import { getOpenAiKey, hasOpenAiKey } from './openaiKey'
import {
  COMPARE_TEXT_MODEL_IDS,
  DEFAULT_TEXT_MODEL_ID,
  TEXT_MODEL_PROFILES,
  getTextModelProfile,
} from '../data/textModelProfiles'
import { generateRawCompletion, getApiKeyForProfile } from './llmPostClient'
import { humanizePostSections, enforceConcisePost } from './humanizeLinkedInCopy'
import { repairGrammarInPost } from './postGrammarQuality.js'
import { repairFactualInPost } from './factualClaims.js'
import { applyRoughEdit } from './postRoughEdit.js'
import { injectRhythmBreak } from './sentenceRhythm.js'
import { pickStructureTemplate, buildStructureDirective } from './postStructureTemplates.js'
import { buildHookLabDirective } from './hookLab.js'
import { buildTacticStackDirective } from './viralTactics.js'
import { applyIcpCritique } from './icpCritique.js'
import { POST_LENGTH } from '../data/contentStrategy.js'
import { annotateVariantsWithRecommendation } from './draftRecommendation'
import { runReachEditorPipeline, REACH_PUBLISH_MIN } from './reachEditorPipeline.js'
import {
  ANTI_LEAK_OUTPUT_SUFFIX,
  postSectionsHaveReasoningLeakage,
  lineLooksLikeReasoningLeak,
  prepareModelTextForParsing,
  repairReasoningInPost,
} from './modelReasoningLeakage.js'
import {
  sanitizeExternalCopy,
  stripAssistantPreamble,
  stripCodeFence,
  stripStraySectionLabels,
  tryParseJsonPost,
  parseHeaderSections,
  parseLegacyNewlineSections,
  parseLegacyFlexibleColon,
} from './postSectionParser.js'

export { REACH_PUBLISH_MIN } from './reachEditorPipeline.js'

export { hasOpenAiKey, getOpenAiKey }
export { DEFAULT_TEXT_MODEL_ID, getTextModelProfile, TEXT_MODEL_PROFILES } from '../data/textModelProfiles'

function keyLooksValid(profile, key) {
  const k = (key || '').trim()
  if (!k) return false
  if (profile.keyStorage === 'gemini') return k.length >= 16
  return k.length >= 20
}

export function hasApiKeyForModelId(modelId) {
  const p = getTextModelProfile(modelId)
  return keyLooksValid(p, getApiKeyForProfile(p))
}

export function canRunCompareAll() {
  return TEXT_MODEL_PROFILES.every((p) => keyLooksValid(p, getApiKeyForProfile(p)))
}

export function describeMissingCompareKeys() {
  return TEXT_MODEL_PROFILES.filter((p) => !keyLooksValid(p, getApiKeyForProfile(p))).map((p) => p.keyHint)
}

function finalizePost(p, options = {}) {
  const hook = stripStraySectionLabels(sanitizeExternalCopy(p.hook || ''))
  const body = stripStraySectionLabels(sanitizeExternalCopy(p.body || ''))
  const cta = stripStraySectionLabels(sanitizeExternalCopy(p.cta || ''))
  const hashtags = stripStraySectionLabels(sanitizeExternalCopy(p.hashtags || ''))
  const firstComment = stripStraySectionLabels(sanitizeExternalCopy(p.firstComment || ''))
  const humanized = humanizePostSections({ hook, body, cta, hashtags, firstComment })
  // Rough edit pass: strip moral/lesson/conclusion lines and collapse stray lists for
  // structures that forbid them. Then break up symmetric sentence rhythm. Length and
  // grammar passes still run last so the post lands inside the hard char cap.
  const allowList = options.allowList !== false ? Boolean(options.allowList) : false
  const edited = applyRoughEdit(humanized, { allowList })
  const rhythmed = { ...edited, body: injectRhythmBreak(edited.body || '', options.rhythmSeed || 0) }
  const concise = enforceConcisePost(rhythmed, POST_LENGTH.charHardMax)
  const polished = repairReasoningInPost(repairFactualInPost(repairGrammarInPost(concise)))
  const critiqued = applyIcpCritique(polished)
  recordGeneratedHook(critiqued.hook || critiqued.body.slice(0, 200))
  return critiqued
}

function salvageUnstructuredPost(text, finalizeOptions = {}) {
  const clean = sanitizeExternalCopy(stripAssistantPreamble(stripCodeFence(String(text || '').replace(/\r\n/g, '\n'))))
  if (!clean || clean.length < 24) return null
  const lines = clean.split('\n').filter((l) => l.trim() && !lineLooksLikeReasoningLeak(l))
  if (!lines.length) return null
  return finalizePost(
    {
      hook: lines[0],
      body: lines.length > 1 ? lines.slice(1).join('\n').trim() : clean,
      cta: '',
      hashtags: '',
      firstComment: '',
    },
    finalizeOptions,
  )
}

function parseAIOutput(raw, finalizeOptions = {}) {
  let text = prepareModelTextForParsing(stripCodeFence(String(raw || '').replace(/\r\n/g, '\n')))
  text = stripAssistantPreamble(text)
  text = sanitizeExternalCopy(text)

  const json = tryParseJsonPost(text)
  if (json) {
    const out = finalizePost(json, finalizeOptions)
    if (out.hook || out.body) return out
  }

  const headers = parseHeaderSections(text)
  if (headers) {
    const out = finalizePost(headers, finalizeOptions)
    if (out.hook || out.body) return out
  }

  const legacyNl = parseLegacyNewlineSections(text)
  if (legacyNl && (legacyNl.hook || legacyNl.body)) return finalizePost(legacyNl, finalizeOptions)

  const legacyFlex = parseLegacyFlexibleColon(text)
  if (legacyFlex && (legacyFlex.hook || legacyFlex.body)) return finalizePost(legacyFlex, finalizeOptions)

  const lines = text.split('\n').filter((l) => l.trim())
  // Pull trailing `#hashtag` block off as hashtags and the last `?`-ending line as CTA so an
  // unstructured raw post (no HOOK:/BODY:/CTA: headers) still scores comment-trigger correctly.
  let trailingTags = ''
  let trailing = [...lines]
  while (trailing.length > 0 && /^\s*#\w/.test(trailing[trailing.length - 1])) {
    trailingTags = `${trailing.pop()} ${trailingTags}`.trim()
  }
  let salvageCta = ''
  for (let i = trailing.length - 1; i >= 1; i--) {
    const t = trailing[i].trim()
    if (/\?\s*$/.test(t) && t.length >= 16 && t.length <= 220) {
      salvageCta = t
      trailing = [...trailing.slice(0, i), ...trailing.slice(i + 1)]
      break
    }
  }
  const hook = trailing[0] || text.slice(0, 200)
  const body = trailing.length > 1 ? trailing.slice(1).join('\n').trim() : text
  const out = finalizePost(
    { hook, body, cta: salvageCta, hashtags: trailingTags, firstComment: '' },
    finalizeOptions,
  )
  if (out.hook || out.body) return out

  const salvaged = salvageUnstructuredPost(raw, finalizeOptions)
  if (salvaged?.hook || salvaged?.body) return salvaged

  throw new Error('Could not find HOOK or BODY in model output. Try Generate again.')
}

/** Parse model or editor output through the same finalize pipeline. */
export function parseGeneratedPost(raw, finalizeOptions = {}) {
  return parseAIOutput(raw, finalizeOptions)
}

async function polishPostForReach(post, ctx, profile, apiKey, report) {
  const short = profile.shortLabel || profile.label
  report(88, `${short}: Editors 2 & 3 (target 81+ reach)…`)
  const result = await runReachEditorPipeline({
    post,
    profile,
    systemPrompt: ctx.systemPrompt,
    apiKey,
    parseRevision: (raw) => parseGeneratedPost(raw, ctx.finalizeOptions),
    finalizeOptions: ctx.finalizeOptions,
    onProgress: (stage) => report(90, `${short}: ${stage}`),
  })
  if (!result.post) {
    return {
      post: null,
      error: result.message || 'Editor review produced an empty draft.',
      reachScore: result.reachScore,
      reachBreakdown: result.reachBreakdown,
      editorPasses: result.editorPasses,
      reachClearedBar: false,
      reachWarning: null,
    }
  }
  return {
    post: result.post,
    error: null,
    reachScore: result.reachScore,
    reachBreakdown: result.reachBreakdown,
    editorPasses: result.editorPasses,
    reachClearedBar: result.reachClearedBar,
    reachWarning: result.reachWarning,
  }
}

function buildUserPrompt(topic, topicId, realtimeContext, customAngle = '', structure = null) {
  const varietyBlock = buildVarietyEnvelope(topicId, topic.label)
  const structureBlock = buildStructureDirective(structure)
  const narrative = getTopicNarrative(topicId)
  const runStamp = new Date().toISOString()
  const periodLabel = new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const capitalPillarGuard =
    topicId === 'investment'
      ? `

CAPITAL_PILLAR_FOCUS (VC & PE × AI SDLC — prudent public framing for an operator at an AI dev platform):
- Lead with cross-portfolio themes: inference / infra economics, roll-ups & secondaries, seat & NRR math, pilot→production conversion, security & governance spend, services attach, and LP expectations.
- These bullets are private instructions to you — never paste them verbatim into HOOK, BODY, or reader-facing bullets.
- Do not make speculative or sensitive single-company M&A / syndicate arcs the spine of the post (including Cursor-related transaction chatter) unless the author explicitly wants that angle and CONTEXT has a primary, dated, on-the-record headline to paraphrase with attribution.
- If a blockbuster headline appears, treat it as one datapoint among several—never as insider commentary, unnamed “adjacent syndicate” framing, or anything that reads like confidential detail.
`
      : ''

  return `Write a LinkedIn post in the content pillar: "${topic.label}".

GENERATION_RUN: ${runStamp} — this must be completely different from any post you wrote earlier today for this pillar.

CURRENT_PERIOD_UTC: ${periodLabel}. For anything time-sensitive (valuations, M&A, funding totals, survey quarters), prioritize facts implied by the dated headlines in CONTEXT. Do not cite stale 2025 summaries or old round totals unless a headline explicitly includes them with a date.
BREAKING-NEWS MODE: Write like a same-day AI wire — anchor on CONTEXT headlines from the last 30 days. Never cite 2023 or 2024 (or older surveys) as current news. A multi-year timeline is allowed only if it ends in the current month/year (${new Date().getUTCFullYear()}).
DATE FRESHNESS: Any stat or "as of" year must be within 30 days of GENERATION_RUN unless part of an explicit timeline whose last step is the present period. Training-data round totals from past years are forbidden.

Pillar context: ${topic.description}

PRIORITY THESIS: ${narrative.coreThesis}

MARKET FRAME: ${narrative.competitiveFrame}

${customAngle ? `Specific angle: ${customAngle}` : ''}

${varietyBlock}
${structureBlock}
${buildHookLabDirective()}
${buildTacticStackDirective()}
${capitalPillarGuard}

CONTEXT:
- Audience: ${narrative.audience}
- Anchor hook in LEAD STORY from research below (paraphrase — never paste headline verbatim).
- Sound like Prem Iyer: SVP, Global Strategic Accounts at Cursor — operator + investor, peer to CIOs and engineering leaders — NOT generic ChatGPT LinkedIn voice.
- PERSONAL SPECIFICITY (non-negotiable): every post MUST include at least one detail only someone with direct experience would know — a real number (with a unit), a named role in a scene (a VP Eng / CIO who told you something), a specific outcome (closed, shipped, paused, expanded to N seats), or a named mistake you made. No generic observations. If you can't be specific, use a composite labeled as composite — never invent customer names or funding figures.
- BANNED VOCABULARY (do not use anywhere): "game-changer", "dive into", "leverage", "unlock", "in today's fast-paced", "it's worth noting", "at the end of the day", "the reality is", "buckle up", "the bottom line", "let that sink in", "here's the thing", "crucial", "vital", "landscape", "ever-evolving", "arc", "thoughts?", "agree?". The post-processor strips these — but if you avoid them, the result reads more like a human first draft.
- HUMAN VOICE (non-negotiable): Write like Prem on his phone after a customer call — casual, concise, slightly irreverent. Contractions OK. One short parenthetical re-hook max. Not a memo, keynote, or consultant deck. No → ► ▸ arrow bullets (major ChatGPT tell). No markdown bold. No bold mid-post headers ever. No "Key takeaway", "Here's the thing", "Furthermore". Lists are short standalone lines with blank lines between, or "1." / "2." numbering — never arrow prefixes.
- SENTENCE RHYTHM (mandatory): Vary length aggressively. Mix one-word sentences with long, clause-heavy ones. NEVER allow three consecutive sentences of similar length. A one-word reaction line ("Honestly?", "Two things.", "Wild.") is welcome to break the cadence. Mobile-first formatting still rules — the opening line or two plus a blank line break is what earns the "see more" tap.
- EM-DASHES + COMPLETE LINES: Up to 2 em-dashes in the whole post. Every beat must be a complete sentence or intentional hook fragment ending in . ! or ? — never truncate mid-parenthetical or mid-noun phrase (illegal: "(it was a 47-ticket security" without finishing).
- NO LESSONS / NO MORALS: Do NOT end on a "the lesson is", "the takeaway is", "this is why this matters", "remember:", or "bottom line:" sentence. The post-processor strips them. Replace what would be a moral with a question, a next-step observation, or a thing you're going to try.
- FORMATTING DISCIPLINE (limit symmetry): Do NOT use bullet points or numbered lists unless STRUCTURE_FOR_THIS_POST explicitly allows them. When you do use bullets, items must be uneven in length and NOT parallel in grammar. Never use bold headers mid-post.
- LENGTH (hard): HOOK+BODY+CTA+HASHTAGS combined ≤${POST_LENGTH.charSoftMax} characters (ideal ${POST_LENGTH.charIdealMax}–${POST_LENGTH.charSoftMax}). Max three proof beats in BODY; each beat ≤1 short line. Cut throat-clearing — if it sounds like ChatGPT, delete it.
- LIST INTEGRITY (non-negotiable): If you write "Three patterns/reasons/ways…" you MUST deliver numbered items 1, 2, and 3 before the CTA — each item one tight line. Never tease a count you cannot finish. Safer: "One pattern I keep seeing…" or two items with "Two…" — no orphan list intros.
- Never paste CAPITAL_PILLAR rubric lines, “Lead with…”, “Contrast…”, or other prompt instructions as if they were the post — those are private guidance, not public copy.
- Do not claim a specific slide count (e.g. “11-slide visual guide”); the app attaches the PDF and writes the accurate slide count in the caption.
${realtimeContext}

DATA ACCURACY: Every stat needs inline source tied to CONTEXT headlines when possible. Never invent funding, dates, or customer names. Never output internal drafting labels (e.g. RE-HOOK, ALT HOOK, INTERNAL).
- FACTUAL ENGLISH: Never write "500+ Fortune 500" (only 500 companies exist). Say "majority of Fortune 500" or use the verified-data percentage. Use "back to the terminal" not "back terminal". Spell out "Q2 (second quarter)" if you use quarter shorthand. List beats must be full sentences — not naked "The demo passes." without where/why.

ALGORITHM (2026): Mobile feed first. Target ~${POST_LENGTH.charIdealMax}–${POST_LENGTH.charSoftMax} characters total with ${POST_LENGTH.minDoubleLineBreaks}+ blank-line breaks — brief beats long. Optimize comment threads (comments >> likes). FIRST_COMMENT within 60 minutes: one new insight not in body + a short second question; founder will pin when possible.

Output format — use these labels ONLY as section markers (each on its own line, then your prose). Do not write the words Hook, Body, CTA, Hashtags, or Content as standalone lines inside the post itself. No JSON. No markdown headings.
Never output word counts, character counts, style rubric notes, numbered token breakdowns (e.g. "4(for)"), "Good variation", "let's look at the sample", or any chain-of-thought — only the LinkedIn post sections below.

HOOK:
[opening — two short lines max]

BODY:
[main post]

CTA:
[one question line]

HASHTAGS:
[space-separated hashtags]

FIRST_COMMENT:
[15+ words for a first comment]`
}

async function loadSharedGenerationContext(topicId, options) {
  const report = (pct, stage) => options.onProgress?.(pct, stage)
  const topic = TOPICS.find((t) => t.id === topicId)
  if (!topic) throw new Error('Unknown topic')

  report(8, 'Starting fresh post…')
  const seed = bumpRefreshSeed(topicId)
  invalidateRealtimeCache(topicId)

  report(15, 'Loading today\'s headlines…')
  const systemPrompt = getActiveProfile().promptInstructions
  let realtimeData = null
  let realtimeContext = ''
  try {
    realtimeData = await fetchRealtimeContext(topicId, {
      forceRefresh: true,
      topicLabel: topic.label,
    })
    realtimeContext = formatRealtimeForPrompt(realtimeData, topicId)
    report(34, 'Headlines ready')
  } catch {
    report(28, 'Continuing without live headlines…')
  }

  report(44, 'Applying your voice profile…')
  const structure = pickStructureTemplate(topicId)
  const userPrompt = buildUserPrompt(topic, topicId, realtimeContext, options.customAngle || '', structure)
  const finalizeOptions = {
    allowList: structure?.id === 'before-after',
    rhythmSeed: Date.now() & 0xffff,
  }

  return { topic, systemPrompt, userPrompt, realtimeData, seed, structure, finalizeOptions }
}

/**
 * Generate a fresh AI post grounded in live headlines. Used by main Generate + AI panel.
 * Optional onProgress(pct, stage) reports real pipeline steps only.
 * @param {string} topicId
 * @param {{ customAngle?: string, onProgress?: function, textModelId?: string, apiKey?: string }} options
 */
export async function generateAIPost(topicId, options = {}) {
  const report = (pct, stage) => options.onProgress?.(pct, stage)
  const profile = getTextModelProfile(options.textModelId || DEFAULT_TEXT_MODEL_ID)
  const apiKey = (options.apiKey || '').trim() || getApiKeyForProfile(profile)
  if (!keyLooksValid(profile, apiKey)) {
    throw new Error(`Add your ${profile.keyHint} under API Keys (welcome area).`)
  }

  const ctx = await loadSharedGenerationContext(topicId, options)
  report(58, `Writing with ${profile.label}…`)
  let raw = ''
  let draft = null
  for (let i = 0; i < 3; i++) {
    const userPrompt =
      i > 0 && profile.provider === 'gemini' ? `${ctx.userPrompt}${ANTI_LEAK_OUTPUT_SUFFIX}` : ctx.userPrompt
    raw = await generateRawCompletion(profile, {
      systemPrompt: ctx.systemPrompt,
      userPrompt,
      apiKey,
    })
    draft = parseAIOutput(raw, ctx.finalizeOptions)
    if (postSectionsHaveReasoningLeakage(draft)) {
      draft = parseAIOutput(prepareModelTextForParsing(raw, { aggressive: true }), ctx.finalizeOptions)
    }
    if (!postSectionsHaveReasoningLeakage(draft)) break
  }
  if (postSectionsHaveReasoningLeakage(draft)) {
    throw new Error('Model returned internal notes instead of a LinkedIn post. Try Generate again.')
  }
  report(78, 'Polishing your post…')
  const polished = await polishPostForReach(draft, ctx, profile, apiKey, report)
  if (polished.error) throw new Error(polished.error)
  report(100, 'Post ready')
  return {
    post: polished.post,
    topic: ctx.topic,
    usedAI: true,
    realtimeData: ctx.realtimeData,
    seed: ctx.seed,
    textModel: profile,
    structure: ctx.structure,
    reachScore: polished.reachScore,
    reachBreakdown: polished.reachBreakdown,
    editorPasses: polished.editorPasses,
  }
}

/**
 * Same headlines + prompt for all three providers; runs requests in parallel.
 */
export async function generateAIPostCompareAll(topicId, options = {}) {
  const report = (pct, stage) => options.onProgress?.(pct, stage)
  const missing = describeMissingCompareKeys()
  if (missing.length) {
    throw new Error(`Compare all three requires each provider’s API key. Still need: ${missing.join(' · ')}`)
  }

  const ctx = await loadSharedGenerationContext(topicId, options)
  const profiles = COMPARE_TEXT_MODEL_IDS.map((id) => getTextModelProfile(id))
  report(48, 'Running GPT 5.5, Claude Opus 4.8, and Gemini 3 Pro (then Editors 2 & 3)…')

  async function runOneModel(profile) {
    const apiKey = getApiKeyForProfile(profile)
    const baseArgs = {
      systemPrompt: ctx.systemPrompt,
      userPrompt: ctx.userPrompt,
      apiKey,
    }
    const attempts = 3
    let lastErr = 'Request failed'
    for (let i = 0; i < attempts; i++) {
      try {
        const userPrompt =
          i > 0 && profile.provider === 'gemini'
            ? `${ctx.userPrompt}${ANTI_LEAK_OUTPUT_SUFFIX}`
            : ctx.userPrompt
        const raw = await generateRawCompletion(profile, { ...baseArgs, userPrompt })
        let draft = parseAIOutput(raw, ctx.finalizeOptions)
        if (postSectionsHaveReasoningLeakage(draft)) {
          draft = parseAIOutput(
            prepareModelTextForParsing(raw, { aggressive: true }),
            ctx.finalizeOptions,
          )
        }
        if (postSectionsHaveReasoningLeakage(draft)) {
          throw new Error('Model leaked internal reasoning instead of a clean post. Retrying…')
        }
        if (!draft.hook?.trim() && !draft.body?.trim()) {
          throw new Error('Model returned empty HOOK and BODY.')
        }
        const noopReport = () => {}
        const polished = await polishPostForReach(draft, ctx, profile, apiKey, noopReport)
        if (polished.error) {
          throw new Error(polished.error)
        }
        return {
          post: polished.post,
          error: null,
          reachScore: polished.reachScore,
          reachBreakdown: polished.reachBreakdown,
          editorPasses: polished.editorPasses,
          reachClearedBar: polished.reachClearedBar,
          reachWarning: polished.reachWarning,
        }
      } catch (e) {
        lastErr = e?.message || 'Request failed'
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 1800))
        }
      }
    }
    return { post: null, error: lastErr }
  }

  const settled = await Promise.allSettled(profiles.map((profile) => runOneModel(profile)))

  const variants = settled.map((s, i) => {
    const profile = profiles[i]
    const base = {
      id: profile.id,
      label: profile.label,
      shortLabel: profile.shortLabel,
      provider: profile.provider,
    }
    if (s.status === 'fulfilled') {
      return {
        ...base,
        post: s.value.post,
        error: s.value.error,
        reachScore: s.value.reachScore ?? null,
        reachBreakdown: s.value.reachBreakdown ?? null,
        editorPasses: s.value.editorPasses ?? null,
        reachClearedBar: s.value.reachClearedBar ?? null,
        reachWarning: s.value.reachWarning ?? null,
      }
    }
    return {
      ...base,
      post: null,
      error: s.reason?.message || 'Request failed',
    }
  })

  report(96, 'Ranking drafts for LinkedIn reach…')
  const { variants: annotated, recommendation } = annotateVariantsWithRecommendation(variants)

  report(100, 'All model runs finished')
  return {
    variants: annotated,
    recommendation,
    topic: ctx.topic,
    usedAI: true,
    realtimeData: ctx.realtimeData,
    seed: ctx.seed,
    structure: ctx.structure,
  }
}
