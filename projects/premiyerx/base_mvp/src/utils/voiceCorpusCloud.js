/**
 * Cloud backup for voice corpus via /api/voice-corpus (Vercel Blob when BLOB_READ_WRITE_TOKEN is set).
 */

const SYNC_ID_KEY = 'lidp_corpus_sync_id'

export function getCorpusSyncId() {
  if (typeof localStorage === 'undefined') return ''
  try {
    let id = (localStorage.getItem(SYNC_ID_KEY) || '').trim()
    if (!id && typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID().replace(/-/g, '')
      localStorage.setItem(SYNC_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export async function fetchCloudCorpusMeta() {
  const syncId = getCorpusSyncId()
  if (!syncId) return { ok: false, reason: 'no_sync_id' }
  try {
    const url = new URL('/api/voice-corpus', window.location.origin)
    url.searchParams.set('syncId', syncId)
    url.searchParams.set('_', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (res.status === 503) return { ok: false, reason: 'cloud_unconfigured' }
    if (!res.ok) return { ok: false, reason: 'not_found' }
    const j = await res.json()
    return {
      ok: true,
      text: String(j.text || '').trim(),
      updated: String(j.updated || '').trim(),
    }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function pushCloudCorpus(text, updatedIso) {
  const syncId = getCorpusSyncId()
  if (!syncId) return { ok: false, reason: 'no_sync_id' }
  try {
    const res = await fetch('/api/voice-corpus', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        syncId,
        text: (text || '').trim(),
        updated: updatedIso || new Date().toISOString(),
      }),
    })
    if (res.status === 503) return { ok: false, reason: 'cloud_unconfigured' }
    if (!res.ok) return { ok: false, reason: 'upload_failed' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

/** Prefer newer of local vs cloud; write winner back to both stores. */
export async function mergeVoiceCorpusWithCloud(localGet, localPut) {
  const local = localGet()
  const cloud = await fetchCloudCorpusMeta()
  if (!cloud.ok) return { merged: local, cloud }

  const localMs = Date.parse(local.updated || '') || 0
  const cloudMs = Date.parse(cloud.updated || '') || 0
  const cloudHasText = cloud.text.length >= 80

  if (cloudHasText && cloudMs > localMs && cloud.text !== local.text) {
    localPut(cloud.text, cloud.updated)
    return { merged: { text: cloud.text, updated: cloud.updated }, cloud, pulled: true }
  }

  if (local.text.length >= 80 && (localMs >= cloudMs || !cloudHasText)) {
    void pushCloudCorpus(local.text, local.updated)
  }

  return { merged: local, cloud, pulled: false }
}
