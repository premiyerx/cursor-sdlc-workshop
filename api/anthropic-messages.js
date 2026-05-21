/**
 * Browser-safe bridge: Anthropic's API does not allow direct browser CORS calls.
 * Deployed at repo root so Vercel serves POST /api/anthropic-messages (not caught by SPA rewrite).
 */
export const config = {
  maxDuration: 60,
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  )
  res.setHeader('Access-Control-Max-Age', '86400')
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: { type: 'method', message: 'Method not allowed' } })
  }

  const key = req.headers['x-api-key']
  if (!key || typeof key !== 'string') {
    return res.status(401).json({
      error: { type: 'auth', message: 'Missing x-api-key (paste your Anthropic key in API Keys).' },
    })
  }

  const anthVersionRaw = req.headers['anthropic-version'] || '2023-06-01'
  const anthVersion = Array.isArray(anthVersionRaw) ? anthVersionRaw[0] : anthVersionRaw

  const bodyString =
    typeof req.body === 'string' ? req.body : req.body != null ? JSON.stringify(req.body) : '{}'

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': anthVersion,
    },
    body: bodyString,
  })

  const text = await upstream.text()
  const ct = upstream.headers.get('content-type') || 'application/json'
  res.status(upstream.status).setHeader('Content-Type', ct).send(text)
}
