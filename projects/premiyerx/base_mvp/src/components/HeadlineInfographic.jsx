/**
 * Newsroom editorial SVG — rotates layout variant on each refresh.
 */

import { slideCopy } from '../utils/completeSentence'

function wrapText(text, maxChars, maxLines = 2) {
  const words = (text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length > maxChars && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
    if (lines.length >= maxLines) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

function parseStatPercent(value) {
  const m = String(value).match(/(\d+(?:\.\d+)?)/)
  return m ? Math.min(100, parseFloat(m[1])) : 50
}

function BarChartStats({ stats, palette, yBase }) {
  const barW = 280
  const gap = 40
  const startX = 600 - ((stats.length * barW + (stats.length - 1) * gap) / 2)
  return stats.map((stat, i) => {
    const x = startX + i * (barW + gap)
    const pct = parseStatPercent(stat.value)
    const barH = (pct / 100) * 120
    return (
      <g key={stat.registryId || i}>
        <rect x={x} y={yBase} width={barW} height={130} rx="4" fill="#111" stroke="#222" strokeWidth="1" />
        <rect x={x + 12} y={yBase + 130 - barH} width={barW - 24} height={barH} rx="3" fill={palette.accent} opacity="0.75" />
        <text x={x + barW / 2} y={yBase - 12} textAnchor="middle" fill="#fff" fontSize="28" fontWeight="800" fontFamily="Georgia, serif">
          {stat.value}
        </text>
        <text x={x + barW / 2} y={yBase + 150} textAnchor="middle" fill="#666" fontSize="9" fontFamily="Inter, sans-serif">
          {slideCopy(stat.context, 34, 110)}
        </text>
        <text x={x + barW / 2} y={yBase + 166} textAnchor="middle" fill="#444" fontSize="8" fontFamily="Inter, sans-serif" fontStyle="italic">
          {stat.source}
        </text>
      </g>
    )
  })
}

function CardStats({ stats, palette, yBase }) {
  const cardW = stats.length === 1 ? 400 : stats.length === 2 ? 480 : 340
  const gap = 36
  const startX = 600 - ((stats.length * cardW + (stats.length - 1) * gap) / 2)
  return stats.map((stat, i) => {
    const x = startX + i * (cardW + gap)
    return (
      <g key={stat.registryId || i}>
        <rect x={x} y={yBase} width={cardW} height={175} rx="2" fill="#fafafa" opacity="0.04" stroke="#333" strokeWidth="1" />
        <line x1={x} y1={yBase} x2={x} y2={yBase + 175} stroke={palette.accent} strokeWidth="3" />
        <text x={x + 24} y={yBase + 58} fill="#fff" fontSize="38" fontWeight="800" fontFamily="Georgia, serif">
          {stat.value}
        </text>
        <text x={x + 24} y={yBase + 92} fill="#999" fontSize="11" fontFamily="Inter, sans-serif">
          {slideCopy(stat.context, 58, 150)}
        </text>
        <text x={x + 24} y={yBase + 155} fill="#555" fontSize="8" fontFamily="Inter, sans-serif">
          SOURCE: {stat.source}
        </text>
      </g>
    )
  })
}

export default function HeadlineInfographic({ model, palette }) {
  if (!model) return null

  const {
    topicLabel,
    topicBadge,
    hook,
    leadHeadline,
    verifiedStats,
    implications,
    sources,
    displayDate,
    layoutVariant = 0,
    refreshId,
  } = model

  const headlineLines = leadHeadline ? wrapText(leadHeadline.title, 58, 2) : []
  const variant = layoutVariant % 4
  const statsY = leadHeadline ? 250 : 200

  return (
    <g key={refreshId || 'infographic'}>
      {/* Editorial grid */}
      {[...Array(12)].map((_, i) => (
        <line key={`g${i}`} x1={100 * i} y1="0" x2={100 * i} y2="590" stroke="#151515" strokeWidth="1" />
      ))}
      <line x1="0" y1="120" x2="1200" y2="120" stroke="#1a1a1a" strokeWidth="1" />

      {/* Masthead */}
      <text x="56" y="42" fill={palette.accent} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="2.5">
        {topicLabel.toUpperCase().slice(0, 38)}
      </text>
      <text x="1144" y="42" textAnchor="end" fill="#555" fontSize="9" fontFamily="Inter, sans-serif">
        {displayDate}
      </text>
      <text x="56" y="78" fill="#f5f5f5" fontSize="22" fontWeight="700" fontFamily="Georgia, serif">
        {slideCopy(hook, 96, 200)}
      </text>

      {/* News ribbon */}
      <rect x="56" y="100" width="1088" height={leadHeadline ? 96 : 52} fill="#0d0d0d" stroke="#2a2a2a" strokeWidth="1" />
      <text x="76" y="122" fill={palette.accent} fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1.5">
        {topicBadge.toUpperCase()}
      </text>
      {leadHeadline ? (
        <>
          {headlineLines.map((ln, i) => (
            <text key={i} x="76" y={144 + i * 24} fill="#e8e8e8" fontSize="14" fontWeight="600" fontFamily="Georgia, serif">
              {ln}
            </text>
          ))}
          <text x="76" y="186" fill="#555" fontSize="8" fontFamily="Inter, sans-serif">
            {leadHeadline.source}{leadHeadline.date ? ` · ${leadHeadline.date}` : ''}
          </text>
        </>
      ) : (
        <text x="76" y="132" fill="#666" fontSize="11" fontFamily="Inter, sans-serif">
          Fetching headlines — stats below are registry-verified.
        </text>
      )}

      {/* Stats — layout rotates */}
      {verifiedStats.length > 0 ? (
        variant === 0 || variant === 2 ? (
          <BarChartStats stats={verifiedStats} palette={palette} yBase={statsY + 20} />
        ) : (
          <CardStats stats={verifiedStats} palette={palette} yBase={statsY} />
        )
      ) : (
        <text x="600" y="340" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">
          Add cited stats to your post for data cards.
        </text>
      )}

      {/* So what */}
      {implications.length > 0 && (
        <>
          <line x1="56" y1="455" x2="200" y2="455" stroke={palette.accent} strokeWidth="2" />
          <text x="56" y="478" fill="#888" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1.2">
            THE TAKEAWAY
          </text>
          {implications.map((line, i) => (
            <text key={i} x="56" y={502 + i * 26} fill="#bbb" fontSize="12" fontFamily="Inter, sans-serif">
              {slideCopy(line, 120, 240)}
            </text>
          ))}
        </>
      )}

      {sources.length > 0 && (
        <text x="600" y="565" textAnchor="middle" fill="#3a3a3a" fontSize="8" fontFamily="Inter, sans-serif">
          Verified registry data · {sources.join(' · ')}
        </text>
      )}
    </g>
  )
}
