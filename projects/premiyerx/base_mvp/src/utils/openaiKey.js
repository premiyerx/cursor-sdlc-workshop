const STORAGE_KEY = 'openai_key'
const BACKUP_KEY = 'openai_key_backup'

export function getOpenAiKey() {
  try {
    const fromLocal = (localStorage.getItem(STORAGE_KEY) || '').trim()
    if (fromLocal) return fromLocal
    return (sessionStorage.getItem(BACKUP_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function saveOpenAiKey(key) {
  const trimmed = (key || '').trim()
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed)
      sessionStorage.setItem(BACKUP_KEY, trimmed)
      return { ok: true, cleared: false }
    }
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(BACKUP_KEY)
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
