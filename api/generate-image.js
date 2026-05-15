/**
 * Server-side OpenAI image proxy — avoids browser CORS issues and uses correct
 * parameters per model (GPT image vs DALL-E 3).
 */
export const config = {
  maxDuration: 60,
}

function buildOpenAiBody({ model, prompt, size, quality, style }) {
  const m = model || 'gpt-image-1.5'
  if (m.startsWith('gpt-image')) {
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
  const body = {
    model: 'dall-e-3',
    prompt: String(prompt).slice(0, 4000),
    n: 1,
    size: size || '1792x1024',
    quality: quality || 'standard',
    response_format: 'b64_json',
  }
  if (style) body.style = style
  return body
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { apiKey, prompt, model, size, quality, style } = req.body || {}
  const key = (apiKey || process.env.OPENAI_API_KEY || '').trim()

  if (!key) {
    return res.status(400).json({ ok: false, error: 'Missing OpenAI API key', status: 400 })
  }
  if (!prompt) {
    return res.status(400).json({ ok: false, error: 'Missing prompt', status: 400 })
  }

  const imageModel = model || 'gpt-image-1.5'
  const body = buildOpenAiBody({ model: imageModel, prompt, size, quality, style })

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

    const b64 = data.data?.[0]?.b64_json
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
      revised_prompt: data.data?.[0]?.revised_prompt || null,
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
