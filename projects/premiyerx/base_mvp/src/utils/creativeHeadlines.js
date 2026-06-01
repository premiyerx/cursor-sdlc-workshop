import { fnv1a, mulberry32 } from './generationVariety.js'
import { getTextModelProfile } from '../data/textModelProfiles.js'
import { generateRawCompletion } from './llmPostClient.js'
import { getOpenAiKey } from './openaiKey.js'
import { getTopicNarrative } from '../data/topicNarratives.js'
import { sanitizeHeadlineGrammar } from './factualClaims.js'

const BANNED_REPEAT = /where capital is flowing in ai software development/i

const HEADLINE_POOLS = {
  cursor: [
    'When Repo-Wide Context Becomes the Real Copilot',
    'The IDE Decision Boards Stop Postponing',
    'Why Autocomplete Lost the Enterprise Bake-Off',
    'Agents Need Audit Trails, Not Demo Theater',
    'What Changed in AI Coding Tools This Month',
    'Full-Stack Context vs. Chat-in-a-Tab',
  ],
  investment: [
    'LPs Are Repricing Who Survives the AI Delivery Test',
    'Where Secondary Checks Meet Primary SDLC Bets',
    'Capital Tables That Still Ignore Inference COGS',
    'Pilot Stories Investors Will Not Fund Twice',
    'The New Diligence: Owners, Not Agent Hype',
    'Roll-Ups Meet Bottom-Up Seat Math',
    'What PE Operating Partners Ask Engineering Now',
    'When NRR Meets Token Bills and Security Review',
    'Infrastructure Checks vs. Application Layer Returns',
    'The Gap Between Decks and Merged Code',
  ],
  cio: [
    'What CIOs Measure After the AI Pilot Ends',
    'Governance Beats Feature Checklists in 2026',
    'The Board Question Behind Every AI Rollout',
    'Security Review Is the New Bottleneck',
    'When Procurement Outruns Engineering Trust',
    'Platform Standards vs. Shadow Copilots',
  ],
  roi: [
    'The Payback Math CFOs Actually Sign',
    'Cycle Time Is the Honest ROI Line',
    'What a Seat Saves When Rework Drops',
    'Productivity Claims vs. Incident Rates',
    'The Six-Week Test Enterprises Run',
    'Margin Pressure Meets Developer Leverage',
  ],
}

function poolForTopic(topicId) {
  return HEADLINE_POOLS[topicId] || HEADLINE_POOLS.roi
}

function pickFromPool(topicId, seed, exclude = new Set()) {
  const pool = poolForTopic(topicId).filter((h) => !exclude.has(h) && !BANNED_REPEAT.test(h))
  if (!pool.length) return poolForTopic(topicId)[0] || 'What Operators Are Seeing This Week'
  const rng = mulberry32((seed >>> 0) || 1)
  return pool[Math.floor(rng() * pool.length) % pool.length]
}

function cacheKey(parts) {
  return `lidp_creative_h_${parts.filter(Boolean).join('_').slice(0, 120)}`
}

function readCache(key) {
  try {
    return sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function cleanHeadlineLine(raw) {
  let t = String(raw || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(?:title|headline)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length > 110) t = `${t.slice(0, 107)}…`
  if (BANNED_REPEAT.test(t)) return ''
  return sanitizeHeadlineGrammar(t)
}

/**
 * Sync headline for carousel / fallbacks — rotated pools, no API call.
 */
export function pickCreativeCatalogHeadline({ topicId, refreshSeed = 0, headlineGuard, postSnippet = '' }) {
  const seed = fnv1a(`${topicId}:${refreshSeed}:${postSnippet.slice(0, 120)}`)
  const exclude = headlineGuard || new Set()
  for (let i = 0; i < 8; i++) {
    const h = pickFromPool(topicId, seed + i, exclude)
    if (h && !exclude.has(h)) {
      exclude.add(h)
      return h
    }
  }
  const narrative = getTopicNarrative(topicId)
  return pickFromPool(topicId, seed + 99, exclude) || narrative.label
}

/**
 * OpenAI headline for infographics (and optional reuse). Falls back to pool on error.
 */
export async function generateCreativeHeadline({
  topicId,
  topicLabel = '',
  postText = '',
  leadHeadlineTitle = '',
  refreshSeed = 0,
  variantKey = 'default',
}) {
  const narrative = getTopicNarrative(topicId)
  const seed = fnv1a(`${topicId}:${refreshSeed}:${variantKey}:${postText.slice(0, 200)}`)
  const key = cacheKey([topicId, refreshSeed, variantKey, postText.slice(0, 80)])
  const cached = readCache(key)
  if (cached) return cached

  const fallback = pickFromPool(topicId, seed, new Set([leadHeadlineTitle]))
  const apiKey = getOpenAiKey()
  if (!apiKey || apiKey.length < 20) {
    writeCache(key, fallback)
    return fallback
  }

  const profile = { ...getTextModelProfile('openai-gpt55'), apiModel: 'gpt-4o-mini' }
  const banned = [
    'Where Capital Is Flowing in AI Software Development',
    'The ROI of AI in Software Development',
    'The Business Case for AI-Native Software Development',
  ].join('; ')

  const systemPrompt =
    'You write breaking-news infographic titles for LinkedIn — same-day AI markets desk, not evergreen SEO. One line only. No quotes, no arrow bullets, no markdown.'
  const userPrompt = [
    `Topic pillar: ${topicLabel || narrative.label}.`,
    `Thesis: ${narrative.coreThesis.slice(0, 200)}.`,
    leadHeadlineTitle ? `Today's wire (paraphrase, do not copy): ${leadHeadlineTitle.slice(0, 100)}.` : '',
    postText ? `Post angle (paraphrase): ${postText.slice(0, 280).replace(/\n/g, ' ')}.` : '',
    `Do NOT repeat or closely imitate: ${banned}.`,
    'Write ONE fresh title (8–14 words) that sounds like breaking news THIS WEEK in AI — not a 2023/2024 retrospective.',
    'GRAMMAR: use "back to the terminal" (with "the"), never "back terminal".',
    'FACTS: never claim "500+ Fortune 500" — the list has only 500 companies; say "majority of Fortune 500" or a percent if needed.',
    'If you use Q1–Q4, write "Q2 (second quarter)" once for clarity.',
    'Return only the title text.',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const raw = await generateRawCompletion(profile, { systemPrompt, userPrompt, apiKey })
    const line = cleanHeadlineLine(raw.split('\n').find((l) => l.trim()) || raw)
    const out = line && line.length >= 12 ? line : fallback
    writeCache(key, out)
    return out
  } catch {
    writeCache(key, fallback)
    return fallback
  }
}

export { HEADLINE_POOLS, BANNED_REPEAT }
