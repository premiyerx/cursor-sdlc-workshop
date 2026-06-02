/**
 * Server-side OpenAI image proxy (GPT image models only).
 *
 * Keeps the user's OpenAI key off the public internet (sent server→OpenAI over TLS) and
 * removes a doomed client round-trip: previously this route did not exist in this project,
 * so every infographic/carousel image attempt failed the proxy call before falling back
 * to a direct browser request. Mirrors the repo-root proxy contract: { ok, b64, model }.
 */
import { applyCors } from './_cors.js'

export const config = {
  maxDuration: 60,
}

const GPT_IMAGE_MODELS = new Set(['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'gpt-image-2'])

function buildOpenAiBody({ model, prompt, size, quality }) {
  const m = GPT_IMAGE_MODELS.has(model) ? model : 'gpt-image-1.5'
  return {
    model: m,
    prompt: String(prompt).slice(0, 32000),
    n: 1,
    size: size || '1536x1024',
    quality: quality || 'medium',
    output_format: 'png',
    moderation: 'low',
  }
}

async function extractBase64(data) {
  const item = data?.data?.[0]
  if (!item) return null
  if (item.b64_json) return item.b64_json
  if (item.url) {
    const imgRes = await fetch(item.url)
    if (!imgRes.ok) return null
    const buf = Buffer.from(await imgRes.arrayBuffer())
    return buf.toString('base64')
  }
  return null
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid_json', status: 400 })
    }
  }

  const { apiKey, prompt, model, size, quality } = body || {}
  const key = (apiKey || process.env.OPENAI_API_KEY || '').trim()

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing OpenAI API key', status: 400 })
  }
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'Missing prompt', status: 400 })
  }

  const imageModel = GPT_IMAGE_MODELS.has(model) ? model : 'gpt-image-1.5'

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(buildOpenAiBody({ model: imageModel, prompt, size, quality })),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.error?.message || `OpenAI HTTP ${response.status}`,
        status: response.status,
        model: imageModel,
      })
    }

    const b64 = await extractBase64(data)
    if (!b64) {
      return res.status(500).json({ ok: false, error: 'OpenAI returned no image data', status: 500, model: imageModel })
    }

    return res.status(200).json({ ok: true, b64, model: imageModel })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error calling OpenAI',
      status: 500,
      model: imageModel,
    })
  }
}
