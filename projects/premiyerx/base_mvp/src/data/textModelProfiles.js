/**
 * Text models for LinkedIn post generation. API ids are pinned; update here when providers ship new defaults.
 * fallbackApiModels: tried in order if the primary id is unavailable or returns a model-not-found error.
 */
export const TEXT_MODEL_PROFILES = [
  {
    id: 'openai-gpt55',
    label: 'GPT 5.5',
    shortLabel: 'OpenAI',
    provider: 'openai',
    apiModel: 'gpt-5.5',
    fallbackApiModels: ['gpt-5-mini', 'gpt-4o'],
    keyStorage: 'openai',
    keyHint: 'OpenAI API key (sk-…)',
  },
  {
    id: 'anthropic-opus48',
    label: 'Claude Opus 4.8',
    shortLabel: 'Anthropic',
    provider: 'anthropic',
    apiModel: 'claude-opus-4-8',
    fallbackApiModels: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-3-5-sonnet-20241022'],
    keyStorage: 'anthropic',
    keyHint: 'Anthropic API key (sk-ant-…)',
  },
  {
    id: 'gemini-35-flash',
    label: 'Gemini 3.5 Flash',
    shortLabel: 'Google',
    provider: 'gemini',
    apiModel: 'gemini-3.5-flash',
    fallbackApiModels: ['gemini-2.5-flash', 'gemini-3-flash-preview'],
    keyStorage: 'gemini',
    keyHint: 'Google AI Studio / Gemini API key',
  },
]

export const DEFAULT_TEXT_MODEL_ID = TEXT_MODEL_PROFILES[0].id

export const COMPARE_TEXT_MODEL_IDS = TEXT_MODEL_PROFILES.map((p) => p.id)

export function getTextModelProfile(id) {
  return TEXT_MODEL_PROFILES.find((p) => p.id === id) || TEXT_MODEL_PROFILES[0]
}

/** Ordered API model ids for one profile (primary + fallbacks, deduped). */
export function resolveApiModelsForProfile(profile) {
  const seen = new Set()
  const out = []
  for (const m of [profile?.apiModel, ...(profile?.fallbackApiModels || [])]) {
    const id = String(m || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.length ? out : ['']
}
