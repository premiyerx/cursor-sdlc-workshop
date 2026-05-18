/**
 * Bump CACHE_VERSION after meaningful app updates so clients drop old cached assets.
 * HTML navigations are never cached so new index.html (and hashed JS/CSS) loads after deploy.
 */
const CACHE_VERSION = 'v11-srv-stamp'
const CACHE_NAME = `lidp-assets-${CACHE_VERSION}`

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key)
            return undefined
          }),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Always fetch fresh HTML shell so new hashed bundles are referenced after deploy.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Deploy stamp must never hit Cache Storage — otherwise the footer can show an old build time forever.
  if (url.pathname === '/build-stamp.json') {
    event.respondWith(fetch(event.request))
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
