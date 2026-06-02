/**
 * Shared CORS policy for the API functions.
 *
 * The previous `Access-Control-Allow-Origin: *` turned these endpoints (including the
 * Anthropic relay) into an open proxy any site could call. We instead echo the request
 * origin only when it is one of our own deployments or local dev. Requests with no Origin
 * header (server-to-server, curl, same-origin navigations) are still allowed.
 */

function isAllowedOrigin(origin) {
  if (!origin) return false
  let host
  try {
    host = new URL(origin).hostname
  } catch {
    return false
  }
  if (host === 'localhost' || host === '127.0.0.1') return true
  // Any Vercel production or preview deployment of this app.
  if (host.endsWith('.vercel.app')) return true
  return false
}

export function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  const originRaw = req.headers?.origin
  const origin = Array.isArray(originRaw) ? originRaw[0] : originRaw

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access',
  )
  res.setHeader('Access-Control-Max-Age', '86400')
}
