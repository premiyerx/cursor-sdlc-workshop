import { fnv1a } from './generationVariety'
import { researchForTopic } from '../data/topicIntel'

const CACHE_KEY = 'lidp_realtime_cache'
/** Soft TTL when not forcing refresh — still bypassed on every Generate via forceRefresh. */
const CACHE_TTL = 60 * 60 * 1000

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

async function fetchGNewsHeadlines(query, max = 10) {
  const apiKey = getGnewsApiKey()
  const gNewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=${max}&sortby=publishedAt&apikey=${encodeURIComponent(apiKey)}`
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

  const maxAgeMs = 75 * 86_400_000
  const now = Date.now()
  const dated = merged.filter((h) => {
    if (!h.date) return true
    const t = new Date(h.date + 'T12:00:00Z').getTime()
    if (Number.isNaN(t)) return true
    return now - t <= maxAgeMs
  })
  // Prefer recent items for AI relevance; fall back if the feed is thin.
  return (dated.length >= 5 ? dated : merged).slice(0, 22)
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

  const research = researchForTopic(topicId, topicLabel)
  const { hnQueries } = research

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
  const gQueries = research.gnewsQueries?.length
    ? research.gnewsQueries
    : [research.gnewsQuery].filter(Boolean)
  try {
    const gNewsBatches = await Promise.all(
      gQueries.map(async (q) => {
        try {
          return await fetchGNewsHeadlines(q, isGnewsKeyConfigured() ? 10 : 6)
        } catch {
          return []
        }
      }),
    )
    gNewsList = gNewsBatches.flat()
    results.sourcesTried.push(`GNews (${gNewsList.length} from ${gQueries.length} queries)`)
  } catch {
    results.sourcesTried.push('GNews (error)')
  }

  results.headlines = mergeHeadlines([...hnLists, gNewsList])
  results.freshData = generateFreshDataPoints(topicId)
  results.gnewsConfigured = isGnewsKeyConfigured()

  setCachedData(topicId, results)
  return results
}

export { formatRealtimeForPrompt } from './newsCraft'

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

/** Hedged framing only — models must prefer dated headlines over these when numbers conflict. */
const DEFAULT_DATA_POINTS = {
  cursor_users:
    'Cursor is widely used across startups and enterprises; cite concrete scale only if a headline in CONTEXT supplies it with a date.',
  cursor_fortune500:
    'AI-native editors compete for enterprise procurement cycles; name logos or adoption stats only when your headlines include them.',
  cursor_awareness:
    'Developer surveys still show rapid trial of AI IDEs; cite survey numbers only if your headlines name the study and period.',
  investment_vc_pe_sdlc:
    'VC and PE are underwriting AI across the SDLC—build/test/deploy automation, agent governance, inference COGS, security review, and services attach—not tabloid single-name transaction arcs. Prefer headline-backed, multi-company patterns (rounds, roll-ups, infra spend) over speculative employer M&A chatter.',
  ai_tools_market:
    'Analysts expect strong multi-year growth in AI-assisted software delivery; avoid citing a single static “market size” unless your headlines quote it with a source and date.',
  ai_tools_adoption:
    'Enterprises continue expanding pilots for AI coding assistants; prefer “recent reporting” unless headlines give a dated statistic.',
  investment_total:
    'Funding and valuation headlines for AI dev tools change week to week in 2026 — do not reuse old quarter totals from memory; pull amounts and quarters only from your dated headline list.',
  investment_nrr:
    'High net-revenue retention remains a talking point for top dev-tool vendors; only cite a number if a headline provides it.',
  cio_priority:
    'CIOs still rank AI integration near the top of roadmaps; use generic framing unless a headline supplies a dated survey stat.',
  cio_budget:
    'Budget shifts toward AI tooling continue; avoid invented budget percentages.',
  cio_talent:
    'Talent and productivity pressure remain central to engineering leadership narratives.',
  roi_speed:
    'Teams report faster delivery when AI assists code review and scaffolding; cite benchmarks only if headlines name the study.',
  roi_savings:
    'ROI narratives vary by org; avoid hard dollar-per-seat claims unless sourced in CONTEXT.',
  roi_bugs:
    'Quality outcomes depend on workflow; cite defect metrics only when headlines support them.',
  roi_payback:
    'Payback timelines differ widely; do not invent a universal payback window.',
  devsecops_vuln:
    'Security teams evaluate AI-generated code carefully; keep claims qualitative unless headlines cite data.',
}

function generateFreshDataPoints(topicId) {
  const data = getEditableDataPoints()

  const dataByTopic = {
    cursor: [data.cursor_users, data.cursor_fortune500, data.ai_tools_market],
    investment: [data.investment_total, data.investment_nrr, data.investment_vc_pe_sdlc],
    cio: [data.cio_priority, data.cio_budget, data.cio_talent],
    roi: [data.roi_speed, data.roi_savings, data.roi_payback],
  }

  return dataByTopic[topicId] || dataByTopic.cursor
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
