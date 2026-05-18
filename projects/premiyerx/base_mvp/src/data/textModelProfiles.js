/**
 * Text models for LinkedIn post generation. API ids are pinned; update here when providers ship new defaults.
 */
export const TEXT_MODEL_PROFILES = [
  {
    id: 'openai-gpt55',
    label: 'GPT 5.5',
    shortLabel: 'OpenAI',
    provider: 'openai',
    apiModel: 'gpt-5.5',
    keyStorage: 'openai',
    keyHint: 'OpenAI API key (sk-…)',
  },
  {
    id: 'anthropic-opus47',
    label: 'Claude Opus 4.7',
    shortLabel: 'Anthropic',
    provider: 'anthropic',
    apiModel: 'claude-opus-4-7',
    keyStorage: 'anthropic',
    keyHint: 'Anthropic API key (sk-ant-…)',
  },
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash (preview)',
    shortLabel: 'Google',
    provider: 'gemini',
    apiModel: 'gemini-3-flash-preview',
    keyStorage: 'gemini',
    keyHint: 'Google AI Studio / Gemini API key',
  },
]

export const DEFAULT_TEXT_MODEL_ID = TEXT_MODEL_PROFILES[0].id

export const COMPARE_TEXT_MODEL_IDS = TEXT_MODEL_PROFILES.map((p) => p.id)

export function getTextModelProfile(id) {
  return TEXT_MODEL_PROFILES.find((p) => p.id === id) || TEXT_MODEL_PROFILES[0]
}
