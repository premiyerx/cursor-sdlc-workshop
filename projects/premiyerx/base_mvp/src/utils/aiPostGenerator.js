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
import { POST_LENGTH } from '../data/contentStrategy.js'
import { annotateVariantsWithRecommendation } from './draftRecommendation'
import { runReachEditorPipeline, REACH_PUBLISH_MIN } from './reachEditorPipeline.js'

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

/** Lines models echo from system rubrics — not reader-facing LinkedIn copy. */
function stripPromptInstructionEcho(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const L = line.trim()
      if (!L) return true
      if (/^CAPITAL_PILLAR_FOCUS\b/i.test(L)) return false
      if (/^-?\s*lead with cross-portfolio themes\b/i.test(L)) return false
      if (/^lead with\b/i.test(L) && L.length < 160) return false
      if (/^open on\b/i.test(L) && L.length < 140) return false
      if (/^frame as\b/i.test(L) && L.length < 140) return false
      if (/^contrast what\b/i.test(L) && L.length < 160) return false
      if (/^name the second-order\b/i.test(L)) return false
      if (/^do not make speculative\b/i.test(L)) return false
      if (/^if a blockbuster headline\b/i.test(L)) return false
      if (/unless CONTEXT has\b/i.test(L)) return false
      if (/unless the author explicitly wants\b/i.test(L)) return false
      return true
    })
    .join('\n')
}

/** Carousel exporter adds deck count; strip wrong “N-slide” claims from prose. */
function stripDeckSlideCountClaims(s) {
  if (!s) return ''
  return s.replace(
    /\b\d{1,2}\s*[-–]\s*slide\s+(visual guide|walkthrough|carousel|deck|breakdown)\b/gi,
    'a visual guide',
  )
}

/** Remove internal drafting markers models sometimes leak into prose. */
function sanitizeExternalCopy(s) {
  if (!s) return ''
  let t = String(s)
  const markers =
    /\b(?:RE[-_\s]?HOOK|RE[-_\s]?BODY|RE[-_\s]?LINE|ALT[-_\s]?HOOK|INTERNAL\s*DRAFT|DRAFT\s*ONLY|META[-_\s]?NOTE|NOTE\s*TO\s*SELF)\s*:?\s*/gi
  t = t.replace(markers, '')
  t = t.replace(/\(\s*Internal:[^)]*\)/gi, '')
  t = stripPromptInstructionEcho(t)
  t = stripDeckSlideCountClaims(t)
  t = t.replace(/[^\S\n]+/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Strip common assistant wrappers so section headers parse cleanly. */
function stripAssistantPreamble(text) {
  let t = text.trim()
  const introPatterns = [
    /^Sure[!,.]?\s*\n+/i,
    /^Certainly[!,.]?\s*\n+/i,
    /^Here(?:'s| is) (?:your|the) (?:LinkedIn )?post[^\n]*\n+/i,
    /^Below (?:is|you(?:'|')ll find)[^\n]*\n+/i,
  ]
  for (const re of introPatterns) {
    t = t.replace(re, '')
  }
  return t.trim()
}

function stripCodeFence(text) {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json|text)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  }
  return t.trim()
}

function normalizeSectionLabel(label) {
  const u = label.replace(/\*+/g, '').replace(/\s+/g, '_').toUpperCase()
  if (u === 'HOOK' || u === 'OPENING' || u === 'HEADLINE' || u === 'OPENER') return 'hook'
  if (u === 'BODY' || u === 'CONTENT' || u === 'MAIN') return 'body'
  if (u === 'CTA' || u === 'CALL_TO_ACTION') return 'cta'
  if (u === 'HASHTAGS' || u === 'HASHTAG' || u === 'TAGS') return 'hashtags'
  if (u === 'FIRST_COMMENT' || u === 'FIRSTCOMMENT') return 'firstComment'
  return null
}

/** Remove standalone section labels the model sometimes leaves inside prose. */
function stripStraySectionLabels(s) {
  if (!s) return ''
  return s
    .split('\n')
    .filter(
      (line) =>
        !/^\s*#*\s*(?:\*\*)?\s*(HOOK|BODY|CTA|HASHTAGS|CONTENT|OPENING|HEADLINE|MAIN|TAGS)\s*(?:\*\*)?\s*:?\s*$/i.test(
          line,
        ) &&
        !/^\s*#*\s*(?:\*\*)?\s*RE[-_\s]?HOOK\s*:?\s*$/i.test(line) &&
        !/^\s*#*\s*(?:\*\*)?\s*ALT[-_\s]?HOOK\s*:?\s*$/i.test(line) &&
        !/^\s*#*\s*(?:\*\*)?\s*INTERNAL\s*:?\s*$/i.test(line),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function tryParseJsonPost(text) {
  const tryObj = (o) => {
    if (!o || typeof o !== 'object') return null
    const hook = String(o.hook ?? o.opening ?? o.headline ?? '').trim()
    const body = String(o.body ?? o.content ?? o.main ?? o.text ?? '').trim()
    const cta = String(o.cta ?? o.callToAction ?? '').trim()
    const hashtags = String(o.hashtags ?? o.tags ?? '').trim()
    const firstComment = String(o.firstComment ?? o.first_comment ?? '').trim()
    if (hook || body) return { hook, body, cta, hashtags, firstComment }
    return null
  }
  try {
    const o = JSON.parse(text)
    const got = tryObj(o)
    if (got) return got
  } catch {
    /* continue */
  }
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) {
    try {
      const o = JSON.parse(brace[0])
      return tryObj(o)
    } catch {
      return null
    }
  }
  return null
}

/** Match section headers at line starts (markdown / bold / blockquote ok). */
function parseHeaderSections(text) {
  const re =
    /(?:^|\n)(\s*(?:>\s*)?#*\s*(?:\*\*)?\s*)(HOOK|HEADLINE|OPENING|BODY|CONTENT|MAIN|CTA|HASHTAGS|TAGS|FIRST[\s_]?COMMENT)(?:\*\*)?\s*:\s*/gi
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return null

  const chunks = { hook: '', body: '', cta: '', hashtags: '', firstComment: '' }
  const firstMatch = matches[0]
  const lead = text.slice(0, firstMatch.index).trim()

  for (let i = 0; i < matches.length; i++) {
    const key = normalizeSectionLabel(matches[i][2])
    if (!key) continue
    const start = matches[i].index + matches[i][0].length
    const end = matches[i + 1]?.index ?? text.length
    const chunk = text.slice(start, end).trim()
    if (!chunk) continue
    chunks[key] = chunks[key] ? `${chunks[key]}\n\n${chunk}` : chunk
  }

  let { hook, body, cta, hashtags, firstComment } = chunks
  const firstKey = normalizeSectionLabel(matches[0][2])

  if (lead) {
    if (firstKey === 'hook') hook = hook ? `${lead}\n\n${hook}` : lead
    else if (!hook) hook = lead
    else body = body ? `${lead}\n\n${body}` : `${lead}\n\n${body}`
  }

  if (!hook && body) {
    const lines = body.split('\n').filter(Boolean)
    hook = lines[0] || ''
    body = lines.slice(1).join('\n').trim() || body
  }

  if (hook || body || cta || hashtags) {
    return { hook, body, cta, hashtags, firstComment }
  }
  return null
}

/** Original strict newline format: HOOK:\\n...\\nBODY: */
function parseLegacyNewlineSections(text) {
  const hookMatch = text.match(/HOOK:\s*\n([\s\S]*?)(?=\nBODY:)/i)
  const bodyMatch = text.match(/BODY:\s*\n([\s\S]*?)(?=\nCTA:)/i)
  const ctaMatch = text.match(/CTA:\s*\n([\s\S]*?)(?=\nHASHTAGS:)/i)
  const hashMatch = text.match(/HASHTAGS:\s*\n([\s\S]*?)(?=\nFIRST_COMMENT:|$)/i)
  const commentMatch = text.match(/FIRST_COMMENT:\s*\n([\s\S]*?)$/i)
  if (!hookMatch && !bodyMatch) return null
  return {
    hook: hookMatch ? hookMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
    cta: ctaMatch ? ctaMatch[1].trim() : '',
    hashtags: hashMatch ? hashMatch[1].trim() : '',
    firstComment: commentMatch ? commentMatch[1].trim() : '',
  }
}

/** Same-line HOOK: text (no required newline after colon). */
function parseLegacyFlexibleColon(text) {
  const hookMatch = text.match(/HOOK:\s*\n?([\s\S]*?)(?=BODY:)/i)
  const bodyMatch = text.match(/BODY:\s*\n?([\s\S]*?)(?=CTA:)/i)
  const ctaMatch = text.match(/CTA:\s*\n?([\s\S]*?)(?=HASHTAGS:)/i)
  const hashMatch = text.match(/HASHTAGS:\s*\n?([\s\S]*?)(?=FIRST_COMMENT:|$)/i)
  const commentMatch = text.match(/FIRST_COMMENT:\s*\n?([\s\S]*?)$/i)
  if (!hookMatch && !bodyMatch) return null
  return {
    hook: hookMatch ? hookMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
    cta: ctaMatch ? ctaMatch[1].trim() : '',
    hashtags: hashMatch ? hashMatch[1].trim() : '',
    firstComment: commentMatch ? commentMatch[1].trim() : '',
  }
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
  const polished = repairFactualInPost(repairGrammarInPost(concise))
  recordGeneratedHook(polished.hook || polished.body.slice(0, 200))
  return polished
}

function salvageUnstructuredPost(text, finalizeOptions = {}) {
  const clean = sanitizeExternalCopy(stripAssistantPreamble(stripCodeFence(String(text || '').replace(/\r\n/g, '\n'))))
  if (!clean || clean.length < 24) return null
  const lines = clean.split('\n').filter((l) => l.trim())
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
  let text = stripCodeFence(String(raw || '').replace(/\r\n/g, '\n'))
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
  const hook = lines[0] || text.slice(0, 200)
  const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : text
  const out = finalizePost({ hook, body, cta: '', hashtags: '', firstComment: '' }, finalizeOptions)
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
- FACTUAL ENGLISH: Never write "500+ Fortune 500" (only 500 companies exist). Say "majority of Fortune 500" or "50%+" with source. Use "back to the terminal" not "back terminal". Spell out "Q2 (second quarter)" if you use quarter shorthand. List beats must be full sentences — not naked "The demo passes." without where/why.

ALGORITHM (2026): Mobile feed first. Target ~${POST_LENGTH.charIdealMax}–${POST_LENGTH.charSoftMax} characters total with ${POST_LENGTH.minDoubleLineBreaks}+ blank-line breaks — brief beats long. Optimize comment threads (comments >> likes). FIRST_COMMENT within 60 minutes: one new insight not in body + a short second question; founder will pin when possible.

Output format — use these labels ONLY as section markers (each on its own line, then your prose). Do not write the words Hook, Body, CTA, Hashtags, or Content as standalone lines inside the post itself. No JSON. No markdown headings.

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
  const raw = await generateRawCompletion(profile, {
    systemPrompt: ctx.systemPrompt,
    userPrompt: ctx.userPrompt,
    apiKey,
  })
  report(78, 'Polishing your post…')
  const draft = parseAIOutput(raw, ctx.finalizeOptions)
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
  report(48, 'Running GPT 5.5, Claude Opus 4.8, and Gemini (then Editors 2 & 3)…')

  async function runOneModel(profile) {
    const apiKey = getApiKeyForProfile(profile)
    const baseArgs = {
      systemPrompt: ctx.systemPrompt,
      userPrompt: ctx.userPrompt,
      apiKey,
    }
    const attempts = 2
    let lastErr = 'Request failed'
    for (let i = 0; i < attempts; i++) {
      try {
        const raw = await generateRawCompletion(profile, baseArgs)
        const draft = parseAIOutput(raw, ctx.finalizeOptions)
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
