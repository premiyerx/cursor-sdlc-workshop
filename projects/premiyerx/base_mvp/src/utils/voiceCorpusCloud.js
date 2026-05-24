/**
 * Cloud backup for voice corpus via /api/user-vault.
 */
import { getCloudSyncId } from './cloudSync.js'
import { hasCloudSyncPassphrase } from './cloudSync.js'
import { getVaultSyncId, fetchCloudVault, pushCloudVault, collectLocalVaultSnapshot } from './userVaultCloud.js'

export function getCorpusSyncId() {
  return getCloudSyncId()
}

export async function fetchCloudCorpusMeta() {
  if (!hasCloudSyncPassphrase()) {
    const id = await getVaultSyncId()
    if (!id) return { ok: false, reason: 'no_sync_id' }
  }
  const cloud = await fetchCloudVault()
  if (!cloud.ok) return cloud
  return {
    ok: true,
    text: cloud.corpus.text,
    updated: cloud.corpus.updated,
  }
}

export async function pushCloudCorpus(text, updatedIso) {
  const snap = collectLocalVaultSnapshot()
  snap.corpus = { text: (text || '').trim(), updated: updatedIso || new Date().toISOString() }
  return pushCloudVault(snap)
}

/** Prefer newer of local vs cloud; write winner back to both stores. */
export async function mergeVoiceCorpusWithCloud(localGet, localPut) {
  if (!hasCloudSyncPassphrase()) {
    const local = localGet()
    return { merged: local, cloud: { ok: false, reason: 'no_passphrase' }, pulled: false }
  }

  const local = localGet()
  const cloud = await fetchCloudCorpusMeta()
  if (!cloud.ok) return { merged: local, cloud, pulled: false }

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
