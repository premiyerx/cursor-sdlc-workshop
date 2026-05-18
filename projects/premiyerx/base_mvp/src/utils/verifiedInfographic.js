import { extractClaimsFromText, getRegistry, getStaleStatus } from './dataRegistry'
import { slideCopy } from './completeSentence'
import { selectHeadlinesForTopic } from './newsCraft'
import { getTopicNarrative } from '../data/topicNarratives'
import { rotateSlice } from './freshnessRotation'
import { fnv1a, mulberry32 } from './generationVariety'

const TOPIC_REGISTRY_CATEGORIES = {
  cursor: ['cursor', 'market'],
  investment: ['investment', 'market'],
  cio: ['cio'],
  roi: ['roi'],
}

function parseRegistryStat(dataPoint) {
  const claim = dataPoint.claim || ''
  const numMatch = claim.match(
    /(\d+(?:\.\d+)?%|\$[\d.,]+[BMK]?\+?|\d+x|\d{1,3}(?:,\d{3})*\+?)/i,
  )
  const value = numMatch ? numMatch[1] : '—'
  let context = claim
  if (numMatch) context = claim.replace(numMatch[0], '').replace(/^[,\s:-]+/, '').trim()
  if (context.length > 52) context = slideCopy(context, 48, 140)

  return {
    value,
    context,
    source: dataPoint.source || 'Registry',
    registryId: dataPoint.id,
    status: getStaleStatus(dataPoint),
    registryBacked: true,
  }
}

function claimToStat(claim) {
  const dp = claim.registryMatch
  if (!dp) return null
  const stat = parseRegistryStat(dp)
  return { ...stat, matchedFromPost: true, postSnippet: claim.text.slice(0, 80) }
}

/**
 * Stats from post text that match the data registry (unknown claims excluded).
 */
export function getVerifiedStatsFromPost(postText, limit = 4) {
  if (!postText) return []
  const claims = extractClaimsFromText(postText)
  const stats = []
  const seen = new Set()

  for (const claim of claims) {
    if (!claim.registryMatch) continue
    const stat = claimToStat(claim)
    if (!stat || seen.has(stat.registryId)) continue
    seen.add(stat.registryId)
    stats.push(stat)
    if (stats.length >= limit) return stats
  }
  return stats
}

/**
 * Registry stats for a topic pillar (fallback when post has few verified numbers).
 */
export function getVerifiedStatsForTopic(topicId, limit = 4, excludeIds = new Set()) {
  const cats = TOPIC_REGISTRY_CATEGORIES[topicId] || [topicId]
  const registry = getRegistry()
  const stats = []

  for (const dp of Object.values(registry)) {
    if (!cats.includes(dp.category)) continue
    if (excludeIds.has(dp.id)) continue
    const stat = parseRegistryStat(dp)
    if (stat.value === '—') continue
    stats.push(stat)
    if (stats.length >= limit) return stats
  }
  return stats
}

/**
 * Merge post-verified stats with topic registry fill-ins, rotated by refreshSeed.
 */
export function assembleVerifiedStats(postText, topicId, limit = 3, refreshSeed = 0) {
  const fromPost = getVerifiedStatsFromPost(postText, limit)
  const seen = new Set(fromPost.map((s) => s.registryId))
  const cats = TOPIC_REGISTRY_CATEGORIES[topicId] || [topicId]
  const registry = getRegistry()
  const pool = Object.values(registry)
    .filter((dp) => cats.includes(dp.category))
    .map((dp) => parseRegistryStat(dp))
    .filter((s) => s.value !== '—' && !seen.has(s.registryId))

  const rotatedPool = rotateSlice(pool, refreshSeed ^ fnv1a('stats'), limit)
  const fill = rotatedPool.filter((s) => !seen.has(s.registryId))
  return [...fromPost, ...fill].slice(0, limit)
}

function safeArrowLines(postText, limit = 2) {
  if (!postText) return []
  return postText
    .split('\n')
    .filter((l) => /^→|^►/.test(l.trim()))
    .map((l) => l.replace(/^→\s*|^►\s*/, '').trim())
    .filter((l) => l.length > 12 && l.length < 100)
    .filter((l) => {
      const claims = extractClaimsFromText(l)
      return claims.length === 0 || claims.every((c) => c.registryMatch)
    })
    .slice(0, limit)
}

function truncateHeadline(title, softMax = 110, hardMax = 200) {
  return slideCopy((title || '').trim(), softMax, hardMax)
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return ''
  try {
    return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return isoDate
  }
}

/**
 * Full model for the Level 3 headline-aware infographic (SVG).
 */
export function buildHeadlineInfographicModel({ postText, topicId, topicLabel, realtimeData, refreshSeed = 0 }) {
  const narrative = getTopicNarrative(topicId)
  const allHeadlines = selectHeadlinesForTopic(realtimeData?.headlines || [], topicId, 12)
  const headlines = rotateSlice(allHeadlines, refreshSeed ^ fnv1a('headlines'), 3)
  const lead = headlines[0] || null
  const supporting = headlines.slice(1, 3)
  const hook = (postText || '').split('\n').filter(Boolean)[0] || narrative.label
  const verifiedStats = assembleVerifiedStats(postText, topicId, 3, refreshSeed)
  const implications = safeArrowLines(postText, 4)
  const rng = mulberry32((refreshSeed ^ fnv1a(topicId || 'x')) >>> 0)
  const layoutVariant = Math.floor(rng() * 4)

  if (implications.length < 2 && supporting.length > 0) {
    for (const h of supporting) {
      const line = truncateHeadline(h.title, 85)
      if (line && !implications.includes(line)) implications.push(line)
      if (implications.length >= 2) break
    }
  }

  const sources = new Set()
  verifiedStats.forEach((s) => sources.add(s.source))
  if (lead?.source) sources.add(lead.source)

  return {
    topicLabel: topicLabel || narrative.label,
    topicBadge: narrative.signalLabel,
    hook: truncateHeadline(hook, 72),
    leadHeadline: lead
      ? {
          title: truncateHeadline(lead.title, 120),
          source: lead.source,
          date: lead.date,
        }
      : null,
    verifiedStats,
    implications: rotateSlice(implications, refreshSeed, 2),
    sources: [...sources].slice(0, 4),
    fetchedAt: realtimeData?.fetchedAt || new Date().toISOString(),
    displayDate: formatDisplayDate(realtimeData?.fetchedAt || new Date().toISOString()),
    verifiedCount: verifiedStats.length,
    hasNews: !!lead,
    refreshSeed,
    layoutVariant,
    refreshId: `${refreshSeed}-${layoutVariant}`,
  }
}
