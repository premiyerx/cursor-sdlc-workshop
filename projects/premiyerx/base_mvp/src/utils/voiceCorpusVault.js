/**
 * Voice corpus persistence: localStorage + backup + IndexedDB (survives many app updates).
 * Pair with voiceCorpusCloud.js for cross-device sync when Vercel Blob is configured.
 */

const CORPUS_KEY = 'lidp_voice_corpus'
const CORPUS_DATE_KEY = 'lidp_voice_corpus_updated'
const CORPUS_BAK = '__lidp_corpus_bak_v1'
const IDB_NAME = 'lidp_voice_corpus_v1'
const IDB_STORE = 'corpus'

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no idb'))
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPutDeferred(record) {
  void idbOpen()
    .then((db) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        if (record?.text) tx.objectStore(IDB_STORE).put(record, 'corpus')
        else tx.objectStore(IDB_STORE).delete('corpus')
        tx.oncomplete = () => {
          try {
            db.close()
          } catch {
            /* ignore */
          }
        }
      } catch {
        try {
          db.close()
        } catch {
          /* ignore */
        }
      }
    })
    .catch(() => {})
}

export function vaultGetCorpusSync() {
  if (typeof localStorage === 'undefined') return { text: '', updated: '' }
  try {
    let text = (localStorage.getItem(CORPUS_KEY) || '').trim()
    let updated = localStorage.getItem(CORPUS_DATE_KEY) || ''
    if (!text) {
      const bak = (localStorage.getItem(CORPUS_KEY + CORPUS_BAK) || '').trim()
      const bakDate = localStorage.getItem(CORPUS_DATE_KEY + CORPUS_BAK) || ''
      if (bak) {
        text = bak
        updated = bakDate
        try {
          localStorage.setItem(CORPUS_KEY, bak)
          if (bakDate) localStorage.setItem(CORPUS_DATE_KEY, bakDate)
        } catch {
          /* ignore */
        }
      }
    }
    return { text, updated }
  } catch {
    return { text: '', updated: '' }
  }
}

export function vaultPutCorpusSync(text, updatedIso) {
  const trimmed = (text || '').trim()
  const updated = updatedIso || new Date().toISOString()
  if (typeof localStorage === 'undefined') return
  try {
    if (trimmed) {
      localStorage.setItem(CORPUS_KEY, trimmed)
      localStorage.setItem(CORPUS_DATE_KEY, updated)
      localStorage.setItem(CORPUS_KEY + CORPUS_BAK, trimmed)
      localStorage.setItem(CORPUS_DATE_KEY + CORPUS_BAK, updated)
    } else {
      localStorage.removeItem(CORPUS_KEY)
      localStorage.removeItem(CORPUS_DATE_KEY)
      localStorage.removeItem(CORPUS_KEY + CORPUS_BAK)
      localStorage.removeItem(CORPUS_DATE_KEY + CORPUS_BAK)
    }
  } catch {
    /* quota */
  }
  idbPutDeferred(trimmed ? { text: trimmed, updated } : null)
}

/** On startup: restore localStorage from IndexedDB if primary storage was cleared. */
export async function restoreVoiceCorpusFromVault() {
  const cur = vaultGetCorpusSync()
  if (cur.text.length >= 80) return cur

  let db
  try {
    db = await idbOpen()
  } catch {
    return cur
  }

  const record = await new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get('corpus')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  try {
    db.close()
  } catch {
    /* ignore */
  }

  if (record?.text && String(record.text).trim().length >= 80) {
    vaultPutCorpusSync(record.text, record.updated)
    return vaultGetCorpusSync()
  }
  return cur
}
