/** Body text only (strip trailing hashtag block) so CTA questions score correctly */
export function stripHashtagBlock(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const firstTag = lines.findIndex((l) => l.trim().startsWith('#'))
  if (firstTag === -1) return text.trim()
  return lines.slice(0, firstTag).join('\n').trim()
}

function hookZoneLines(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  return lines.slice(0, 4)
}

export const SCORING_RULES = [
  {
    id: 'hook',
    label: 'Hook Strength',
    description: 'Scroll-stopping open: numbers, curiosity, or dialogue in the first beats; re-hook in parentheses; no toxic openers.',
    weight: 22,
    evaluate: (text) => {
      const body = stripHashtagBlock(text)
      const lines = hookZoneLines(body)
      const l0 = lines[0] || ''
      const zone = lines.slice(0, 3).join(' ')
      const opener = (l0.split(/[.!?]/)[0] || l0).trim()
      const openerWords = opener.split(/\s+/).filter(Boolean).length
      const zoneWords = zone.split(/\s+/).filter(Boolean).length

      let score = 38

      if (l0.length > 0 && l0.length <= 210) score += 14
      else if (l0.length > 210 && l0.length <= 280) score += 8

      if (openerWords >= 3 && openerWords <= 18) score += 16
      else if (openerWords <= 22 || (zoneWords >= 8 && zoneWords <= 42)) score += 10

      if (/\d/.test(zone)) score += 18

      const patterns = [
        /here'?s/i,
        /\bwhy\b|\bhow\b|\bwhat\b|\bwhen\b/i,
        /\bI\s/i,
        /\bwe\b/i,
        /\bevery\b|\bmost\b|\bshow\b|\btell\b/i,
        /\?/,
        /\b\d+\+?\s*(?:CIO|CFO|VP|deploy|team|engineer|month|week|day|year|%)/i,
        /nobody|secret|surpris|miss|truth|real story|admit/i,
      ]
      score += Math.min(patterns.filter((p) => p.test(zone)).length * 3, 18)

      const early = lines.slice(1, 5).join('\n')
      if (/\([^)]{6,120}\)/.test(early)) score += 14
      if (/nobody|most people|what (?:everyone|nobody)/i.test(early)) score += 8

      const firstToken = (l0.match(/^[\s"'“”]*(\S+)/) || [])[1] || ''
      if (/^(stop|don'?t|dont|quit|never)/i.test(firstToken)) score -= 22
      if (l0.length > 240) score -= 8

      return Math.min(Math.max(score, 0), 100)
    },
  },
  {
    id: 'dwellTime',
    label: 'Dwell Time Potential',
    description: 'Content depth that keeps readers on-screen 60+ seconds. The #1 algorithm signal in 2026.',
    weight: 18,
    evaluate: (text) => {
      const body = stripHashtagBlock(text)
      const wordCount = body.split(/\s+/).filter(Boolean).length
      const readTimeSec = (wordCount / 200) * 60
      const hasFramework = /\d+\.\s/.test(body) && (body.match(/\d+\.\s/g) || []).length >= 3
      const arrowBullets = (body.match(/[→►▸]/g) || []).length
      const dataPoints = (body.match(/\d+%|\$[\d.]+[BMK]?|\d+x/g) || []).length
      let score = 0
      if (readTimeSec >= 45 && readTimeSec <= 120) score += 40
      else if (readTimeSec >= 35 && readTimeSec < 45) score += 32
      else if (readTimeSec >= 30 && readTimeSec < 35) score += 26
      else if (readTimeSec > 120 && readTimeSec <= 180) score += 28
      else if (readTimeSec > 180 && readTimeSec <= 220) score += 22
      else score += 12
      if (hasFramework) score += 25
      else if (arrowBullets >= 5) score += 18
      else if (arrowBullets >= 3) score += 12
      if (dataPoints >= 5) score += 25
      else if (dataPoints >= 3) score += 18
      else if (dataPoints >= 1) score += 10
      const hasStory = /I've|I\s(?:saw|watched|talked|heard|spent|asked)|told me|shared with me/i.test(body)
      if (hasStory) score += 10
      return Math.min(score, 100)
    },
  },
  {
    id: 'readability',
    label: 'Mobile Scannability',
    description: 'Aggressive line breaks, 1-2 sentence paragraphs, zero walls of text. 60% of LinkedIn is mobile.',
    weight: 14,
    evaluate: (text) => {
      const body = stripHashtagBlock(text)
      const doubleBreaks = (body.match(/\n\n/g) || []).length
      const singleBreaks = (body.match(/\n/g) || []).length
      const paragraphs = body.split(/\n\n+/).filter((p) => p.trim())
      const longParas = paragraphs.filter((p) => p.split('\n').join(' ').split(/\s+/).length > 30).length
      const singleLineParas = paragraphs.filter((p) => !p.includes('\n') || p.split('\n').filter((l) => l.trim()).length <= 2).length
      const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
      const shortLineShare =
        lines.length > 0 ? lines.filter((l) => l.length > 0 && l.length <= 92).length / lines.length : 0
      let score = 0
      if (doubleBreaks >= 10) score += 40
      else if (doubleBreaks >= 7) score += 35
      else if (doubleBreaks >= 4) score += 28
      else if (doubleBreaks >= 3) score += 22
      else if (singleBreaks >= 10) score += 32
      else if (singleBreaks >= 6) score += 24
      if (longParas === 0) score += 35
      else if (longParas <= 1) score += 22
      const ratio = paragraphs.length > 0 ? singleLineParas / paragraphs.length : 0
      if (ratio >= 0.7) score += 25
      else if (ratio >= 0.5) score += 18
      else if (singleBreaks >= 8) score += 15
      if (lines.length >= 14 && shortLineShare >= 0.58) score += 16
      return Math.min(score, 100)
    },
  },
  {
    id: 'commentTrigger',
    label: 'Comment Trigger',
    description: 'Ends with a specific question using "you/your". Comments carry 15x more weight than likes.',
    weight: 15,
    evaluate: (text) => {
      const body = stripHashtagBlock(text).trim()
      const lastChunk = body.slice(-520)
      let score = 0
      const endsWithQuestion = /\?\s*$/.test(body)
      if (endsWithQuestion) score += 40
      if (/\?/.test(lastChunk)) score += 22
      if (/your|you/i.test(lastChunk)) score += 24
      if (/how\s(?:are|do|did|would|have)\syou/i.test(lastChunk)) score += 15
      if (/what('s|\sis|\sdo|\swould)/i.test(lastChunk)) score += 12
      if (!endsWithQuestion && /\?\s*(?:\n|$)/.test(lastChunk)) score += 12
      return Math.min(score, 100)
    },
  },
  {
    id: 'visualStructure',
    label: 'Visual Structure',
    description: 'Arrows, 2-3 emoji anchors, numbered lists. Professional emojis only.',
    weight: 10,
    evaluate: (text) => {
      const arrows = (text.match(/→|►|▸/g) || []).length
      const numberedItems = (text.match(/\n\d+\.\s/g) || []).length
      const proEmojis = (text.match(/📊|💡|🔑|🎯|📈|🔮|⚡|🔴|📰/g) || []).length
      const allEmojis = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length
      let score = 0
      if (arrows >= 6) score += 38
      else if (arrows >= 4) score += 32
      else if (arrows >= 3) score += 26
      else if (arrows >= 1) score += 14
      if (numberedItems >= 3) score += 20
      else if (numberedItems >= 1) score += 10
      if (proEmojis >= 2 && proEmojis <= 4) score += 30
      else if (proEmojis === 1) score += 22
      if (arrows >= 4 && proEmojis >= 1) score += 10
      if (allEmojis > 6) score -= 15
      return Math.min(Math.max(score, 0), 100)
    },
  },
  {
    id: 'dataCredibility',
    label: 'Data & Source Credibility',
    description: 'Specific numbers with inline source citations. Positions as facts, not opinions.',
    weight: 8,
    evaluate: (text) => {
      const numbers = (text.match(/\d+%|\$[\d.]+[BMK]?|\d+x|\d+\+/g) || []).length
      const hasCitations = /\(.*(?:20\d{2}|Gartner|McKinsey|Forrester|DORA|PitchBook|Bessemer|Deloitte|Stripe)/i.test(text)
      const citationCount = (text.match(/\((?:.*?(?:20\d{2}|Gartner|McKinsey|Forrester|DORA|PitchBook).*?)\)/gi) || []).length
      let score = 0
      if (numbers >= 6) score += 45
      else if (numbers >= 4) score += 35
      else if (numbers >= 2) score += 20
      if (citationCount >= 3) score += 35
      else if (hasCitations) score += 25
      if (/I've seen|data shows|research|study|survey|report/i.test(text)) score += 20
      return Math.min(score, 100)
    },
  },
  {
    id: 'hashtags',
    label: 'Hashtag Strategy',
    description: '3-5 hashtags. Mix of 1 broad + 2 mid + 1-2 niche. Placed at the end.',
    weight: 5,
    evaluate: (text) => {
      const tags = (text.match(/#\w+/g) || [])
      const hashtagSection = text.slice(-200)
      const tagsAtEnd = (hashtagSection.match(/#\w+/g) || []).length
      let score = 0
      if (tags.length >= 3 && tags.length <= 5) score += 60
      else if (tags.length >= 2 && tags.length <= 6) score += 40
      else if (tags.length === 0) score += 5
      else score += 15
      if (tagsAtEnd >= 3) score += 25
      const hasNiche = tags.some((t) => t.length > 12)
      const hasBroad = tags.some((t) => t.length <= 5)
      if (hasNiche && hasBroad) score += 15
      return Math.min(score, 100)
    },
  },
  {
    id: 'storytelling',
    label: 'Authority & Storytelling',
    description: 'First-person anecdotes, social proof, "flip the script" pattern. PAS structure.',
    weight: 5,
    evaluate: (text) => {
      const body = stripHashtagBlock(text)
      let score = 0
      if (/I've|I\s(?:saw|watched|talked|heard|spent|asked)/i.test(body)) score += 20
      if (/\d+\s*(?:CIO|VP|engineer|director|CTO|CFO|leader)/i.test(body)) score += 20
      if (/here'?s\s(?:what|why|how|the)/i.test(body)) score += 15
      if (/but\s+here'?s|the real|nobody\s+(?:tells|talks|sees)|what nobody/i.test(body)) score += 15
      if (/this isn'?t|that'?s not|the question isn/i.test(body)) score += 15
      if (/compan(?:y|ies)\s+(?:with|without|that)/i.test(body)) score += 15
      return Math.min(score, 100)
    },
  },
  {
    id: 'length',
    label: 'Optimal Length',
    description: '200-280 words (1000-1800 chars). Long enough for dwell time, short enough to finish.',
    weight: 3,
    evaluate: (text) => {
      const body = stripHashtagBlock(text)
      const charLen = body.length
      const wordLen = body.split(/\s+/).filter(Boolean).length
      let score = 0
      if (wordLen >= 200 && wordLen <= 280) score += 50
      else if (wordLen >= 165 && wordLen < 200) score += 40
      else if (wordLen >= 150 && wordLen < 165) score += 32
      else if (wordLen > 280 && wordLen <= 350) score += 34
      else if (wordLen > 350 && wordLen <= 420) score += 26
      else score += 15
      if (charLen >= 1000 && charLen <= 1800) score += 50
      else if (charLen >= 850 && charLen < 1000) score += 42
      else if (charLen >= 780 && charLen < 850) score += 34
      else if (charLen > 1800 && charLen <= 2500) score += 32
      else score += 10
      return Math.min(score, 100)
    },
  },
]

function applyPremierBand(total, details, text) {
  const body = stripHashtagBlock(text)
  if (!body || body.length < 280) return total
  const hook = details.find((d) => d.id === 'hook')?.score ?? 0
  const dwell = details.find((d) => d.id === 'dwellTime')?.score ?? 0
  const comments = details.find((d) => d.id === 'commentTrigger')?.score ?? 0
  const scan = details.find((d) => d.id === 'readability')?.score ?? 0
  const weakest = Math.min(...details.map((d) => d.score))
  if (hook >= 90 && dwell >= 72 && comments >= 78 && scan >= 60 && weakest >= 52) {
    return Math.max(total, 96)
  }
  if (hook >= 88 && total >= 86 && weakest >= 48) {
    return Math.max(total, 95)
  }
  if (hook >= 82 && dwell >= 68 && comments >= 75 && total >= 80 && weakest >= 50) {
    return Math.max(total, 93)
  }
  return total
}

/**
 * LinkedIn-style drafts: dwell + comments + scannability drive reach more than raw polish on every sub-pill.
 * When the weighted model is close but the draft clearly matches those signals, lift into the 92+ band.
 */
function meetsReachComposite(text, details) {
  const body = stripHashtagBlock(text)
  if (!body || body.length < 420) return false
  const words = body.split(/\s+/).filter(Boolean).length
  if (words < 145 || words > 480) return false

  const hook = details.find((d) => d.id === 'hook')?.score ?? 0
  const dwell = details.find((d) => d.id === 'dwellTime')?.score ?? 0
  const comments = details.find((d) => d.id === 'commentTrigger')?.score ?? 0
  const scan = details.find((d) => d.id === 'readability')?.score ?? 0
  if (hook < 78 || dwell < 58 || comments < 68 || scan < 52) return false

  const arrows = (text.match(/[→►▸]/g) || []).length
  const last = body.slice(-680)
  if (arrows < 2 || !/\?/.test(last) || !/you|your/i.test(last)) return false

  const tags = (text.match(/#\w+/g) || []).length
  if (tags < 2 || tags > 8) return false

  const doubles = (body.match(/\n\n/g) || []).length
  const lineCount = body.split('\n').filter((l) => l.trim()).length
  if (doubles < 4 && lineCount < 16) return false

  return true
}

function applyViralityReachFloor(roundedWeighted, premierAdjusted, details, text) {
  if (premierAdjusted >= 92) return premierAdjusted
  if (roundedWeighted < 73) return premierAdjusted
  if (!meetsReachComposite(text, details)) return premierAdjusted
  return Math.max(premierAdjusted, 92)
}

export function scorePost(text) {
  let totalScore = 0
  const details = SCORING_RULES.map((rule) => {
    const ruleScore = rule.evaluate(text)
    const weighted = (ruleScore * rule.weight) / 100
    totalScore += weighted
    return { ...rule, score: ruleScore, weighted }
  })
  const rounded = Math.round(totalScore)
  const afterPremier = applyPremierBand(rounded, details, text)
  const adjusted = applyViralityReachFloor(rounded, afterPremier, details, text)
  return { total: adjusted, details }
}

export const POSTING_TIMEZONE = 'ET'

export const BEST_POSTING_TIMES = [
  { day: 'Tuesday', times: ['7:30 AM', '10:00 AM', '12:00 PM'], quality: 'Best' },
  { day: 'Wednesday', times: ['7:30 AM', '10:00 AM', '12:00 PM'], quality: 'Best' },
  { day: 'Thursday', times: ['7:30 AM', '10:00 AM'], quality: 'Best' },
  { day: 'Monday', times: ['8:00 AM', '11:00 AM'], quality: 'Good' },
  { day: 'Friday', times: ['8:00 AM'], quality: 'OK' },
  { day: 'Saturday', times: [], quality: 'Avoid' },
  { day: 'Sunday', times: [], quality: 'Avoid' },
]

/** Tooltip / aria: explains weekday-vs-weekday chart (not “best day ever,” not personalized). */
export const POSTING_WEEKDAY_MODEL_TITLE =
  'Rates this calendar weekday against Monday–Sunday using a simple B2B LinkedIn pattern built into this app. It is not “the single best day of the year,” and it is not personalized to your followers or analytics.'

/** Short subline under the main weekday label (hero, briefing, etc.). */
export const WEEKDAY_MODEL_SUBLINE =
  'Compared to Mon–Sun in this app’s weekday chart — not “the best calendar day ever,” and not based on your personal analytics.'

/**
 * Main headline: calendar weekday + tier (pairs with color / “Best” badge elsewhere).
 */
export function formatWeekdayPostingMainLine(dayName, quality) {
  const d = dayName || 'Today'
  const q = quality || 'OK'
  if (q === 'Avoid') {
    return `${d} — weaker for typical B2B LinkedIn (weekends in this model)`
  }
  return `${d} — ${q} for typical B2B LinkedIn`
}

export function getOptimalHashtags(topicId, count = 5) {
  const broad = HASHTAG_POOLS[topicId]?.broad || ['#AI', '#Technology']
  const mid = HASHTAG_POOLS[topicId]?.mid || ['#AITransformation', '#EnterpriseAI']
  const niche = HASHTAG_POOLS[topicId]?.niche || ['#AIDevTools', '#DevProductivity']

  const picks = []
  picks.push(broad[Math.floor(Math.random() * broad.length)])
  const midPicks = mid.sort(() => 0.5 - Math.random()).slice(0, 2)
  picks.push(...midPicks)
  const nichePicks = niche.sort(() => 0.5 - Math.random()).slice(0, count - picks.length)
  picks.push(...nichePicks)

  return [...new Set(picks)].slice(0, count).join(' ')
}

const HASHTAG_POOLS = {
  cursor: {
    broad: ['#AI', '#Technology', '#SoftwareDevelopment'],
    mid: ['#AIDevTools', '#EngineeringLeadership', '#DevProductivity', '#AITransformation', '#CodingWithAI'],
    niche: ['#Cursor', '#AIEngineering', '#DevExperience', '#AICodeEditor', '#CodeReview', '#AIPairProgramming'],
  },
  investment: {
    broad: ['#VentureCapital', '#PrivateEquity', '#AI'],
    mid: ['#AIInvestment', '#EnterpriseAI', '#SaaS', '#PLG', '#TechInvesting'],
    niche: ['#SDLC', '#DevToolsFunding', '#AIDevTools', '#StartupFunding', '#B2BSaaS'],
  },
  cio: {
    broad: ['#CIO', '#Technology', '#Leadership'],
    mid: ['#EngineeringLeadership', '#DevOps', '#DigitalTransformation', '#AITransformation', '#ITLeadership'],
    niche: ['#DevSecOps', '#TechDebt', '#VPEngineering', '#CISO', '#AIReadiness'],
  },
  roi: {
    broad: ['#AI', '#Technology', '#FutureOfWork'],
    mid: ['#ROI', '#DevProductivity', '#EnterpriseAI', '#CostReduction', '#TalentStrategy'],
    niche: ['#AIDevTools', '#DevExperience', '#EngineeringHiring', '#AIProductivity', '#BusinessValue'],
  },
}

export const HASHTAG_SUGGESTIONS = Object.fromEntries(
  Object.entries(HASHTAG_POOLS).map(([key, pools]) => [
    key,
    [...pools.broad, ...pools.mid, ...pools.niche],
  ])
)
