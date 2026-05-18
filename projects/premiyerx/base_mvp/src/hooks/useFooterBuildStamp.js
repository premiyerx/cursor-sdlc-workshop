import { useState, useEffect } from 'react'

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Unambiguous UTC wall time (avoids "2:19 PM" vs local confusion). */
export function formatUtcIsoInstant(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`
}

function readStampFromDocument() {
  if (typeof document === 'undefined') return { time: '', sha: '' }
  const metaIso = document.querySelector('meta[name="app-built-at-iso"]')?.getAttribute('content')?.trim() || ''
  const sha = document.querySelector('meta[name="app-build"]')?.getAttribute('content')?.trim() || ''
  const human = document.querySelector('meta[name="app-built-at"]')?.getAttribute('content')?.trim() || ''
  const w = typeof window !== 'undefined' ? window.__LIDP_BUILD_STAMP__ : undefined
  const isoFromWin = w?.iso && String(w.iso).trim()
  const iso = metaIso || isoFromWin || ''
  let time = ''
  if (iso) time = formatUtcIsoInstant(iso)
  else if (human) time = human
  else if (w?.builtAt) time = w.builtAt
  return { time, sha: sha || w?.sha || '' }
}

/**
 * Footer build line: prefer document meta, then live /build-stamp.json (bypasses cached HTML/JS).
 */
export function useFooterBuildStamp() {
  const fallbackTime = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''
  const fallbackSha = typeof __DEPLOY_SHA__ !== 'undefined' ? __DEPLOY_SHA__ : ''

  const doc = typeof document !== 'undefined' ? readStampFromDocument() : { time: '', sha: '' }
  const [time, setTime] = useState(doc.time || fallbackTime)
  const [sha, setSha] = useState(doc.sha || fallbackSha)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const url = new URL('/build-stamp.json', window.location.origin)
        url.searchParams.set('_', String(Date.now()))
        const res = await fetch(url.toString(), {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok || cancelled) return
        const j = await res.json()
        if (!j?.iso || cancelled) return
        const t = formatUtcIsoInstant(j.iso)
        if (t) setTime(t)
        if (j.sha) setSha(String(j.sha))
      } catch {
        /* offline */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { time, sha }
}
