import { getOpenAiKey } from './openaiKey.js'
import { getAnthropicKey, getGeminiKey } from './llmProviderKeys.js'

/** Newer OpenAI chat models reject `max_tokens` and require `max_completion_tokens`. */
function openAiTokenCapFields(model, value) {
  const m = String(model || '').toLowerCase()
  if (m.includes('gpt-5') || /^o[0-9]/.test(m) || m.startsWith('o1') || m.startsWith('o3')) {
    return { max_completion_tokens: value }
  }
  return { max_tokens: value }
}

/** GPT-5 / o-series often fix sampling at defaults — sending temperature/top_p/penalties returns 400. */
function openAiUsesStrictDefaults(model) {
  const m = String(model || '').toLowerCase()
  return m.includes('gpt-5') || /^o[0-9]/.test(m) || m.startsWith('o1') || m.startsWith('o3')
}

/** Reasoning models count hidden “thinking” toward max_completion_tokens — keep headroom for visible text. */
function openAiCompletionCap(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('gpt-5') || /^o[0-9]/.test(m) || m.startsWith('o1') || m.startsWith('o3')) {
    return 8192
  }
  return 1200
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
    const model = profile.apiModel
    const body = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...openAiTokenCapFields(model, openAiCompletionCap(model)),
    }
    const m = String(model || '').toLowerCase()
    const strict = openAiUsesStrictDefaults(model)
    if (strict) {
      if (m.includes('gpt-5')) {
        body.reasoning_effort = 'low'
      }
    } else {
      body.temperature = 0.96
      body.top_p = 0.9
      body.presence_penalty = 0.7
      body.frequency_penalty = 0.5
    }
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
