import { vaultGetSync, vaultPutSync } from './apiKeyVault'

const ANTHROPIC_KEY = 'anthropic_api_key'
const GEMINI_KEY = 'gemini_api_key'

export function getAnthropicKey() {
  try {
    return vaultGetSync(ANTHROPIC_KEY)
  } catch {
    return ''
  }
}

export function saveAnthropicKey(key) {
  const trimmed = (key || '').trim()
  try {
    vaultPutSync(ANTHROPIC_KEY, trimmed)
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save Anthropic key.' }
  }
}

export function hasAnthropicKey() {
  return getAnthropicKey().length >= 20
}

export function getAnthropicKeyStatus() {
  const key = getAnthropicKey()
  if (!key) return { saved: false, lastFour: '' }
  return { saved: true, lastFour: key.slice(-4) }
}

export function getGeminiKey() {
  try {
    return vaultGetSync(GEMINI_KEY)
  } catch {
    return ''
  }
}

export function saveGeminiKey(key) {
  const trimmed = (key || '').trim()
  try {
    vaultPutSync(GEMINI_KEY, trimmed)
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save Gemini key.' }
  }
}

export function hasGeminiKey() {
  return getGeminiKey().length >= 16
}

export function getGeminiKeyStatus() {
  const key = getGeminiKey()
  if (!key) return { saved: false, lastFour: '' }
  return { saved: true, lastFour: key.slice(-4) }
}
