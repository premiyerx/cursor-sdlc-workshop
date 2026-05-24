/**
 * Cross-device sync identity: same passphrase on laptop + phone → same Vercel Blob path.
 * Passphrase stays in localStorage on each device after you save it once (not sent except as derived id).
 */

const PASS_KEY = 'lidp_cloud_sync_passphrase'
const SYNC_ID_KEY = 'lidp_corpus_sync_id'

export async function deriveSyncIdFromPassphrase(passphrase) {
  const normalized = String(passphrase || '').trim().toLowerCase()
  if (normalized.length < 8) return ''
  if (typeof crypto === 'undefined' || !crypto.subtle?.digest) return ''
  const enc = new TextEncoder().encode(normalized)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

export function getSavedSyncPassphrase() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return (localStorage.getItem(PASS_KEY) || '').trim()
  } catch {
    return ''
  }
}

/** Save passphrase on this device and refresh derived sync id. */
export async function saveSyncPassphrase(passphrase) {
  const p = String(passphrase || '').trim()
  if (p.length < 8) {
    return { ok: false, error: 'Use at least 8 characters (same phrase on phone and laptop).' }
  }
  const syncId = await deriveSyncIdFromPassphrase(p)
  if (!syncId) return { ok: false, error: 'Could not derive sync id in this browser.' }
  try {
    localStorage.setItem(PASS_KEY, p)
    localStorage.setItem(SYNC_ID_KEY, syncId)
    return { ok: true, syncId }
  } catch {
    return { ok: false, error: 'Browser storage blocked.' }
  }
}

export function clearSyncPassphrase() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(PASS_KEY)
    localStorage.removeItem(SYNC_ID_KEY)
  } catch {
    /* ignore */
  }
}

export function hasCloudSyncPassphrase() {
  return getSavedSyncPassphrase().length >= 8
}

/** Sync id for Blob path — from saved passphrase, or legacy random id if present. */
export function getCloudSyncId() {
  if (typeof localStorage === 'undefined') return ''
  try {
    const fromPass = (localStorage.getItem(SYNC_ID_KEY) || '').trim()
    if (fromPass && /^[a-f0-9]{32}$/.test(fromPass)) return fromPass
    const legacy = (localStorage.getItem(SYNC_ID_KEY) || '').trim()
    if (legacy && legacy.length >= 20) return legacy
  } catch {
    /* ignore */
  }
  return ''
}

export async function ensureCloudSyncIdFromPassphrase() {
  const p = getSavedSyncPassphrase()
  if (!p) return getCloudSyncId()
  const id = await deriveSyncIdFromPassphrase(p)
  if (id && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SYNC_ID_KEY, id)
    } catch {
      /* ignore */
    }
  }
  return id || getCloudSyncId()
}
