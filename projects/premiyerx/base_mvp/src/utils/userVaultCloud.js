/**
 * Cloud vault: voice corpus + API keys via /api/user-vault (Vercel Blob).
 */
import { ensureCloudSyncIdFromPassphrase, hasCloudSyncPassphrase } from './cloudSync.js'
import { vaultGetSync, vaultPutSync, TRACKED_VAULT_KEYS } from './apiKeyVault.js'
import { vaultGetCorpusSync, vaultPutCorpusSync } from './voiceCorpusVault.js'

let pushTimer = null

export async function getVaultSyncId() {
  return ensureCloudSyncIdFromPassphrase()
}

export function collectLocalVaultSnapshot() {
  const corpus = vaultGetCorpusSync()
  const keys = {}
  for (const k of TRACKED_VAULT_KEYS) {
    const v = vaultGetSync(k)
    if (v) keys[k] = v
  }
  return {
    corpus: { text: corpus.text, updated: corpus.updated },
    keys,
    updated: new Date().toISOString(),
  }
}

export async function fetchCloudVault() {
  const syncId = await getVaultSyncId()
  if (!syncId) return { ok: false, reason: 'no_sync_id' }
  try {
    const url = new URL('/api/user-vault', window.location.origin)
    url.searchParams.set('syncId', syncId)
    url.searchParams.set('_', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (res.status === 503) return { ok: false, reason: 'cloud_unconfigured' }
    if (!res.ok) return { ok: false, reason: 'not_found' }
    const j = await res.json()
    return {
      ok: true,
      corpus: {
        text: String(j.corpus?.text || '').trim(),
        updated: String(j.corpus?.updated || '').trim(),
      },
      keys: j.keys && typeof j.keys === 'object' ? j.keys : {},
      updated: String(j.updated || '').trim(),
    }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export async function pushCloudVault(snapshot) {
  const syncId = await getVaultSyncId()
  if (!syncId) return { ok: false, reason: 'no_sync_id' }
  const body = snapshot || collectLocalVaultSnapshot()
  try {
    const res = await fetch('/api/user-vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ syncId, ...body }),
    })
    if (res.status === 503) return { ok: false, reason: 'cloud_unconfigured' }
    if (!res.ok) return { ok: false, reason: 'upload_failed' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network' }
  }
}

export function schedulePushUserVault() {
  if (typeof window === 'undefined') return
  if (!hasCloudSyncPassphrase()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushCloudVault()
  }, 700)
}

/** Startup merge: pull newer cloud corpus + keys; push local if newer. */
export async function mergeUserVaultWithCloud() {
  if (!hasCloudSyncPassphrase()) {
    return { merged: false, reason: 'no_passphrase' }
  }

  const local = collectLocalVaultSnapshot()
  const cloud = await fetchCloudVault()
  if (!cloud.ok) {
    if (local.corpus.text.length >= 80 || Object.keys(local.keys).length > 0) {
      void pushCloudVault(local)
    }
    return { merged: false, cloud }
  }

  const cloudMs = Date.parse(cloud.updated || '') || 0
  const localMs = Date.parse(local.updated || '') || 0
  const corpusCloudMs = Date.parse(cloud.corpus.updated || '') || 0
  const corpusLocalMs = Date.parse(local.corpus.updated || '') || 0

  let pulled = false

  if (cloud.corpus.text.length >= 80 && corpusCloudMs > corpusLocalMs && cloud.corpus.text !== local.corpus.text) {
    vaultPutCorpusSync(cloud.corpus.text, cloud.corpus.updated)
    pulled = true
  }

  if (cloud.keys && Object.keys(cloud.keys).length > 0 && cloudMs >= localMs) {
    for (const k of TRACKED_VAULT_KEYS) {
      const v = String(cloud.keys[k] || '').trim()
      if (v && !vaultGetSync(k)) vaultPutSync(k, v)
      else if (v && cloudMs > localMs) vaultPutSync(k, v)
    }
    pulled = true
  }

  const freshLocal = collectLocalVaultSnapshot()
  const freshMs = Date.parse(freshLocal.updated || '') || 0
  if (!pulled && (freshMs >= cloudMs || cloud.reason === 'not_found')) {
    void pushCloudVault(freshLocal)
  } else if (pulled) {
    void pushCloudVault(collectLocalVaultSnapshot())
  }

  return { merged: true, cloud, pulled }
}
