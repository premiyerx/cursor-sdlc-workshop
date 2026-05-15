import { headlinePromptOffset, fnv1a } from './generationVariety'
import { getTopicNarrative } from '../data/topicNarratives'
import { buildViralCraftBlock, pickViralArchetype } from './viralCraft'
import { rotateSlice, bumpRefreshSeed } from './freshnessRotation'

const TOPIC_KEYWORDS = {
  cursor: [
    'cursor', 'copilot', 'windsurf', 'devin', 'zed', 'coding', 'developer', 'ide', 'agent',
    'codebase', 'github', 'software', 'engineering', 'swe', 'programming', 'vscode', 'jetbrains',
  ],
  investment: [
    'funding', 'series', 'valuation', 'venture', 'invest', 'billion', 'million', 'acquisition',
    'ipo', 'private equity', 'round', 'capital', 'arr', 'revenue', 'startup', 'deal',
  ],
  cio: [
    'cio', 'cto', 'cdo', 'chief', 'vp engineering', 'enterprise', 'governance', 'gartner',
    'mckinsey', 'board', 'security', 'compliance', 'transformation', 'it budget', 'leader',
  ],
  roi: [
    'roi', 'productivity', 'savings', 'payback', 'efficiency', 'dora', 'forrester', 'cost',
    'revenue', 'margin', 'cycle time', 'incident', 'tei', 'benchmark', 'return',
  ],
}

function scoreHeadline(headline, topicId) {
  const title = (headline.title || '').toLowerCase()
  const source = (headline.source || '').toLowerCase()
  const keywords = TOPIC_KEYWORDS[topicId] || TOPIC_KEYWORDS.cursor
  let score = 0

  for (const kw of keywords) {
    if (title.includes(kw)) score += kw.length > 6 ? 3 : 2
  }

  // Recency boost
  if (headline.date) {
    const age = Date.now() - new Date(headline.date).getTime()
    const days = age / 86_400_000
    if (days <= 3) score += 8
    else if (days <= 7) score += 5
    else if (days <= 14) score += 2
  }

  // GNews tends to be more "newsy" for executive audiences
  if (source && !source.includes('hacker')) score += 2

  // HN high engagement
  if (headline.points >= 100) score += 4
  else if (headline.points >= 30) score += 2

  return score
}

/**
 * Rank and return the most topic-relevant headlines.
 */
export function selectHeadlinesForTopic(headlines, topicId, count = 5) {
  if (!headlines?.length) return []
  const ranked = [...headlines]
    .map((h, i) => ({ h, score: scoreHeadline(h, topicId), i }))
    .sort((a, b) => b.score - a.score || (b.h.date || '').localeCompare(a.h.date || ''))

  const out = []
  const seen = new Set()
  for (const { h } of ranked) {
    const key = (h.title || '').toLowerCase().slice(0, 100)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(h)
    if (out.length >= count) break
  }

  // Ensure variety: if all low scores, still return rotated slice
  if (out.length < count && headlines.length > out.length) {
    const offset = headlinePromptOffset(headlines.length, topicId)
    for (let i = 0; i < headlines.length && out.length < count; i++) {
      const h = headlines[(offset + i) % headlines.length]
      const key = (h.title || '').toLowerCase().slice(0, 100)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(h)
      }
    }
  }

  return out
}

function deriveAnglesFromHeadlines(headlines, topicId) {
  const narrative = getTopicNarrative(topicId)
  const lead = headlines[0]
  if (!lead) return narrative.hookDirections.slice(0, 3)

  const angles = []
  const title = (lead.title || '').slice(0, 120)

  angles.push(
    `Translate "${title}" into ${narrative.audience} language — what changes Monday morning?`,
  )

  if (headlines[1]) {
    angles.push(
      `Connect "${(headlines[1].title || '').slice(0, 80)}…" to ${narrative.coreThesis.slice(0, 100)}…`,
    )
  }

  angles.push(`Use ${narrative.competitiveFrame.slice(0, 90)}… as the tension in the body.`)

  return angles.slice(0, 4)
}

function formatHeadlineLine(h, i) {
  const pts = h.points != null ? ` · ${h.points} pts` : ''
  return `${i + 1}. "${h.title}" — ${h.source}${h.date ? `, ${h.date}` : ''}${pts}`
}

/**
 * Rich research block for AI generation prompts.
 */
export function buildFullResearchBrief(realtimeData, topicId) {
  const narrative = getTopicNarrative(topicId)
  const headlines = selectHeadlinesForTopic(realtimeData?.headlines || [], topicId, 6)
  const angles = deriveAnglesFromHeadlines(headlines, topicId)
  const archetype = pickViralArchetype(topicId)

  const lines = [
    '',
    '=== PRIORITY PILLAR BRIEF ===',
    `PILLAR: ${narrative.label}`,
    `AUDIENCE: ${narrative.audience}`,
    `CORE THESIS (stay on-message): ${narrative.coreThesis}`,
    `COMPETITIVE / MARKET FRAME: ${narrative.competitiveFrame}`,
    `NEWS LENSES TO MINE: ${narrative.newsLenses.join(' | ')}`,
    `AVOID: ${narrative.avoid.join('; ')}`,
    '',
  ]

  if (headlines.length > 0) {
    lines.push('LEAD STORY (anchor the hook here — paraphrase, do NOT copy title verbatim):')
    lines.push(formatHeadlineLine(headlines[0], 0))
    lines.push('')
    lines.push('SUPPORTING SIGNALS (pick 1–2, add your operator POV):')
    headlines.slice(1, 5).forEach((h, i) => lines.push(formatHeadlineLine(h, i + 1)))
    lines.push('')
    lines.push('SUGGESTED ANGLES FOR THIS RUN:')
    angles.forEach((a) => lines.push(`→ ${a}`))
    lines.push('')
    lines.push(`VIRAL STRUCTURE HINT: Use "${archetype.label}" pattern — ${archetype.pattern}`)
  } else {
    lines.push('(No live headlines returned — anchor on pillar thesis + verified stats; use hedged "recent reporting suggests…" only if defensible.)')
  }

  if (realtimeData?.freshData?.length > 0) {
    lines.push('')
    lines.push('VERIFIED / REGISTRY STATS (cite inline when used):')
    realtimeData.freshData.forEach((d) => lines.push(`→ ${d}`))
  }

  lines.push(
    '',
    'FRESHNESS CONTRACT:',
    '- The hook must feel written THIS WEEK — tie to lead story or a specific market shift.',
    '- Paraphrase headlines; never paste article titles as your opening line.',
    '- Name-check at most one vendor/product from the news if it sharpens the point.',
    '- Never invent funding rounds, dates, customer logos, or survey percentages.',
    '- Prefer a narrative frame the feed has NOT already beaten to death.',
    '=== END PILLAR BRIEF ===',
    '',
  )

  return lines.join('\n')
}

/**
 * Weave ranked headlines into template-based posts (quick Generate path).
 */
export function weaveNewsIntoTemplate(pick, realtimeData, topicId) {
  const narrative = getTopicNarrative(topicId)
  const seed = bumpRefreshSeed(topicId)
  const allHeadlines = selectHeadlinesForTopic(realtimeData?.headlines || [], topicId, 10)
  const headlines = rotateSlice(allHeadlines, seed, 3)
  if (!headlines.length) return { ...pick, headlineCount: 0 }

  const lines = headlines.map((h, i) => {
    const lens = narrative.newsLenses[i % narrative.newsLenses.length]
    return `→ "${h.title}" — ${h.source}${h.date ? `, ${h.date}` : ''}\n   (${lens} — rewrite in your voice; connect to ${narrative.label.toLowerCase()})`
  })

  const angleIdx = (seed % narrative.hookDirections.length)
  const newsBlock = [
    `📰 ${narrative.signalLabel}:`,
    '',
    ...lines,
    '',
    '💡 Operator take (edit this):',
    narrative.hookDirections[angleIdx],
  ].join('\n')

  let body = pick.body || ''
  // Insert after re-hook parenthetical if present
  const rehookMatch = body.match(/^(\([^\n]+\)\s*\n\n)/)
  if (rehookMatch) {
    body = body.replace(rehookMatch[1], `${rehookMatch[1]}${newsBlock}\n\n`)
  } else {
    body = `${newsBlock}\n\n${body}`
  }

  return {
    ...pick,
    body,
    headlineCount: realtimeData?.headlines?.length || headlines.length,
    leadHeadline: headlines[0]?.title || '',
  }
}

export function getResearchSummary(realtimeData, topicId) {
  const seed = fnv1a(`${topicId}:summary:${Date.now()}`)
  const all = selectHeadlinesForTopic(realtimeData?.headlines || [], topicId, 8)
  const rotated = rotateSlice(all, seed, 1)
  return {
    count: realtimeData?.headlines?.length || 0,
    lead: rotated[0] || null,
    fetchedAt: realtimeData?.fetchedAt || null,
  }
}

/** Re-export for realtimeData compatibility */
export function formatRealtimeForPrompt(realtimeData, topicId = '') {
  if (!realtimeData) return ''
  const brief = buildFullResearchBrief(realtimeData, topicId)
  const viral = buildViralCraftBlock(topicId)
  return brief + viral
}
