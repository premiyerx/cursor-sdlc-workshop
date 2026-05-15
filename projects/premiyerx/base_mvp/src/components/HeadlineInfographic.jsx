/**
 * Level 3: headline-aware infographic — news callout + registry-verified stats only.
 */

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
  if (words.join(' ').length > maxChars * maxLines && lines.length > 0) {
    const last = lines[lines.length - 1]
    if (last.length > maxChars - 1) lines[lines.length - 1] = `${last.slice(0, maxChars - 2)}…`
  }
  return lines.slice(0, maxLines)
}

export default function HeadlineInfographic({ model, palette }) {
  if (!model) return null

  const { topicLabel, topicBadge, hook, leadHeadline, verifiedStats, implications, sources, displayDate } =
    model

  const headlineLines = leadHeadline ? wrapText(leadHeadline.title, 52, 2) : []
  const statCount = verifiedStats.length
  const statW = statCount === 1 ? 320 : statCount === 2 ? 480 : 360
  const statGap = statCount === 2 ? 80 : 40
  const statStartX =
    statCount === 1 ? 440 : statCount === 2 ? 120 : 60

  return (
    <>
      {/* Topic + date row */}
      <rect x="48" y="28" width="auto" height="0" fill="none" />
      <text x="48" y="48" fill={palette.accent} fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1.5">
        {topicLabel.toUpperCase().slice(0, 42)}
      </text>
      <text x="1152" y="48" textAnchor="end" fill="#444" fontSize="10" fontFamily="Inter, sans-serif">
        {displayDate}
      </text>

      {/* Hook */}
      <text x="600" y="82" textAnchor="middle" fill="#f0f0f0" fontSize="18" fontWeight="800" fontFamily="Inter, sans-serif">
        {hook.length > 64 ? `${hook.slice(0, 61)}…` : hook}
      </text>
      <line x1="320" y1="94" x2="880" y2="94" stroke={palette.accent} strokeWidth="1" opacity="0.2" />

      {/* News callout */}
      <rect x="48" y="108" width="1104" height={leadHeadline ? 108 : 56} rx="14" fill="#0f0f0f" stroke={palette.accent} strokeWidth="1" opacity="0.9" />
      <rect x="48" y="108" width="4" height={leadHeadline ? 108 : 56} rx="2" fill={palette.accent} />
      <text x="72" y="132" fill={palette.accent} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1.2">
        {topicBadge.toUpperCase()}
      </text>
      {leadHeadline ? (
        <>
          {headlineLines.map((ln, i) => (
            <text key={i} x="72" y={156 + i * 22} fill="#ddd" fontSize="13" fontWeight="600" fontFamily="Inter, sans-serif">
              {ln}
            </text>
          ))}
          <text x="72" y="198" fill="#555" fontSize="9" fontFamily="Inter, sans-serif">
            {leadHeadline.source}
            {leadHeadline.date ? ` · ${leadHeadline.date}` : ''}
            {' · Paraphrase in posts — headline for context only'}
          </text>
        </>
      ) : (
        <text x="72" y="148" fill="#666" fontSize="12" fontFamily="Inter, sans-serif">
          No live headlines — showing registry-verified data for this pillar.
        </text>
      )}

      {/* Verified stat cards */}
      {verifiedStats.length > 0 ? (
        verifiedStats.map((stat, i) => {
          const x = statStartX + i * (statW + statGap)
          const y = leadHeadline ? 238 : 188
          const h = 200
          return (
            <g key={stat.registryId || i}>
              <rect x={x} y={y} width={statW} height={h} rx="14" fill="#111" stroke="#1e1e1e" strokeWidth="1" />
              <rect x={x} y={y} width="4" height={h} rx="2" fill={palette.accent} opacity="0.55" />
              <text x={x + statW / 2} y={y + 72} textAnchor="middle" fill="#fff" fontSize="36" fontWeight="800" fontFamily="Inter, sans-serif">
                {stat.value}
              </text>
              <text x={x + statW / 2} y={y + 108} textAnchor="middle" fill="#888" fontSize="11" fontFamily="Inter, sans-serif">
                {stat.context.length > 44 ? `${stat.context.slice(0, 41)}…` : stat.context}
              </text>
              <text x={x + statW / 2} y={y + 168} textAnchor="middle" fill="#444" fontSize="9" fontFamily="Inter, sans-serif" fontStyle="italic">
                ✓ {stat.source}
              </text>
              {stat.status === 'verified' && (
                <text x={x + statW - 14} y={y + 22} textAnchor="end" fill={palette.accent} fontSize="8" fontFamily="Inter, sans-serif">
                  VERIFIED
                </text>
              )}
            </g>
          )
        })
      ) : (
        <text x="600" y="320" textAnchor="middle" fill="#555" fontSize="13" fontFamily="Inter, sans-serif">
          Add registry-backed stats to your post or Data Registry tab.
        </text>
      )}

      {/* Implications (text only — no unverified numbers) */}
      {implications.length > 0 && (
        <>
          <text x="48" y="468" fill="#555" fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">
            SO WHAT
          </text>
          {implications.map((line, i) => (
            <g key={i}>
              <text x="48" y={492 + i * 28} fill={palette.accent} fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
                →
              </text>
              <text x="72" y={492 + i * 28} fill="#aaa" fontSize="12" fontFamily="Inter, sans-serif">
                {line.length > 88 ? `${line.slice(0, 85)}…` : line}
              </text>
            </g>
          ))}
        </>
      )}

      {/* Footer sources */}
      {sources.length > 0 && (
        <text x="600" y="568" textAnchor="middle" fill="#3a3a3a" fontSize="9" fontFamily="Inter, sans-serif">
          Registry-verified data · {sources.join(' · ')}
        </text>
      )}
    </>
  )
}
