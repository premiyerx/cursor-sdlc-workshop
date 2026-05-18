import { vaultGetSync, vaultPutSync } from './apiKeyVault'

const STORAGE_KEY = 'openai_key'
/** Same-tab mirror only (clears when the tab closes); not a substitute for vault backups. */
const SESSION_MIRROR = 'openai_key_session_mirror'

export function getOpenAiKey() {
  try {
    const v = vaultGetSync(STORAGE_KEY)
    if (v) {
      try {
        sessionStorage.setItem(SESSION_MIRROR, v)
      } catch {
        /* ignore */
      }
      return v
    }
    return (sessionStorage.getItem(SESSION_MIRROR) || '').trim()
  } catch {
    return ''
  }
}

export function saveOpenAiKey(key) {
  const trimmed = (key || '').trim()
  try {
    if (trimmed) {
      vaultPutSync(STORAGE_KEY, trimmed)
      try {
        sessionStorage.setItem(SESSION_MIRROR, trimmed)
      } catch {
        /* ignore */
      }
      return { ok: true, cleared: false }
    }
    vaultPutSync(STORAGE_KEY, '')
    try {
      sessionStorage.removeItem(SESSION_MIRROR)
    } catch {
      /* ignore */
    }
    return { ok: true, cleared: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save key on this device.' }
  }
}

export function hasOpenAiKey() {
  const key = getOpenAiKey()
  return key.length >= 20
}

export function getOpenAiKeyStatus() {
  const key = getOpenAiKey()
  if (!key) {
    return { saved: false, lastFour: '', label: 'No OpenAI key saved' }
  }
  return {
    saved: true,
    lastFour: key.slice(-4),
    label: `OpenAI key saved (•••${key.slice(-4)})`,
  }
}
