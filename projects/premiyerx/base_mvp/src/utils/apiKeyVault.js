/**
 * Persists API keys across app updates: primary + backup in localStorage,
 * plus IndexedDB as a second line of defense if the browser trims storage.
 * All reads/writes stay on-device (no server).
 */

const BAK = '__lidp_bak_v1'
const IDB_NAME = 'lidp_api_keys_v1'
const IDB_STORE = 'keys'
const TRACKED_KEYS = ['openai_key', 'anthropic_api_key', 'gemini_api_key', 'unsplash_access_key']

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

function idbPutDeferred(storageKey, value) {
  void idbOpen()
    .then((db) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        if (value) tx.objectStore(IDB_STORE).put(value, storageKey)
        else tx.objectStore(IDB_STORE).delete(storageKey)
        tx.oncomplete = () => {
          try {
            db.close()
          } catch {
            /* ignore */
          }
        }
        tx.onerror = () => {
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

/** Sync read: primary → backup (self-heal primary if backup exists). */
export function vaultGetSync(storageKey) {
  if (typeof localStorage === 'undefined') return ''
  try {
    let v = (localStorage.getItem(storageKey) || '').trim()
    if (v) return v
    const bak = (localStorage.getItem(storageKey + BAK) || '').trim()
    if (bak) {
      try {
        localStorage.setItem(storageKey, bak)
      } catch {
        /* ignore */
      }
      return bak
    }
  } catch {
    /* private mode / blocked */
  }
  return ''
}

/** Sync write to localStorage (+ backup); IDB update is async and best-effort. */
export function vaultPutSync(storageKey, trimmed) {
  const v = (trimmed || '').trim()
  if (typeof localStorage === 'undefined') return
  try {
    if (v) {
      localStorage.setItem(storageKey, v)
      localStorage.setItem(storageKey + BAK, v)
    } else {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(storageKey + BAK)
    }
  } catch {
    /* quota / blocked */
  }
  idbPutDeferred(storageKey, v || undefined)
}

/**
 * Run once at startup (before React): if primary+backup are empty, pull from IndexedDB
 * and repopulate localStorage so the rest of the app keeps using the same keys.
 */
export async function restoreApiKeysFromVault() {
  let db
  try {
    db = await idbOpen()
  } catch {
    return
  }
  await Promise.all(
    TRACKED_KEYS.map(
      (k) =>
        new Promise((resolve) => {
          try {
            const tx = db.transaction(IDB_STORE, 'readonly')
            const req = tx.objectStore(IDB_STORE).get(k)
            req.onsuccess = () => {
              const idbVal = typeof req.result === 'string' ? req.result.trim() : ''
              const cur = vaultGetSync(k)
              if (!cur && idbVal) {
                try {
                  localStorage.setItem(k, idbVal)
                  localStorage.setItem(k + BAK, idbVal)
                } catch {
                  /* ignore */
                }
              }
              resolve()
            }
            req.onerror = () => resolve()
          } catch {
            resolve()
          }
        }),
    ),
  )
  try {
    db.close()
  } catch {
    /* ignore */
  }

  for (const k of TRACKED_KEYS) {
    const v = vaultGetSync(k)
    if (v) idbPutDeferred(k, v)
  }
}
