/**
 * Cloud voice corpus store (Vercel Blob). Requires BLOB_READ_WRITE_TOKEN on the Vercel project.
 * Each browser gets a syncId (UUID in localStorage); corpus is private to that id unless shared.
 */
import { head, put } from '@vercel/blob'

export const config = {
  maxDuration: 30,
}

const SYNC_ID_RE = /^[a-zA-Z0-9_-]{20,64}$/

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function blobPath(syncId) {
  return `voice-corpus/${syncId}.json`
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
        text: String(j.text || ''),
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
    const text = String(body?.text ?? '').trim()
    const updated = String(body?.updated ?? new Date().toISOString())
    if (text.length > 200_000) {
      return res.status(413).json({ error: 'too_large' })
    }
    try {
      await put(pathname, JSON.stringify({ text, updated }), {
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
