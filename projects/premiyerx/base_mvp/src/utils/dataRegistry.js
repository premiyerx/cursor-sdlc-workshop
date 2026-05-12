const REGISTRY_KEY = 'lidp_data_registry'

const BUILT_IN_DATA = {
  cursor_users: {
    claim: 'Cursor serves millions of developers with 1M+ daily active users',
    source: 'Cursor, March 2026',
    sourceUrl: 'https://www.cursor.com/blog/third-era',
    category: 'cursor',
  },
  cursor_businesses: {
    claim: '50,000+ businesses use Cursor',
    source: 'Cursor, March 2026',
    sourceUrl: 'https://www.cursor.com/blog/third-era',
    category: 'cursor',
  },
  cursor_fortune500: {
    claim: 'Over half of the Fortune 500 use Cursor',
    source: 'Cursor, 2026',
    sourceUrl: 'https://www.cursor.com',
    category: 'cursor',
  },
  cursor_valuation: {
    claim: 'Cursor raised $2.3B at a $29B valuation in November 2025',
    source: 'Cursor Series C, Nov 2025',
    sourceUrl: 'https://aifundingtracker.com/cursor-revenue-valuation/',
    category: 'cursor',
  },
  cursor_arr: {
    claim: 'Cursor has $2B+ ARR',
    source: 'Multiple sources, 2026',
    sourceUrl: 'https://aifundingtracker.com/cursor-revenue-valuation/',
    category: 'cursor',
  },
  cursor_awareness: {
    claim: '69% of developers have heard of Cursor; 18% use it at work',
    source: 'JetBrains Developer Survey, Jan 2026',
    sourceUrl: 'https://www.jetbrains.com/lp/devecosystem-2025/',
    category: 'cursor',
  },
  ai_tools_market: {
    claim: 'AI-assisted coding tools market projected to reach $22B by 2028',
    source: 'Gartner Market Forecast, 2025',
    sourceUrl: '',
    category: 'market',
  },
  ai_tools_adoption: {
    claim: '73% of Fortune 500 have active AI dev tool pilots',
    source: 'Gartner CIO Survey, 2025',
    sourceUrl: '',
    category: 'market',
  },
  investment_total: {
    claim: 'AI developer tooling saw $4.2B in funding, 3x YoY',
    source: 'PitchBook AI Dev Tools Report, Q4 2025',
    sourceUrl: '',
    category: 'investment',
  },
  investment_nrr: {
    claim: 'Top AI dev tool companies averaging 140%+ net revenue retention',
    source: 'Bessemer Cloud Index, 2025',
    sourceUrl: '',
    category: 'investment',
  },
  dora_speed: {
    claim: '40% faster time-to-ship with AI dev tools',
    source: 'DORA State of DevOps Report, 2025',
    sourceUrl: '',
    category: 'roi',
  },
  dora_bugs: {
    claim: '25% fewer production bugs with AI-assisted development',
    source: 'DORA State of DevOps Report, 2025',
    sourceUrl: '',
    category: 'roi',
  },
  forrester_savings: {
    claim: '$37K annual savings per developer seat from AI tools',
    source: 'Forrester TEI Study, 2025',
    sourceUrl: '',
    category: 'roi',
  },
  forrester_payback: {
    claim: '6-week average payback period for AI dev tool investment',
    source: 'Forrester TEI Study, 2025',
    sourceUrl: '',
    category: 'roi',
  },
  cio_priority: {
    claim: '78% of CIOs list AI integration as a top-3 priority',
    source: 'Gartner CIO Survey, 2025',
    sourceUrl: '',
    category: 'cio',
  },
  cio_budget: {
    claim: '62% of tech leaders increased AI tooling budgets',
    source: 'Deloitte Tech Trends, 2025',
    sourceUrl: '',
    category: 'cio',
  },
  talent_shortage: {
    claim: '87% of engineering leaders cite talent shortage as top concern',
    source: 'Korn Ferry Talent Report, 2025',
    sourceUrl: '',
    category: 'cio',
  },
  tech_debt_risk: {
    claim: '79% say tech debt now threatens revenue',
    source: 'Stripe Developer Coefficient Report, 2024',
    sourceUrl: '',
    category: 'cio',
  },
  devsecops_vuln: {
    claim: 'DevSecOps teams using AI tools report 44% fewer critical vulnerabilities',
    source: 'DORA State of DevOps Report, 2025',
    sourceUrl: '',
    category: 'cio',
  },
  talent_applicants: {
    claim: 'Companies with AI tools attract 40% more applicants',
    source: 'LinkedIn Workforce Report, 2025',
    sourceUrl: '',
    category: 'roi',
  },
}

export function getRegistry() {
  try {
    const stored = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}')
    const merged = {}
    for (const [key, builtin] of Object.entries(BUILT_IN_DATA)) {
      const override = stored[key]
      if (override) {
        merged[key] = { ...builtin, ...override, id: key }
      } else {
        merged[key] = { ...builtin, id: key, verifiedAt: null, verifiedBy: null }
      }
    }
    for (const [key, custom] of Object.entries(stored)) {
      if (!BUILT_IN_DATA[key]) {
        merged[key] = { ...custom, id: key }
      }
    }
    return merged
  } catch {
    return Object.fromEntries(
      Object.entries(BUILT_IN_DATA).map(([k, v]) => [k, { ...v, id: k, verifiedAt: null }])
    )
  }
}

export function verifyDataPoint(id) {
  const stored = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}')
  stored[id] = {
    ...(stored[id] || {}),
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'user',
  }
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(stored))
}

export function updateDataPoint(id, updates) {
  const stored = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}')
  stored[id] = {
    ...(stored[id] || {}),
    ...updates,
    lastEdited: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'user',
  }
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(stored))
}

export function addCustomDataPoint(id, data) {
  const stored = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}')
  stored[id] = {
    ...data,
    verifiedAt: new Date().toISOString(),
    verifiedBy: 'user',
    custom: true,
  }
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(stored))
}

export function deleteCustomDataPoint(id) {
  const stored = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}')
  if (stored[id]?.custom) {
    delete stored[id]
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(stored))
  }
}

const STALE_THRESHOLD_DAYS = 30

export function getStaleStatus(dataPoint) {
  if (!dataPoint.verifiedAt) return 'unverified'
  const daysSince = (Date.now() - new Date(dataPoint.verifiedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > STALE_THRESHOLD_DAYS) return 'stale'
  return 'verified'
}

export function extractClaimsFromText(text) {
  if (!text) return []
  const claims = []
  const patterns = [
    { regex: /(\d+(?:\.\d+)?%[^.\n]{5,60})/g, type: 'percentage' },
    { regex: /(\$[\d,.]+[BMKk]?(?:\+|\s)?[^.\n]{3,50})/g, type: 'dollar' },
    { regex: /(\d+(?:\.\d+)?x\s[^.\n]{3,50})/g, type: 'multiplier' },
    { regex: /(\d{1,3}(?:,\d{3})*\+?\s(?:developer|engineer|business|compan|team|CIO|VP|user)[^.\n]{0,40})/gi, type: 'count' },
    { regex: /((?:million|billion)\+?\s[^.\n]{3,40})/gi, type: 'scale' },
  ]
  for (const { regex, type } of patterns) {
    let match
    while ((match = regex.exec(text)) !== null) {
      const claim = match[1].trim()
      if (claim.length > 10 && !claims.some((c) => c.text === claim)) {
        claims.push({ text: claim, type, startIndex: match.index })
      }
    }
  }
  const registryValues = Object.values(getRegistry())
  for (const claim of claims) {
    const matched = registryValues.find((dp) => {
      const claimWords = claim.text.toLowerCase().split(/\s+/)
      const dpWords = dp.claim.toLowerCase().split(/\s+/)
      const overlap = claimWords.filter((w) => dpWords.includes(w)).length
      return overlap >= 3
    })
    if (matched) {
      claim.registryMatch = matched
      claim.status = getStaleStatus(matched)
    } else {
      claim.registryMatch = null
      claim.status = 'unknown'
    }
  }
  return claims
}

export const CATEGORIES = {
  cursor: 'Cursor: wins across the stack',
  market: 'Market Data',
  investment: 'Capital & the AI SDLC',
  roi: 'ROI on an AI-led SDLC',
  cio: 'CIO & VP Eng stakes',
}
