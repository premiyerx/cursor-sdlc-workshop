import { getOpenAiKey } from './openaiKey.js'
import { getAnthropicKey, getGeminiKey } from './llmProviderKeys.js'
import { resolveApiModelsForProfile } from '../data/textModelProfiles.js'

export const PROMPT_LIMITS = { system: 48_000, user: 32_000 }

const LLM_FETCH_TIMEOUT_MS = 120_000
const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504])

/**
 * GPT-5.x and o-series: use `max_completion_tokens` and do **not** send custom temperature / top_p / penalties
 * (API returns 400, e.g. "temperature does not support 0.96 … only the default (1)").
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
  if (m.startsWith('gpt-5')) return true
  if (/\bgpt[\s._-]*5\b/i.test(m)) return true
  if (/^o[0-9]/.test(m) || m.startsWith('o1') || m.startsWith('o3')) return true
  return false
}

function applyOpenAiReasoningSamplingDefaults(body) {
  if (!('max_completion_tokens' in body)) return
  delete body.top_p
  delete body.presence_penalty
  delete body.frequency_penalty
  body.temperature = 1
}

function resolveOpenAiApiModel(profile) {
  const direct = normalizeOpenAiModelId(profile?.apiModel)
  if (direct) return direct
  const id = String(profile?.id || '')
  if (id === 'openai-gpt55') return 'gpt-5.5'
  return direct
}

function openAiTokenCapFields(model, value) {
  return openAiNewChatFamily(model) ? { max_completion_tokens: value } : { max_tokens: value }
}

function openAiCompletionCap(model) {
  return openAiNewChatFamily(model) ? 8192 : 1200
}

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

function clipPrompt(text, max) {
  const t = String(text || '')
  if (t.length <= max) return t
  return `${t.slice(0, max - 96)}\n\n[…truncated for API limits]`
}

export function preparePromptsForLlm(systemPrompt, userPrompt) {
  return {
    systemPrompt: clipPrompt(systemPrompt, PROMPT_LIMITS.system),
    userPrompt: clipPrompt(userPrompt, PROMPT_LIMITS.user),
  }
}

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithTimeout(url, init, ms = LLM_FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(ms / 1000)}s. Try again in a moment.`)
    }
    if (/failed to fetch|networkerror|load failed/i.test(e?.message || '')) {
      throw new Error('Network error — check your connection and try again.')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function parseErrorJson(raw) {
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function readErrorMessage(response, provider = '') {
  const status = response.status
  const ct = (response.headers.get('content-type') || '').toLowerCase()
  const raw = await response.text().catch(() => '')
  const errData = parseErrorJson(raw)

  const pick =
    errData?.error?.message ||
    (typeof errData?.error === 'string' ? errData.error : '') ||
    errData?.message ||
    errData?.error?.status ||
    (Array.isArray(errData?.error?.details)
      ? errData.error.details.map((d) => d?.message || d?.reason).filter(Boolean).join('; ')
      : '')

  if (pick && typeof pick === 'string') return pick.trim()

  if (status === 405) {
    return (
      'Anthropic bridge returned HTTP 405 (POST not allowed on this URL). ' +
      'Production needs /api/anthropic-messages deployed — refresh after the latest deploy, or run the Vite dev server locally.'
    )
  }
  if (status === 401) {
    return provider
      ? `Invalid or missing ${provider} API key. Re-paste it under API Keys.`
      : 'Invalid or missing API key for this provider.'
  }
  if (status === 429) return 'Rate limited — wait a few seconds and try again.'
  if (raw && raw.length < 320 && !raw.includes('<!DOCTYPE')) return raw.trim()
  return `HTTP ${status}`
}

function isRetryableHttpStatus(status) {
  return RETRYABLE_HTTP.has(status)
}

function isFallbackableModelError(err) {
  const msg = String(err?.message || '').toLowerCase()
  const status = err?.httpStatus
  if (status === 404) return true
  return (
    /model.*(not found|does not exist|unknown|invalid|unavailable)/i.test(msg) ||
    /(not_found|invalid_model|model_not_found)/i.test(msg) ||
    /\b404\b/.test(msg)
  )
}

function isRetryableTransportError(err) {
  const msg = String(err?.message || '')
  if (err?.httpStatus && isRetryableHttpStatus(err.httpStatus)) return true
  return /timed out|rate limit|network error|try again/i.test(msg)
}

function labelProviderError(profile, apiModel, message) {
  const usedAlt = apiModel && apiModel !== profile.apiModel
  const modelNote = usedAlt ? ` (fell back to ${apiModel})` : ''
  const prefix = `${profile.label}: `
  if (message.startsWith(prefix)) return `${message}${modelNote}`
  return `${prefix}${message}${modelNote}`
}

async function callOpenAi(profile, { systemPrompt, userPrompt, apiKey }) {
  const model = resolveOpenAiApiModel(profile)
  const buildBody = (opts = {}) => {
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
    if (strict && !opts.stripReasoning) {
      if (m.startsWith('gpt-5') || m.includes('gpt-5')) {
        body.reasoning_effort = 'low'
      }
    } else {
      delete body.reasoning_effort
      if (!strict) {
        body.temperature = 0.96
        body.top_p = 0.9
        body.presence_penalty = 0.7
        body.frequency_penalty = 0.5
      }
    }
    applyOpenAiReasoningSamplingDefaults(body)
    if (opts.stripReasoning) delete body.reasoning_effort
    return body
  }

  const attempt = async (opts) => {
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody(opts)),
    })
    if (!response.ok) {
      const message = await readErrorMessage(response, 'OpenAI')
      const err = new Error(message)
      err.httpStatus = response.status
      err.provider = 'openai'
      throw err
    }
    return response.json()
  }

  let data
  try {
    data = await attempt({})
  } catch (first) {
    const msg = String(first?.message || '')
    const retryStrip =
      first?.httpStatus === 400 &&
      /reasoning|temperature|max_completion_tokens|unsupported|unknown parameter/i.test(msg)
    if (retryStrip) {
      data = await attempt({ stripReasoning: true })
    } else {
      throw first
    }
  }

  const msg = data.choices?.[0]?.message
  const text = openAiMessageText(msg)
  if (!text.trim()) {
    const fr = data.choices?.[0]?.finish_reason || ''
    throw new Error(
      `OpenAI returned no assistant text${fr ? ` (finish_reason: ${fr})` : ''}. Try again in a moment.`,
    )
  }
  return text
}

async function callAnthropic(profile, { systemPrompt, userPrompt, apiKey }) {
  const response = await fetchWithTimeout(anthropicMessagesUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: profile.apiModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Anthropic')
    const err = new Error(message)
    err.httpStatus = response.status
    err.provider = 'anthropic'
    throw err
  }
  const data = await response.json()
  const blocks = data.content || []
  const text = blocks.map((b) => (b.type === 'text' ? b.text : '')).join('')
  if (!text.trim()) {
    const stop = data.stop_reason || ''
    throw new Error(
      stop
        ? `Anthropic returned no text (stop_reason: ${stop}). Try again.`
        : 'Anthropic returned an empty response.',
    )
  }
  return text
}

function geminiModelUsesThinking(modelId) {
  return /gemini-3/i.test(String(modelId || ''))
}

function geminiGenerationConfig(modelId) {
  const config = {
    temperature: 0.9,
    maxOutputTokens: 8192,
  }
  // Gemini 3+ defaults to deep thinking; that meta must not land in LinkedIn copy.
  if (geminiModelUsesThinking(modelId)) {
    config.thinkingConfig = { thinkingLevel: 'minimal' }
  }
  return config
}

function geminiExtractText(data) {
  const cand = data.candidates?.[0]
  const parts = cand?.content?.parts
  const text = Array.isArray(parts)
    ? parts
        .filter((p) => p && !p.thought && p.type !== 'thought')
        .map((p) => p.text || '')
        .join('')
    : ''
  if (text.trim()) return text

  const block = data.promptFeedback?.blockReason
  if (block) {
    throw new Error(
      `Gemini blocked the prompt (${block}). Try a different topic or shorten your optional angle.`,
    )
  }
  const reason = cand?.finishReason || ''
  if (reason === 'SAFETY') {
    throw new Error('Gemini stopped for safety filters. Rephrase the angle or try again.')
  }
  if (reason === 'MAX_TOKENS') {
    throw new Error('Gemini hit the output token limit with no visible text. Try again.')
  }
  if (data.error?.message) throw new Error(String(data.error.message))
  throw new Error(reason ? `Gemini returned no text (finish: ${reason}).` : 'Gemini returned an empty response.')
}

async function callGemini(profile, { systemPrompt, userPrompt, apiKey }) {
  const model = encodeURIComponent(profile.apiModel)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: geminiGenerationConfig(profile.apiModel),
    }),
  })
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Gemini')
    const err = new Error(message)
    err.httpStatus = response.status
    err.provider = 'gemini'
    throw err
  }
  const data = await response.json()
  return geminiExtractText(data)
}

async function callProviderOnce(profile, prompts, apiKey) {
  const args = { ...prompts, apiKey }
  if (profile.provider === 'openai') return callOpenAi(profile, args)
  if (profile.provider === 'anthropic') return callAnthropic(profile, args)
  if (profile.provider === 'gemini') return callGemini(profile, args)
  throw new Error(`Unknown provider: ${profile.provider}`)
}

async function callProviderWithRetries(profile, prompts, apiKey) {
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callProviderOnce(profile, prompts, apiKey)
    } catch (e) {
      lastErr = e
      if (attempt === 0 && isRetryableTransportError(e)) {
        await sleep(1600)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

/**
 * @param {{ provider: string, apiModel: string, label?: string, fallbackApiModels?: string[] }} profile
 * @param {{ systemPrompt: string, userPrompt: string, apiKey: string }} args
 * @returns {Promise<string>} raw assistant text
 */
export async function generateRawCompletion(profile, { systemPrompt, userPrompt, apiKey }) {
  const key = (apiKey || '').trim()
  if (!key) throw new Error(`${profile.label || 'Model'}: API key missing. Add it under API Keys.`)

  const prompts = preparePromptsForLlm(systemPrompt, userPrompt)
  const modelIds = resolveApiModelsForProfile(profile)

  let lastErr
  for (let i = 0; i < modelIds.length; i++) {
    const apiModel = modelIds[i]
    const effective = { ...profile, apiModel }
    try {
      return await callProviderWithRetries(effective, prompts, key)
    } catch (e) {
      lastErr = e
      const canTryNext = i < modelIds.length - 1 && isFallbackableModelError(e)
      if (!canTryNext) {
        throw new Error(labelProviderError(profile, apiModel, e?.message || 'Request failed'))
      }
    }
  }
  throw new Error(labelProviderError(profile, modelIds[modelIds.length - 1], lastErr?.message || 'Request failed'))
}
