/**
 * Private cloud vault (Vercel Blob): voice corpus + API keys per syncId.
 * Requires BLOB_READ_WRITE_TOKEN. syncId = SHA-256 of user sync passphrase (client-side).
 */
import { head, put } from '@vercel/blob'

export const config = {
  maxDuration: 30,
}

const SYNC_ID_RE = /^[a-zA-Z0-9_-]{20,64}$/
const MAX_BYTES = 120_000

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function blobPath(syncId) {
  return `user-vault/${syncId}.json`
}

function sanitizeKeys(raw) {
  const keys = {}
  if (!raw || typeof raw !== 'object') return keys
  const allowed = [
    'openai_key',
    'anthropic_api_key',
    'gemini_api_key',
    'unsplash_access_key',
    'lidp_gnews_api_key',
  ]
  for (const k of allowed) {
    const v = String(raw[k] ?? '').trim()
    if (v) keys[k] = v
  }
  return keys
}

export default async function handler(req, res) {
  setCors(res)

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
      return res.status(200).json({
        corpus: {
          text: String(j.corpus?.text || j.text || ''),
          updated: String(j.corpus?.updated || j.updated || ''),
        },
        keys: sanitizeKeys(j.keys),
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
    const text = String(body?.corpus?.text ?? body?.text ?? '').trim()
    const corpusUpdated = String(body?.corpus?.updated ?? body?.updated ?? new Date().toISOString())
    const keys = sanitizeKeys(body?.keys)
    const updated = String(body?.updated ?? new Date().toISOString())
    const payload = JSON.stringify({
      corpus: { text, updated: corpusUpdated },
      keys,
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
