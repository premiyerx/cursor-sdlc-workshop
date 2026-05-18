import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { restoreApiKeysFromVault } from './utils/apiKeyVault'
import App from './App.jsx'
import './index.css'

restoreApiKeysFromVault()
  .catch(() => {
    /* offline / private mode — app still loads */
  })
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    wireProductionUpdateChecks()
  })

function appBuildFromDocument() {
  return document.querySelector('meta[name="app-build"]')?.getAttribute('content')?.trim() || ''
}

async function clearSiteCachesAndSw() {
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch {
      /* ignore */
    }
  }
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    } catch {
      /* ignore */
    }
  }
}

/** Re-fetch the HTML shell and reload when a newer deploy is live (PWA / home-screen installs). */
async function reloadIfNewerBuildAvailable() {
  const local = appBuildFromDocument()
  if (!local || local === 'local') return
  try {
    const url = new URL('/', window.location.origin)
    url.searchParams.set('_buildcheck', String(Date.now()))
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' },
    })
    const html = await res.text()
    const m = html.match(/<meta\s+name="app-build"\s+content="([^"]*)"/i)
    const remote = m?.[1]?.trim()
    if (remote && remote !== local) {
      await clearSiteCachesAndSw()
      window.location.reload()
    }
  } catch {
    /* offline or blocked */
  }
}

function wireProductionUpdateChecks() {
  const go = () => {
    void reloadIfNewerBuildAvailable()
  }
  // Run once on startup so a normal refresh (not only tab focus) can detect a newer deploy.
  queueMicrotask(go)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') go()
  })
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) go()
  })
  window.addEventListener('focus', go)
}
