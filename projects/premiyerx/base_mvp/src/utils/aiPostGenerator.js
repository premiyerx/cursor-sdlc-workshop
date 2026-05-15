import TOPICS from '../data/postTemplates'
import { getActiveProfile } from '../data/voiceProfile'
import { fetchRealtimeContext, formatRealtimeForPrompt, invalidateRealtimeCache } from './realtimeData'
import { buildVarietyEnvelope, recordGeneratedHook } from './generationVariety'
import { getTopicNarrative } from '../data/topicNarratives'
import { bumpRefreshSeed } from './freshnessRotation'

export function hasOpenAiKey() {
  return !!(localStorage.getItem('openai_key') || '').trim()
}

function parseAIOutput(raw) {
  const hookMatch = raw.match(/HOOK:\s*\n([\s\S]*?)(?=\nBODY:)/i)
  const bodyMatch = raw.match(/BODY:\s*\n([\s\S]*?)(?=\nCTA:)/i)
  const ctaMatch = raw.match(/CTA:\s*\n([\s\S]*?)(?=\nHASHTAGS:)/i)
  const hashMatch = raw.match(/HASHTAGS:\s*\n([\s\S]*?)(?=\nFIRST_COMMENT:|$)/i)
  const commentMatch = raw.match(/FIRST_COMMENT:\s*\n([\s\S]*?)$/i)

  const hook = hookMatch ? hookMatch[1].trim() : raw.slice(0, 200)
  recordGeneratedHook(hook)

  return {
    hook,
    body: bodyMatch ? bodyMatch[1].trim() : raw,
    cta: ctaMatch ? ctaMatch[1].trim() : '',
    hashtags: hashMatch ? hashMatch[1].trim() : '',
    firstComment: commentMatch ? commentMatch[1].trim() : '',
  }
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

ALGORITHM: Hook 8-12 words with number. Re-hook line 2. Body: line breaks, → arrows, 2-3 emoji at section breaks only, numbered framework, flip-the-script moment, 5+ cited stats. CTA: specific "you/your" question. 200-280 words.

Structure EXACTLY (plain text, no markdown):
HOOK:
[hook]

BODY:
[body]

CTA:
[cta]

HASHTAGS:
[hashtags]

FIRST_COMMENT:
[first comment 15+ words]`
}

/**
 * Generate a fresh AI post grounded in live headlines. Used by main Generate + AI panel.
 * Optional onProgress(pct, stage) reports real pipeline steps only.
 */
export async function generateAIPost(topicId, options = {}) {
  const report = (pct, stage) => options.onProgress?.(pct, stage)
  const apiKey = (options.apiKey || localStorage.getItem('openai_key') || '').trim()
  if (!apiKey) throw new Error('OpenAI API key required')

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

  report(58, 'Writing your post…')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.96,
      top_p: 0.9,
      presence_penalty: 0.7,
      frequency_penalty: 0.5,
      max_tokens: 1200,
    }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  report(92, 'Polishing your post…')
  const post = parseAIOutput(data.choices[0].message.content)
  report(100, 'Post ready')
  return { post, topic, usedAI: true, realtimeData, seed }
}
