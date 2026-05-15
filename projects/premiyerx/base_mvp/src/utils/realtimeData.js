import { fnv1a, headlinePromptOffset } from './generationVariety'
import { researchForTopic } from '../data/topicIntel'

const CACHE_KEY = 'lidp_realtime_cache'
/** Soft TTL when not forcing refresh — still bypassed on every Generate via forceRefresh. */
const CACHE_TTL = 4 * 60 * 60 * 1000

const GNEWS_KEY_STORAGE = 'lidp_gnews_api_key'
const GNEWS_KEY_SAVED_AT = 'lidp_gnews_api_key_saved_at'

export function getGnewsApiKey() {
  try {
    const k = localStorage.getItem(GNEWS_KEY_STORAGE)?.trim()
    if (k) return k
  } catch { /* ignore */ }
  const env = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GNEWS_API_KEY
  return (env && String(env).trim()) || 'demo'
}

export function isGnewsKeyConfigured() {
  const k = getGnewsApiKey()
  return !!k && k !== 'demo'
}

export function getGnewsKeyMeta() {
  try {
    return {
      configured: isGnewsKeyConfigured(),
      savedAt: localStorage.getItem(GNEWS_KEY_SAVED_AT) || '',
      lastFour: (() => {
        const k = localStorage.getItem(GNEWS_KEY_STORAGE)?.trim()
        return k && k.length >= 4 ? k.slice(-4) : ''
      })(),
    }
  } catch {
    return { configured: false, savedAt: '', lastFour: '' }
  }
}

/** @returns {{ ok: boolean, cleared?: boolean, error?: string }} */
export function saveGnewsApiKey(key) {
  try {
    const trimmed = key?.trim() || ''
    if (trimmed) {
      localStorage.setItem(GNEWS_KEY_STORAGE, trimmed)
      localStorage.setItem(GNEWS_KEY_SAVED_AT, new Date().toISOString().slice(0, 10))
    } else {
      localStorage.removeItem(GNEWS_KEY_STORAGE)
      localStorage.removeItem(GNEWS_KEY_SAVED_AT)
    }
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save (browser storage blocked?)'
    return { ok: false, error: message }
  }
}

function calendarDayUtc() {
  return new Date().toISOString().slice(0, 10)
}

function getCachedData(topicId) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const entry = cache[topicId]
    const today = calendarDayUtc()
    if (entry && entry.day === today && Date.now() - entry.ts < CACHE_TTL) {
      return entry.data
    }
  } catch { /* ignore */ }
  return null
}

function setCachedData(topicId, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    cache[topicId] = { data, ts: Date.now(), day: calendarDayUtc() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

/** Drop cached research so the next fetch hits the network (optional: one topic or entire cache). */
export function invalidateRealtimeCache(topicId = null) {
  try {
    if (topicId == null) {
      localStorage.removeItem(CACHE_KEY)
      return
    }
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    delete cache[topicId]
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

function headlineKey(h) {
  return (h.title || '').toLowerCase().trim().slice(0, 140)
}

async function fetchHackerNewsStories(query, hitsPerPage = 10) {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${hitsPerPage}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.hits) return []
  return data.hits.map((h) => ({
    title: h.title,
    source: 'Hacker News',
    date: h.created_at?.split('T')[0] || '',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points,
    objectID: String(h.objectID),
  }))
}

async function fetchGNewsHeadlines(query) {
  const apiKey = getGnewsApiKey()
  const gNewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=8&sortby=publishedAt&apikey=${encodeURIComponent(apiKey)}`
  const res = await fetch(gNewsUrl)
  if (!res.ok) return []
  const data = await res.json()
  if (!data.articles) return []
  return data.articles.map((a) => ({
    title: a.title,
    source: a.source?.name || 'News',
    date: a.publishedAt?.split('T')[0] || '',
    url: a.url,
  }))
}

function mergeHeadlines(groups) {
  const map = new Map()
  for (const list of groups) {
    for (const h of list) {
      const k = headlineKey(h)
      if (!k) continue
      if (!map.has(k)) map.set(k, h)
    }
  }
  const merged = [...map.values()]
  merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return merged.slice(0, 22)
}

/**
 * Pulls multi-source headlines for a topic (parallel HN queries + optional GNews).
 * @param {string} topicId
 * @param {{ forceRefresh?: boolean, topicLabel?: string }} [options]
 */
export async function fetchRealtimeContext(topicId, options = {}) {
  const { forceRefresh = false, topicLabel = '' } = options

  if (!forceRefresh) {
    const cached = getCachedData(topicId)
    if (cached) return cached
  }

  const { hnQueries, gnewsQuery } = researchForTopic(topicId, topicLabel)

  const results = { headlines: [], freshData: [], fetchedAt: new Date().toISOString(), sourcesTried: [] }

  const hnLists = await Promise.all(
    hnQueries.map(async (q) => {
      try {
        const rows = await fetchHackerNewsStories(q, 10)
        results.sourcesTried.push(`HN:${q.slice(0, 48)}… (${rows.length})`)
        return rows
      } catch {
        results.sourcesTried.push(`HN:${q.slice(0, 24)}… (error)`)
        return []
      }
    })
  )

  let gNewsList = []
  try {
    gNewsList = await fetchGNewsHeadlines(gnewsQuery)
    results.sourcesTried.push(`GNews (${gNewsList.length})`)
  } catch {
    results.sourcesTried.push('GNews (error)')
  }

  results.headlines = mergeHeadlines([...hnLists, gNewsList])
  results.freshData = generateFreshDataPoints(topicId)

  setCachedData(topicId, results)
  return results
}

const VERIFIED_DATA_KEY = 'lidp_verified_data'

function getVerifiedOverrides() {
  try {
    return JSON.parse(localStorage.getItem(VERIFIED_DATA_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveVerifiedOverrides(overrides) {
  localStorage.setItem(VERIFIED_DATA_KEY, JSON.stringify(overrides))
}

export function getEditableDataPoints() {
  const overrides = getVerifiedOverrides()
  const defaults = { ...DEFAULT_DATA_POINTS }
  for (const key of Object.keys(defaults)) {
    if (overrides[key]) {
      defaults[key] = overrides[key]
    }
  }
  return defaults
}

const DEFAULT_DATA_POINTS = {
  cursor_users: 'Cursor serves millions of developers with 1M+ daily active users and 50,000+ businesses (Cursor, March 2026)',
  cursor_fortune500: 'Over half of the Fortune 500 use Cursor (Cursor, 2026)',
  cursor_awareness: '69% of developers have heard of Cursor; 18% use it at work (JetBrains Survey, Jan 2026)',
  cursor_valuation: 'Cursor raised $2.3B at a $29B valuation in November 2025, with $2B+ ARR (multiple sources, 2026)',
  ai_tools_market: 'AI-assisted coding tools market projected to reach $22B by 2028 (Gartner, 2025)',
  ai_tools_adoption: '73% of Fortune 500 have active AI dev tool pilots (Gartner, 2025)',
  investment_total: 'AI developer tooling saw $4.2B in funding, 3x YoY (PitchBook, Q4 2025)',
  investment_nrr: 'Top AI dev tool companies averaging 140%+ net revenue retention (Bessemer Cloud Index)',
  cio_priority: '78% of CIOs list AI integration as a top-3 priority (Gartner, 2025)',
  cio_budget: '62% of tech leaders increased AI tooling budgets this year (Deloitte, 2025)',
  cio_talent: '87% of engineering leaders cite talent shortage as top concern (multiple surveys, 2025)',
  roi_speed: 'AI dev tools deliver 30-40% faster time-to-ship (DORA State of DevOps, 2025)',
  roi_savings: '$37K annual savings per developer seat from AI tools (Forrester TEI, 2025)',
  roi_bugs: '25% fewer production bugs with AI-assisted development (DORA, 2025)',
  roi_payback: '6-week average payback period for AI dev tool investment (Forrester, 2025)',
  devsecops_vuln: 'DevSecOps teams using AI tools report 44% fewer critical vulnerabilities (DORA, 2025)',
}

function generateFreshDataPoints(topicId) {
  const data = getEditableDataPoints()

  const dataByTopic = {
    cursor: [data.cursor_users, data.cursor_fortune500, data.ai_tools_market],
    investment: [data.investment_total, data.investment_nrr, data.cursor_valuation],
    cio: [data.cio_priority, data.cio_budget, data.cio_talent],
    roi: [data.roi_speed, data.roi_savings, data.roi_payback],
  }

  return dataByTopic[topicId] || dataByTopic.cursor
}

export function formatRealtimeForPrompt(realtimeData, topicId = '') {
  if (!realtimeData) return ''

  let context = '\n\nREAL-TIME RESEARCH (headlines are leads only — verify claims; do not copy titles):\n'

  if (realtimeData.headlines?.length > 0) {
    let headlines = [...realtimeData.headlines]
    if (topicId && headlines.length > 1) {
      const o = headlinePromptOffset(headlines.length, topicId)
      headlines = [...headlines.slice(o), ...headlines.slice(0, o)]
    }
    context += '\nRecent headlines & threads (mine 2–4 distinct angles; CIO/CTO/CDO-relevant where applicable):\n'
    for (const h of headlines.slice(0, 12)) {
      const pts = h.points != null ? ` · ${h.points} pts` : ''
      context += `→ "${h.title}" — ${h.source}, ${h.date}${pts}\n`
    }
  } else {
    context +=
      '\n(No live headlines returned — still use verified registry stats below and hedged language where needed.)\n'
  }

  if (realtimeData.freshData?.length > 0) {
    context += '\nVerified / registry stats (still require inline citation when used):\n'
    for (const d of realtimeData.freshData) {
      context += `→ ${d}\n`
    }
  }

  context +=
    '\nFRESHNESS CONTRACT:\n' +
    '- Tie the hook to something in the last ~14 days from the headlines above OR a defensible industry shift (say "recent reporting suggests…" if not primary-sourced).\n' +
    '- Name-check at most one vendor/product from headlines if it helps specificity — never invent funding rounds, dates, or customer names.\n' +
    '- Prefer a different narrative frame than generic "AI is changing everything" posts.\n'

  return context
}

export function getRealtimeSprinkle(topicId) {
  const freshData = generateFreshDataPoints(topicId)
  if (!freshData.length) return ''
  const minuteBucket = Math.floor(Date.now() / 60_000)
  const dayStr = new Date().toDateString()
  const idx =
    (fnv1a(`${topicId}:${dayStr}:${minuteBucket}`) % freshData.length + freshData.length) %
    freshData.length
  return freshData[idx]
}
