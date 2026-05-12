import { fnv1a, headlinePromptOffset } from './generationVariety'

const SEARCH_QUERIES = {
  cursor: 'Cursor AI code editor OR "AI coding tool" OR "AI dev tools" funding launch',
  investment: 'AI developer tools funding OR "AI SDLC" venture capital OR "software development AI" investment',
  cio: 'CIO AI strategy OR "VP Engineering" AI adoption OR DevOps AI transformation 2025 2026',
  roi: 'AI developer productivity ROI OR "AI coding" cost savings OR "AI software development" revenue',
}

const CACHE_KEY = 'lidp_realtime_cache'
const CACHE_TTL = 4 * 60 * 60 * 1000

function getCachedData(topicId) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    const entry = cache[topicId]
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      return entry.data
    }
  } catch { /* ignore */ }
  return null
}

function setCachedData(topicId, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    cache[topicId] = { data, ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore */ }
}

export async function fetchRealtimeContext(topicId) {
  const cached = getCachedData(topicId)
  if (cached) return cached

  const query = SEARCH_QUERIES[topicId] || SEARCH_QUERIES.cursor

  const results = { headlines: [], freshData: [], fetchedAt: new Date().toISOString() }

  try {
    const gNewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=5&sortby=publishedAt&apikey=demo`
    const res = await fetch(gNewsUrl)
    if (res.ok) {
      const data = await res.json()
      if (data.articles) {
        results.headlines = data.articles.slice(0, 5).map((a) => ({
          title: a.title,
          source: a.source?.name || 'Unknown',
          date: a.publishedAt?.split('T')[0] || '',
          url: a.url,
        }))
      }
    }
  } catch { /* continue without news */ }

  if (results.headlines.length === 0) {
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`
      const res = await fetch(hnUrl)
      if (res.ok) {
        const data = await res.json()
        if (data.hits) {
          results.headlines = data.hits.slice(0, 5).map((h) => ({
            title: h.title,
            source: 'Hacker News',
            date: h.created_at?.split('T')[0] || '',
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            points: h.points,
          }))
        }
      }
    } catch { /* continue */ }
  }

  results.freshData = generateFreshDataPoints(topicId)

  setCachedData(topicId, results)
  return results
}

const VERIFIED_DATA_KEY = 'lidp_verified_data'

function getVerifiedOverrides() {
  try {
    return JSON.parse(localStorage.getItem(VERIFIED_DATA_KEY) || '{}')
  } catch { return {} }
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
    cursor: [
      data.cursor_users,
      data.cursor_fortune500,
      data.ai_tools_market,
    ],
    investment: [
      data.investment_total,
      data.investment_nrr,
      data.cursor_valuation,
    ],
    cio: [
      data.cio_priority,
      data.cio_budget,
      data.cio_talent,
    ],
    roi: [
      data.roi_speed,
      data.roi_savings,
      data.roi_payback,
    ],
  }

  return dataByTopic[topicId] || dataByTopic.cursor
}

export function formatRealtimeForPrompt(realtimeData, topicId = '') {
  if (!realtimeData) return ''

  let context = '\n\nREAL-TIME CONTEXT (use this to make the post timely and fresh):\n'

  if (realtimeData.headlines.length > 0) {
    let headlines = [...realtimeData.headlines]
    if (topicId && headlines.length > 1) {
      const o = headlinePromptOffset(headlines.length, topicId)
      headlines = [...headlines.slice(o), ...headlines.slice(0, o)]
    }
    context += '\nRecent headlines (order rotates each run — mine different angles, do not copy titles):\n'
    for (const h of headlines.slice(0, 5)) {
      context += `→ "${h.title}" — ${h.source}, ${h.date}\n`
    }
  }

  if (realtimeData.freshData.length > 0) {
    context += '\nCurrent market data:\n'
    for (const d of realtimeData.freshData) {
      context += `→ ${d}\n`
    }
  }

  context +=
    '\nIMPORTANT: Reference at least 1-2 of these current data points or news items in the post to make it feel timely. Cite the source when using data. Prefer an angle you have not used in prior outputs this session.'

  return context
}

export function getRealtimeSprinkle(topicId) {
  const freshData = generateFreshDataPoints(topicId)
  if (!freshData.length) return ''
  const minuteBucket = Math.floor(Date.now() / 60_000)
  const idx = (fnv1a(`${topicId}:${minuteBucket}`) % freshData.length + freshData.length) % freshData.length
  return freshData[idx]
}
