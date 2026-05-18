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
    .filter((line) => !/^\s*#*\s*(?:\*\*)?\s*(HOOK|BODY|CTA|HASHTAGS|CONTENT|OPENING|HEADLINE|MAIN|TAGS)\s*(?:\*\*)?\s*:?\s*$/i.test(line))
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

function finalizePost(p) {
  const hook = stripStraySectionLabels(p.hook || '')
  const body = stripStraySectionLabels(p.body || '')
  const cta = stripStraySectionLabels(p.cta || '')
  const hashtags = stripStraySectionLabels(p.hashtags || '')
  const firstComment = stripStraySectionLabels(p.firstComment || '')
  recordGeneratedHook(hook || body.slice(0, 200))
  return { hook, body, cta, hashtags, firstComment }
}

function parseAIOutput(raw) {
  let text = stripCodeFence(String(raw || '').replace(/\r\n/g, '\n'))
  text = stripAssistantPreamble(text)

  const json = tryParseJsonPost(text)
  if (json) return finalizePost(json)

  const headers = parseHeaderSections(text)
  if (headers) return finalizePost(headers)

  const legacyNl = parseLegacyNewlineSections(text)
  if (legacyNl && (legacyNl.hook || legacyNl.body)) return finalizePost(legacyNl)

  const legacyFlex = parseLegacyFlexibleColon(text)
  if (legacyFlex && (legacyFlex.hook || legacyFlex.body)) return finalizePost(legacyFlex)

  const lines = text.split('\n').filter((l) => l.trim())
  const hook = lines[0] || text.slice(0, 200)
  const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : text
  return finalizePost({ hook, body, cta: '', hashtags: '', firstComment: '' })
}

function buildUserPrompt(topic, topicId, realtimeContext, customAngle = '') {
  const varietyBlock = buildVarietyEnvelope(topicId, topic.label)
  const narrative = getTopicNarrative(topicId)
  const runStamp = new Date().toISOString()

  return `Write a LinkedIn post in the content pillar: "${topic.label}".

GENERATION_RUN: ${runStamp} — this must be completely different from any post you wrote earlier today for this pillar.

Pillar context: ${topic.description}

PRIORITY THESIS: ${narrative.coreThesis}

MARKET FRAME: ${narrative.competitiveFrame}

${customAngle ? `Specific angle: ${customAngle}` : ''}

${varietyBlock}

CONTEXT:
- Audience: ${narrative.audience}
- Anchor hook in LEAD STORY from research below (paraphrase — never paste headline verbatim).
- Sound like Prem Iyer: operator + investor, peer to CIOs — NOT generic ChatGPT LinkedIn voice.
- Ban phrases: "game-changer", "let's dive", "in today's fast-paced", "thoughts?", "agree?"
${realtimeContext}

DATA ACCURACY: Every stat needs inline source. Never invent funding, dates, or customer names.

ALGORITHM (2026): Optimize for sustained read depth (dwell), comment threads over passive likes, pillar consistency, and an opening that earns "see more." No engagement bait or naked external URLs in the body. FIRST_COMMENT must add new insight and a follow-up question so you can reply substantively in the first hour.

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
  const userPrompt = buildUserPrompt(topic, topicId, realtimeContext, options.customAngle || '')

  return { topic, systemPrompt, userPrompt, realtimeData, seed }
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
    throw new Error(`Add your ${profile.keyHint} in Settings.`)
  }

  const ctx = await loadSharedGenerationContext(topicId, options)
  report(58, `Writing with ${profile.label}…`)
  const raw = await generateRawCompletion(profile, {
    systemPrompt: ctx.systemPrompt,
    userPrompt: ctx.userPrompt,
    apiKey,
  })
  report(92, 'Polishing your post…')
  const post = parseAIOutput(raw)
  report(100, 'Post ready')
  return { post, topic: ctx.topic, usedAI: true, realtimeData: ctx.realtimeData, seed: ctx.seed, textModel: profile }
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
  report(52, 'Running GPT 5.5, Claude Opus 4.7, and Gemini in parallel…')

  const settled = await Promise.allSettled(
    profiles.map((profile) =>
      generateRawCompletion(profile, {
        systemPrompt: ctx.systemPrompt,
        userPrompt: ctx.userPrompt,
        apiKey: getApiKeyForProfile(profile),
      }),
    ),
  )

  const variants = settled.map((s, i) => {
    const profile = profiles[i]
    if (s.status === 'fulfilled') {
      try {
        return {
          id: profile.id,
          label: profile.label,
          shortLabel: profile.shortLabel,
          provider: profile.provider,
          post: parseAIOutput(s.value),
          error: null,
        }
      } catch (e) {
        return {
          id: profile.id,
          label: profile.label,
          shortLabel: profile.shortLabel,
          provider: profile.provider,
          post: null,
          error: e?.message || 'Could not parse model output.',
        }
      }
    }
    return {
      id: profile.id,
      label: profile.label,
      shortLabel: profile.shortLabel,
      provider: profile.provider,
      post: null,
      error: s.reason?.message || 'Request failed',
    }
  })

  report(100, 'All model runs finished')
  return {
    variants,
    topic: ctx.topic,
    usedAI: true,
    realtimeData: ctx.realtimeData,
    seed: ctx.seed,
  }
}
