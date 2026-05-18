import { getOpenAiKey } from './openaiKey'
import { getAnthropicKey, getGeminiKey } from './llmProviderKeys'

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
    const body = {
      model: profile.apiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.96,
      top_p: 0.9,
      presence_penalty: 0.7,
      frequency_penalty: 0.5,
      max_tokens: 1200,
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
    const text = data.choices?.[0]?.message?.content
    if (!text) throw new Error('OpenAI returned an empty response.')
    return text
  }

  if (profile.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
