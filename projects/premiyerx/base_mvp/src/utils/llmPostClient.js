import { getOpenAiKey } from './openaiKey.js'
import { getAnthropicKey, getGeminiKey } from './llmProviderKeys.js'

/**
 * GPT-5.x and o-series: use `max_completion_tokens` and do **not** send custom temperature / top_p / penalties
 * (API returns 400, e.g. "temperature does not support 0.96 … only the default (1)").
 * Single source of truth so token-cap logic and sampling logic never drift.
 */
function normalizeOpenAiModelId(model) {
  return String(model ?? '')
    .trim()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function openAiNewChatFamily(model) {
  const m = normalizeOpenAiModelId(model).toLowerCase()
  if (!m) return false
  // Normalized ids: gpt-5, gpt-5.5, gpt-5-mini, …
  if (m.startsWith('gpt-5')) return true
  // Rare aliases / spacing typos still containing gpt + 5 as a version token
  if (/\bgpt[\s._-]*5\b/i.test(m)) return true
  if (/^o[0-9]/.test(m) || m.startsWith('o1') || m.startsWith('o3')) return true
  return false
}

/**
 * Any request using max_completion_tokens (reasoning / GPT-5 family in this app) must not send legacy sampling.
 * Tie this to the **body shape**, not only model-string heuristics, so a missed classification cannot leak 0.96.
 */
function applyOpenAiReasoningSamplingDefaults(body) {
  if (!('max_completion_tokens' in body)) return
  delete body.top_p
  delete body.presence_penalty
  delete body.frequency_penalty
  // API rejects non-default temperature for several GPT-5.x models — explicit 1 matches "default (1)".
  body.temperature = 1
}

/** Resolve API model id (defensive if `apiModel` were missing on a profile clone). */
function resolveOpenAiApiModel(profile) {
  const direct = normalizeOpenAiModelId(profile?.apiModel)
  if (direct) return direct
  const id = String(profile?.id || '')
  if (id === 'openai-gpt55') return 'gpt-5.5'
  return direct
}

/** Newer OpenAI chat models reject `max_tokens` and require `max_completion_tokens`. */
function openAiTokenCapFields(model, value) {
  return openAiNewChatFamily(model) ? { max_completion_tokens: value } : { max_tokens: value }
}

/** Reasoning models count hidden “thinking” toward max_completion_tokens — keep headroom for visible text. */
function openAiCompletionCap(model) {
  return openAiNewChatFamily(model) ? 8192 : 1200
}

/** Chat message.content may be a string or a parts array (newer models). */
function openAiMessageText(message) {
  const c = message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c.map((p) => (p && p.type === 'text' && p.text ? p.text : '')).join('')
  }
  return ''
}

const ANTHROPIC_PROXY_PATH = '/api/anthropic-messages'

function anthropicMessagesUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${ANTHROPIC_PROXY_PATH}`
  }
  return 'https://api.anthropic.com/v1/messages'
}

/**
 * Resolve API key for a profile's `keyStorage` type.
 */
export function getApiKeyForProfile(profile, overrides = {}) {
  if (overrides.apiKey) return overrides.apiKey.trim()
  switch (profile.keyStorage) {
    case 'openai':
      return getOpenAiKey()
    case 'anthropic':
      return getAnthropicKey()
    case 'gemini':
      return getGeminiKey()
    default:
      return ''
  }
}

async function readErrorMessage(response) {
  const errData = await response.json().catch(() => ({}))
  return errData.error?.message || errData.message || `HTTP ${response.status}`
}

/**
 * @param {{ provider: string, apiModel: string }} profile
 * @param {{ systemPrompt: string, userPrompt: string, apiKey: string }} args
 * @returns {Promise<string>} raw assistant text
 */
export async function generateRawCompletion(profile, { systemPrompt, userPrompt, apiKey }) {
  const key = (apiKey || '').trim()
  if (!key) throw new Error('API key missing for this model.')

  if (profile.provider === 'openai') {
    const model = resolveOpenAiApiModel(profile)
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...openAiTokenCapFields(model, openAiCompletionCap(model)),
    }
    const m = normalizeOpenAiModelId(model).toLowerCase()
    const strict = openAiNewChatFamily(model)
    if (strict) {
      if (m.startsWith('gpt-5') || m.includes('gpt-5')) {
        body.reasoning_effort = 'low'
      } else {
        delete body.reasoning_effort
      }
    } else {
      delete body.reasoning_effort
      body.temperature = 0.96
      body.top_p = 0.9
      body.presence_penalty = 0.7
      body.frequency_penalty = 0.5
    }
    // Belt-and-suspenders: any max_completion_tokens request must never ship legacy sampling (e.g. 0.96).
    applyOpenAiReasoningSamplingDefaults(body)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(await readErrorMessage(response))
    const data = await response.json()
    const msg = data.choices?.[0]?.message
    const text = openAiMessageText(msg)
    if (!text.trim()) {
      const fr = data.choices?.[0]?.finish_reason || ''
      throw new Error(
        `OpenAI returned no assistant text${fr ? ` (finish_reason: ${fr})` : ''}. If this persists, try again in a moment.`,
      )
    }
    return text
  }

  if (profile.provider === 'anthropic') {
    const response = await fetch(anthropicMessagesUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: profile.apiModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!response.ok) throw new Error(await readErrorMessage(response))
    const data = await response.json()
    const blocks = data.content || []
    const text = blocks.map((b) => (b.type === 'text' ? b.text : '')).join('')
    if (!text.trim()) throw new Error('Anthropic returned an empty response.')
    return text
  }

  if (profile.provider === 'gemini') {
    const model = encodeURIComponent(profile.apiModel)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 8192,
        },
      }),
    })
    if (!response.ok) throw new Error(await readErrorMessage(response))
    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts
    const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : ''
    if (!text.trim()) throw new Error('Gemini returned an empty response.')
    return text
  }

  throw new Error(`Unknown provider: ${profile.provider}`)
}
