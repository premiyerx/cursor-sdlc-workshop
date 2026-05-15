/**
 * Server-side OpenAI image proxy.
 * Uses GPT image models only — never sends response_format (rejected by current API).
 */
export const config = {
  maxDuration: 60,
}

const GPT_IMAGE_MODELS = new Set([
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
  'gpt-image-2',
])

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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { apiKey, prompt, model, size, quality } = req.body || {}
  const key = (apiKey || process.env.OPENAI_API_KEY || '').trim()

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing OpenAI API key', status: 400 })
  }
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'Missing prompt', status: 400 })
  }

  const imageModel = GPT_IMAGE_MODELS.has(model) ? model : 'gpt-image-1.5'
  const body = buildOpenAiBody({ model: imageModel, prompt, size, quality })

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
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
      return res.status(500).json({
        ok: false,
        error: 'OpenAI returned no image data',
        status: 500,
        model: imageModel,
      })
    }

    return res.status(200).json({
      ok: true,
      b64,
      model: imageModel,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error calling OpenAI',
      status: 500,
      model: imageModel,
    })
  }
}
