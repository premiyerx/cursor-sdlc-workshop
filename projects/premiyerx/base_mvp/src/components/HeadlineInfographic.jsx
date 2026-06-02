/**
 * Editorial news infographic — designed to read like an Axios / Bloomberg chart card.
 *
 * Layout (1200 x 627, LinkedIn share size):
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │ MASTHEAD ribbon (topic label + accent + date)                        │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ HOOK headline (Georgia serif, 2 lines)                               │
 *   │ Sub-deck (Inter, 1 line)                                             │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ News chip (left)                  · Topic chip (right)                │
 *   │ "Lead headline from GNews — wrapped to 2 lines"                      │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ STAT CARDS row (1-3 cards): big value + context + source + bar       │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ THE TAKEAWAY · 1-2 implication lines                                  │
 *   ├──────────────────────────────────────────────────────────────────────┤
 *   │ Footer: Prem Iyer · AI Software Transformation · sources             │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * Everything is real SVG so it composites pixel-perfect at any resolution and
 * stays editable by the InfographicTextOverlay editor.
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

function statMagnitude(value) {
  const s = String(value || '')
  const num = parseFloat((s.match(/-?\d+(?:\.\d+)?/) || ['0'])[0]) || 0
  let scale = num
  if (/billion|\bB\b/i.test(s)) scale = num * 1e9
  else if (/million|\bM\b/i.test(s)) scale = num * 1e6
  else if (/thousand|\bK\b/i.test(s)) scale = num * 1e3
  return { num, scale, isPercent: /%/.test(s) }
}

/** Bar fill ratio for each stat, on the same 0-1 scale we use to draw inline bars. */
function computeBarRatios(stats) {
  const mags = stats.map((s) => statMagnitude(s.value))
  const allPercent = mags.length > 0 && mags.every((m) => m.isPercent)
  if (allPercent) {
    return mags.map((m) => Math.max(0.08, Math.min(1, m.num / 100)))
  }
  const maxScale = Math.max(...mags.map((m) => m.scale), 1)
  return mags.map((m) => Math.max(0.18, maxScale > 0 ? m.scale / maxScale : 0.18))
}

function StatCard({ x, y, w, h, accent, stat, ratio }) {
  const valueY = y + 80
  const contextY = y + 116
  const barTrackY = y + h - 56
  const barTrackH = 14
  const barFillW = Math.round((w - 48) * ratio)
  const sourceY = y + h - 18

  return (
    <g>
      {/* Card background — subtle glass over dark */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill="#0d0d0d"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      {/* Left accent rail */}
      <rect x={x} y={y} width="6" height={h} rx="3" fill={accent} />
      {/* Subtle top highlight */}
      <rect x={x} y={y} width={w} height="1" fill="rgba(255,255,255,0.08)" />

      {/* Big value (Georgia serif, like a chart magazine) */}
      <text
        x={x + 28}
        y={valueY}
        fill="#f6f6f6"
        fontSize="58"
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="-1"
      >
        {stat.value}
      </text>

      {/* Context line */}
      <text
        x={x + 28}
        y={contextY}
        fill="#9aa0a8"
        fontSize="13"
        fontFamily="Inter, sans-serif"
      >
        {slideCopy(stat.context, 56, 140)}
      </text>

      {/* Bar */}
      <rect
        x={x + 24}
        y={barTrackY}
        width={w - 48}
        height={barTrackH}
        rx="7"
        fill="rgba(255,255,255,0.06)"
      />
      <rect
        x={x + 24}
        y={barTrackY}
        width={barFillW}
        height={barTrackH}
        rx="7"
        fill={accent}
        opacity="0.95"
      />

      {/* Source line */}
      <text
        x={x + 28}
        y={sourceY}
        fill="#5a5f66"
        fontSize="10"
        fontFamily="Inter, sans-serif"
        letterSpacing="0.4"
      >
        SOURCE · {String(stat.source || '').slice(0, 48).toUpperCase()}
      </text>
    </g>
  )
}

function StatCardRow({ stats, accent, yBase }) {
  if (!stats.length) return null
  const n = Math.min(stats.length, 3)
  const visible = stats.slice(0, n)
  const ratios = computeBarRatios(visible)
  const margin = 56
  const gap = 24
  const totalW = 1200 - margin * 2
  const cardW = (totalW - gap * (n - 1)) / n
  const cardH = 200
  return visible.map((stat, i) => (
    <StatCard
      key={stat.registryId || i}
      x={margin + i * (cardW + gap)}
      y={yBase}
      w={cardW}
      h={cardH}
      accent={accent}
      stat={stat}
      ratio={ratios[i]}
    />
  ))
}

export default function HeadlineInfographic({ model, palette }) {
  if (!model) return null

  const {
    topicLabel,
    topicBadge,
    topicFocusLine,
    hook,
    leadHeadline,
    verifiedStats,
    implications,
    sources,
    displayDate,
  } = model

  const accent = palette?.accent || '#3EDC81'
  const hookLines = wrapText(slideCopy(hook, 92, 220), 60, 2)

  return (
    <g>
      {/* ─── Masthead ─────────────────────────────────────────────────── */}
      <rect x="0" y="0" width="1200" height="56" fill="#0d100d" />
      <rect x="0" y="55" width="1200" height="1" fill={accent} opacity="0.45" />
      <text
        x="56"
        y="35"
        fill={accent}
        fontSize="13"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        letterSpacing="4"
      >
        {String(topicLabel || 'INSIGHT').toUpperCase().slice(0, 42)}
      </text>
      {topicFocusLine ? (
        <text
          x="56"
          y="50"
          fill="#6e7480"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          letterSpacing="0.4"
        >
          {topicFocusLine.slice(0, 80)}
        </text>
      ) : null}
      <text
        x="1144"
        y="35"
        textAnchor="end"
        fill="#9aa0a8"
        fontSize="11"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
        letterSpacing="2"
      >
        {String(displayDate || '').toUpperCase()}
      </text>

      {/* ─── Hook (serif headline) ────────────────────────────────────── */}
      {hookLines.map((line, i) => (
        <text
          key={`hook-${i}`}
          x="56"
          y={106 + i * 38}
          fill="#f6f6f6"
          fontSize="32"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="-0.5"
        >
          {line}
        </text>
      ))}

      {/* ─── Lead headline ribbon ─────────────────────────────────────── */}
      {leadHeadline ? (
        <>
          <rect
            x="56"
            y="200"
            width="1088"
            height="74"
            rx="10"
            fill="#0d0d0d"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <rect x="56" y="200" width="6" height="74" rx="3" fill={accent} opacity="0.7" />
          <text
            x="80"
            y="222"
            fill={accent}
            fontSize="10"
            fontWeight="700"
            fontFamily="Inter, sans-serif"
            letterSpacing="2"
          >
            {String(topicBadge || 'NEWS').toUpperCase().slice(0, 50)}
          </text>
          {wrapText(leadHeadline.title, 92, 2).map((ln, i) => (
            <text
              key={`lead-${i}`}
              x="80"
              y={244 + i * 20}
              fill="#dcdde0"
              fontSize="13"
              fontWeight="600"
              fontFamily="Georgia, 'Times New Roman', serif"
            >
              {ln}
            </text>
          ))}
        </>
      ) : null}

      {/* ─── Stat cards ───────────────────────────────────────────────── */}
      {verifiedStats?.length ? (
        <StatCardRow stats={verifiedStats} accent={accent} yBase={leadHeadline ? 296 : 220} />
      ) : (
        <text
          x="600"
          y={leadHeadline ? 360 : 320}
          textAnchor="middle"
          fill="#4a4d54"
          fontSize="13"
          fontFamily="Inter, sans-serif"
        >
          Add cited stats to your post to populate this card row.
        </text>
      )}

      {/* ─── Takeaway block ───────────────────────────────────────────── */}
      {implications?.length ? (
        <>
          <line
            x1="56"
            y1="528"
            x2="180"
            y2="528"
            stroke={accent}
            strokeWidth="2"
          />
          <text
            x="56"
            y="548"
            fill={accent}
            fontSize="11"
            fontWeight="800"
            fontFamily="Inter, sans-serif"
            letterSpacing="3"
          >
            THE TAKEAWAY
          </text>
          {implications.slice(0, 2).map((line, i) => (
            <text
              key={`imp-${i}`}
              x="56"
              y={570 + i * 22}
              fill="#c8cbd0"
              fontSize="13"
              fontFamily="Inter, sans-serif"
            >
              {slideCopy(line, 140, 260)}
            </text>
          ))}
        </>
      ) : null}

      {/* ─── Sources line (sits inside footer band) ───────────────────── */}
      {sources?.length ? (
        <text
          x="1144"
          y="582"
          textAnchor="end"
          fill="#4a4d54"
          fontSize="9"
          fontFamily="Inter, sans-serif"
          letterSpacing="0.4"
        >
          Verified · {sources.slice(0, 3).join(' · ')}
        </text>
      ) : null}
    </g>
  )
}
