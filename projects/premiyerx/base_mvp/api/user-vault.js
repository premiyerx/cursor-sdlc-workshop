/**
 * Private cloud vault (Vercel Blob): encrypted API keys + voice corpus per syncId.
 * Requires BLOB_READ_WRITE_TOKEN. syncId = SHA-256 of user sync passphrase (client-side).
 *
 * SECURITY: the blob is publicly reachable, so the client encrypts all secrets
 * (AES-GCM) before upload. This endpoint stores/returns only the opaque `enc`
 * envelope and cleartext timestamps — it never sees plaintext API keys.
 */
import { head, put } from '@vercel/blob'
import { applyCors } from './_cors.js'

export const config = {
  maxDuration: 30,
}

const SYNC_ID_RE = /^[a-zA-Z0-9_-]{20,64}$/
const MAX_BYTES = 200_000

function setCors(req, res) {
  applyCors(req, res, 'GET, PUT, OPTIONS')
}

function blobPath(syncId) {
  return `user-vault/${syncId}.json`
}

/** Accept only a well-formed AES-GCM envelope (opaque ciphertext + base64 metadata). */
function sanitizeEnvelope(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.alg !== 'AES-GCM' || typeof raw.ct !== 'string') return null
  const env = {
    v: Number(raw.v) || 1,
    alg: 'AES-GCM',
    kdf: typeof raw.kdf === 'string' ? raw.kdf.slice(0, 32) : 'PBKDF2-SHA256',
    iter: Number(raw.iter) || 150000,
    salt: String(raw.salt || '').slice(0, 256),
    iv: String(raw.iv || '').slice(0, 128),
    ct: String(raw.ct).slice(0, 180_000),
  }
  if (!env.salt || !env.iv || !env.ct) return null
  return env
}

export default async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: 'cloud_unconfigured',
      message: 'Add a Vercel Blob store to this project (BLOB_READ_WRITE_TOKEN).',
    })
  }

  const rawId = req.method === 'GET' ? req.query?.syncId : req.body?.syncId
  const syncId = (Array.isArray(rawId) ? rawId[0] : rawId) || ''
  if (!SYNC_ID_RE.test(String(syncId))) {
    return res.status(400).json({ error: 'invalid_sync_id' })
  }

  const pathname = blobPath(syncId)

  if (req.method === 'GET') {
    try {
      const meta = await head(pathname)
      if (!meta?.url) {
        return res.status(404).json({ error: 'not_found' })
      }
      const r = await fetch(meta.url, { cache: 'no-store' })
      if (!r.ok) return res.status(404).json({ error: 'not_found' })
      const j = await r.json()
      const env = sanitizeEnvelope(j.enc)
      return res.status(200).json({
        enc: env,
        corpus: { updated: String(j.corpus?.updated || j.updated || '') },
        updated: String(j.updated || ''),
      })
    } catch (e) {
      if (e?.statusCode === 404 || e?.message?.includes('not found')) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.status(500).json({ error: 'read_failed' })
    }
  }

  if (req.method === 'PUT') {
    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        return res.status(400).json({ error: 'invalid_json' })
      }
    }
    const env = sanitizeEnvelope(body?.enc)
    if (!env) {
      // Reject any attempt to store plaintext secrets — clients must encrypt first.
      return res.status(400).json({ error: 'encrypted_payload_required' })
    }
    const corpusUpdated = String(body?.corpus?.updated ?? body?.updated ?? new Date().toISOString())
    const updated = String(body?.updated ?? new Date().toISOString())
    const payload = JSON.stringify({
      enc: env,
      corpus: { updated: corpusUpdated },
      updated,
    })
    if (payload.length > MAX_BYTES) {
      return res.status(413).json({ error: 'too_large' })
    }
    try {
      await put(pathname, payload, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return res.status(200).json({ ok: true, updated })
    } catch {
      return res.status(500).json({ error: 'write_failed' })
    }
  }

  res.setHeader('Allow', 'GET, PUT, OPTIONS')
  return res.status(405).json({ error: 'method_not_allowed' })
}
