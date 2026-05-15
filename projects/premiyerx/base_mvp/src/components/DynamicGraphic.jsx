import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { parsePostContent, pickLayout, simpleHash } from '../utils/postParser'
import { findCitations } from '../data/citations'
import { buildHeadlineInfographicModel, assembleVerifiedStats } from '../utils/verifiedInfographic'
import TOPICS from '../data/postTemplates'
import { createCompanionGraphic } from '../utils/companionGraphic'
import { hasOpenAiKey } from '../utils/aiPostGenerator'
import HeadlineInfographic from './HeadlineInfographic'
import ProgressRing from './ProgressRing'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

const PALETTES = [
  { accent: '#3EDC81', dim: '#1a2e1a', bg2: '#0d1f0d' },
  { accent: '#4AE3A0', dim: '#142e1e', bg2: '#0a1f12' },
  { accent: '#2ECC71', dim: '#162e18', bg2: '#0c1f0e' },
  { accent: '#58E89A', dim: '#1a3020', bg2: '#0e2214' },
]

function getPalette(text) {
  return PALETTES[simpleHash(text) % PALETTES.length]
}

function SourceFooter({ text, palette }) {
  const cites = findCitations(text)
  if (cites.length === 0) return null
  const display = cites.slice(0, 3).join('  ·  ')
  return (
    <text x="600" y="580" textAnchor="middle" fill="#444" fontSize="10" fontFamily="Inter, sans-serif" fontStyle="italic">
      Sources: {display}
    </text>
  )
}

function StatGrid({ stats, hook, palette, postText }) {
  const displayStats = stats.slice(0, 6)
  const cols = displayStats.length <= 3 ? displayStats.length : Math.min(3, Math.ceil(displayStats.length / 2))
  const rows = Math.ceil(displayStats.length / cols)

  return (
    <>
      <text x="600" y="58" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 60 ? hook.slice(0, 57).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="350" y1="76" x2="850" y2="76" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      {displayStats.map((stat, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cellW = 1000 / cols
        const cellH = rows > 1 ? 190 : 330
        const cx = 100 + col * cellW + cellW / 2
        const cy = 140 + row * (cellH + 24) + cellH / 2
        return (
          <g key={i}>
            <rect x={100 + col * cellW + 8} y={140 + row * (cellH + 24)} width={cellW - 16} height={cellH} rx="14" fill="#111" stroke="#1a1a1a" strokeWidth="1" />
            <rect x={100 + col * cellW + 8} y={140 + row * (cellH + 24)} width="4" height={cellH} rx="2" fill={palette.accent} opacity="0.5" />
            <text x={cx} y={cy - 14} textAnchor="middle" fill="#f0f0f0" fontSize={rows > 1 ? '30' : '40'} fontWeight="800" fontFamily="Inter, sans-serif">{stat.value}</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fill="#555" fontSize="10" fontFamily="Inter, sans-serif">
              {stat.context.length > 48 ? stat.context.slice(0, 45) + '...' : stat.context}
            </text>
          </g>
        )
      })}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function BigNumberStack({ stats, hook, palette, postText }) {
  const displayStats = stats.slice(0, 4)
  return (
    <>
      <text x="600" y="55" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 55 ? hook.slice(0, 52).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="380" y1="73" x2="820" y2="73" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      {displayStats.map((stat, i) => {
        const y = 110 + i * 110
        return (
          <g key={i}>
            <rect x="80" y={y} width="1040" height="90" rx="14" fill="#111" stroke="#1a1a1a" strokeWidth="1" />
            <rect x="80" y={y} width="4" height="90" rx="2" fill={palette.accent} opacity="0.5" />
            <text x="180" y={y + 55} textAnchor="middle" fill={palette.accent} fontSize="34" fontWeight="800" fontFamily="Inter, sans-serif">{stat.value}</text>
            <line x1="280" y1={y + 16} x2="280" y2={y + 74} stroke="#222" strokeWidth="1" />
            <text x="310" y={y + 50} fill="#888" fontSize="13" fontFamily="Inter, sans-serif">
              {stat.context.length > 70 ? stat.context.slice(0, 67) + '...' : stat.context}
            </text>
          </g>
        )
      })}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function ListWithHeader({ arrowLines, hook, palette, postText }) {
  return (
    <>
      <text x="600" y="58" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 55 ? hook.slice(0, 52).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="350" y1="76" x2="850" y2="76" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      {arrowLines.slice(0, 6).map((line, i) => {
        const y = 115 + i * 72
        return (
          <g key={i}>
            <rect x="80" y={y} width="1040" height="58" rx="12" fill={i % 2 === 0 ? '#111' : '#0d0d0d'} stroke="#1a1a1a" strokeWidth="1" />
            <rect x="80" y={y} width="3" height="58" rx="1.5" fill={palette.accent} opacity="0.4" />
            <text x="120" y={y + 36} fill={palette.accent} fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif">→</text>
            <text x="150" y={y + 36} fill="#ccc" fontSize="13" fontFamily="Inter, sans-serif">
              {line.length > 80 ? line.slice(0, 77) + '...' : line}
            </text>
          </g>
        )
      })}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function TimelineFlow({ arrowLines, hook, palette, postText }) {
  const items = arrowLines.slice(0, 5)
  return (
    <>
      <text x="600" y="55" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 55 ? hook.slice(0, 52).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="380" y1="73" x2="820" y2="73" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      <line x1="155" y1="108" x2="155" y2={108 + items.length * 88} stroke="#222" strokeWidth="2" />
      {items.map((item, i) => {
        const y = 116 + i * 88
        return (
          <g key={i}>
            <circle cx="155" cy={y + 22} r="7" fill={palette.accent} />
            <circle cx="155" cy={y + 22} r="3" fill="#000" />
            <rect x="190" y={y} width="930" height="64" rx="12" fill="#111" stroke="#1a1a1a" strokeWidth="1" />
            <rect x="190" y={y} width="3" height="64" rx="1.5" fill={palette.accent} opacity="0.4" />
            <text x="216" y={y + 17} fill={palette.accent} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">
              {'STEP ' + (i + 1)}
            </text>
            <text x="216" y={y + 44} fill="#ccc" fontSize="13" fontFamily="Inter, sans-serif">
              {item.length > 75 ? item.slice(0, 72) + '...' : item}
            </text>
          </g>
        )
      })}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function Comparison({ stats, arrowLines, hook, palette, postText }) {
  const left = stats.slice(0, 2)
  const right = stats.slice(2, 4).length ? stats.slice(2, 4) : arrowLines.slice(0, 2).map((l) => ({ value: '→', context: l }))
  return (
    <>
      <text x="600" y="55" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 55 ? hook.slice(0, 52).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="380" y1="73" x2="820" y2="73" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      <rect x="60" y="100" width="520" height="400" rx="18" fill="#111" stroke="#1a1a1a" strokeWidth="1" />
      <text x="320" y="140" textAnchor="middle" fill="#555" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">BEFORE</text>
      {left.map((s, i) => (
        <g key={'l' + i}>
          <text x="320" y={210 + i * 110} textAnchor="middle" fill="#e17055" fontSize="34" fontWeight="800" fontFamily="Inter, sans-serif">{s.value}</text>
          <text x="320" y={240 + i * 110} textAnchor="middle" fill="#555" fontSize="11" fontFamily="Inter, sans-serif">{s.context.slice(0, 45)}</text>
        </g>
      ))}
      <rect x="620" y="100" width="520" height="400" rx="18" fill={palette.bg2} stroke={palette.accent} strokeWidth="1" />
      <text x="880" y="140" textAnchor="middle" fill={palette.accent} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">AFTER</text>
      {right.map((s, i) => (
        <g key={'r' + i}>
          <text x="880" y={210 + i * 110} textAnchor="middle" fill={palette.accent} fontSize="34" fontWeight="800" fontFamily="Inter, sans-serif">{s.value}</text>
          <text x="880" y={240 + i * 110} textAnchor="middle" fill="rgba(62,220,129,0.7)" fontSize="11" fontFamily="Inter, sans-serif">{s.context.slice(0, 45)}</text>
        </g>
      ))}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function FrameworkPillars({ keyPhrases, stats, hook, palette, postText }) {
  const pillars = keyPhrases.slice(0, 3)
  if (pillars.length < 2) pillars.push('Impact', 'Outcome', 'Strategy')
  const displayPillars = pillars.slice(0, 3)
  return (
    <>
      <text x="600" y="55" textAnchor="middle" fill={palette.accent} fontSize="20" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">
        {hook.length > 55 ? hook.slice(0, 52).toUpperCase() + '...' : hook.toUpperCase()}
      </text>
      <line x1="380" y1="73" x2="820" y2="73" stroke={palette.accent} strokeWidth="1" opacity="0.25" />
      {displayPillars.map((pillar, i) => {
        const x = 60 + i * 380
        const stat = stats[i]
        return (
          <g key={i}>
            <rect x={x} y="100" width="360" height="400" rx="18" fill={i === 1 ? palette.bg2 : '#111'} stroke={i === 1 ? palette.accent : '#1a1a1a'} strokeWidth="1" />
            <rect x={x} y="100" width={i === 1 ? 360 : 4} height="4" rx="2" fill={palette.accent} opacity={i === 1 ? 0.3 : 0.5} />
            <text x={x + 180} y="150" textAnchor="middle" fill={i === 1 ? palette.accent : '#666'} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">
              {pillar.toUpperCase().slice(0, 18)}
            </text>
            {stat && (
              <text x={x + 180} y="260" textAnchor="middle" fill="#f0f0f0" fontSize="40" fontWeight="800" fontFamily="Inter, sans-serif">{stat.value}</text>
            )}
            {stat && (
              <text x={x + 180} y="295" textAnchor="middle" fill="#555" fontSize="11" fontFamily="Inter, sans-serif">{stat.context.slice(0, 30)}</text>
            )}
          </g>
        )
      })}
      <SourceFooter text={postText} palette={palette} />
    </>
  )
}

function renderLayout(layout, parsed, palette, postText) {
  const { stats, arrowLines, keyPhrases, hook } = parsed
  switch (layout) {
    case 'stat-grid':
      return <StatGrid stats={stats} hook={hook} palette={palette} postText={postText} />
    case 'big-number-stack':
      return <BigNumberStack stats={stats} hook={hook} palette={palette} postText={postText} />
    case 'list-with-header':
      return <ListWithHeader arrowLines={arrowLines} hook={hook} palette={palette} postText={postText} />
    case 'timeline-flow':
      return <TimelineFlow arrowLines={arrowLines} hook={hook} palette={palette} postText={postText} />
    case 'comparison':
      return <Comparison stats={stats} arrowLines={arrowLines} hook={hook} palette={palette} postText={postText} />
    case 'framework-pillars':
      return <FrameworkPillars keyPhrases={keyPhrases} stats={stats} hook={hook} palette={palette} postText={postText} />
    default:
      return <StatGrid stats={stats} hook={hook} palette={palette} postText={postText} />
  }
}

function unsplashAccessKey() {
  return (import.meta.env.VITE_UNSPLASH_ACCESS_KEY || localStorage.getItem('unsplash_access_key') || '').trim()
}

async function tryUnsplashPhoto(parsed, topic) {
  const key = unsplashAccessKey()
  if (!key) return null
  const searchTerms = [parsed.hook, ...parsed.keyPhrases.slice(0, 2), topic?.label || 'technology']
    .join(' ')
    .slice(0, 120)
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(`${searchTerms} business technology`)}&orientation=landscape&per_page=8&client_id=${encodeURIComponent(key)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results?.length) return null
  const pick = data.results[simpleHash(parsed.hook + searchTerms) % data.results.length]
  return {
    url: pick.urls.regular,
    credit: pick.user?.name || 'Unsplash',
    link: pick.links?.html || 'https://unsplash.com',
  }
}

async function tryDalleBanner(parsed, topic, topicId, postText) {
  const apiKey = (localStorage.getItem('openai_key') || '').trim()
  if (!apiKey) return null
  const verified = assembleVerifiedStats(postText, topicId, 3)
  const metrics = verified.map((s) => `${s.value} (${s.source})`).join(', ')
  const prompt = `Professional LinkedIn landscape banner 1200x627 for enterprise audience. Topic: ${parsed.hook.slice(0, 120)}. Verified metrics only: ${metrics || 'no numeric claims'}. Style: near-black background, matte green #3EDC81 accents, minimal charts, no invented numbers, no long sentences. Photoreal or clean 3D, high-end annual report aesthetic.`
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1792x1024', quality: 'standard' }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data?.[0]?.url || null
}

export default function DynamicGraphic({
  postText,
  topicId,
  bundleGraphic = null,
  graphicSessionId = 0,
  onGraphicUpdate,
}) {
  const canvasRef = useRef(null)
  const [photo, setPhoto] = useState(null)
  const [aiImage, setAiImage] = useState(null)
  const [imageMode, setImageMode] = useState('headline')
  const [smartBusy, setSmartBusy] = useState(false)
  const [smartHint, setSmartHint] = useState('')
  const [layoutSalt, setLayoutSalt] = useState('')
  const [realtimeData, setRealtimeData] = useState(null)
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [newsroomImage, setNewsroomImage] = useState(null)
  const [newsroomStyle, setNewsroomStyle] = useState('')
  const [showOtherStyles, setShowOtherStyles] = useState(false)
  const [graphicProgress, setGraphicProgress] = useState(0)
  const [graphicStage, setGraphicStage] = useState('')
  const { msg: graphicMsg, flashOk, flashErr } = useFlashFeedback()

  const isGraphicLoading = smartBusy

  const reportGraphicProgress = useCallback((pct, stage) => {
    setGraphicProgress((prev) => Math.max(prev, pct))
    if (stage) setGraphicStage(stage)
  }, [])

  const resetGraphicProgress = useCallback(() => {
    setGraphicProgress(0)
    setGraphicStage('')
  }, [])

  const finishGraphicProgress = useCallback((stage = 'Graphic ready') => {
    setGraphicProgress(100)
    setGraphicStage(stage)
  }, [])

  const applyBundle = useCallback((bundle) => {
    if (!bundle) return
    setRealtimeData(bundle.realtimeData ?? null)
    setRefreshSeed(bundle.seed ?? 0)
    setImageMode(bundle.mode || 'headline')
    setNewsroomImage(bundle.newsroomImage || null)
    setNewsroomStyle(bundle.newsroomStyle || '')
    setSmartHint(bundle.hint || '')
    setPhoto(null)
    setAiImage(null)
  }, [])

  const topic = TOPICS.find((t) => t.id === topicId)

  const parsed = useMemo(() => parsePostContent(postText), [postText])
  const layout = useMemo(() => pickLayout(postText, topicId, layoutSalt), [postText, topicId, layoutSalt])
  const palette = useMemo(() => getPalette(postText), [postText])

  const headlineModel = useMemo(
    () =>
      buildHeadlineInfographicModel({
        postText,
        topicId,
        topicLabel: topic?.label,
        realtimeData,
        refreshSeed,
      }),
    [postText, topicId, topic?.label, realtimeData, refreshSeed],
  )

  useEffect(() => {
    if (bundleGraphic) {
      applyBundle(bundleGraphic)
      finishGraphicProgress(
        bundleGraphic.mode === 'newsroom' ? 'Newsroom graphic ready' : 'SVG graphic ready',
      )
    }
  }, [graphicSessionId, bundleGraphic, applyBundle, finishGraphicProgress])

  const runSmartVisual = useCallback(async () => {
    if (!postText || !topicId) return
    setSmartBusy(true)
    resetGraphicProgress()
    reportGraphicProgress(5, 'Refreshing graphic…')
    try {
      const graphic = await createCompanionGraphic({
        postText,
        topicId,
        topicLabel: topic?.label || '',
        realtimeData,
        seed: refreshSeed,
        preferNewsroom: hasOpenAiKey(),
        bumpSeed: true,
        onProgress: reportGraphicProgress,
      })
      applyBundle(graphic)
      onGraphicUpdate?.(graphic)
      finishGraphicProgress('Fresh graphic ready')

      if (graphic.mode === 'newsroom') {
        flashOk(`Fresh ${graphic.newsroomStyle} newsroom graphic.`)
      } else if (graphic.newsroomError) {
        flashOk('New SVG graphic ready.')
      } else {
        flashOk('Fresh verified SVG graphic.')
      }
    } catch {
      flashErr('Refresh failed — try again.')
    } finally {
      setSmartBusy(false)
    }
  }, [
    postText,
    topicId,
    topic?.label,
    realtimeData,
    refreshSeed,
    applyBundle,
    onGraphicUpdate,
    resetGraphicProgress,
    reportGraphicProgress,
    finishGraphicProgress,
    flashOk,
    flashErr,
  ])

  async function handleNewsroomClick() {
    if (newsroomImage) {
      switchVisualMode('newsroom', `${newsroomStyle} editorial graphic.`, 'Showing newsroom visual.')
      return
    }
    if (!hasOpenAiKey()) {
      flashErr('Save your OpenAI key in Settings, then tap Refresh graphic.')
      return
    }
    setSmartBusy(true)
    resetGraphicProgress()
    reportGraphicProgress(40, 'Creating newsroom graphic…')
    try {
      const graphic = await createCompanionGraphic({
        postText,
        topicId,
        topicLabel: topic?.label || '',
        realtimeData,
        seed: refreshSeed,
        forceNewsroom: true,
        bumpSeed: true,
        onProgress: reportGraphicProgress,
      })
      if (graphic.ok && graphic.mode === 'newsroom') {
        applyBundle(graphic)
        onGraphicUpdate?.(graphic)
        finishGraphicProgress('Newsroom graphic ready')
        flashOk(`${graphic.newsroomStyle} newsroom graphic ready.`)
      } else {
        flashErr(graphic.error || 'Could not create newsroom graphic.')
      }
    } finally {
      setSmartBusy(false)
    }
  }

  function handleDownload() {
    if (imageMode === 'newsroom' && newsroomImage) {
      window.open(newsroomImage, '_blank')
      flashOk('Opened newsroom graphic — save from the new tab.')
      return
    }
    if (imageMode === 'photo' && photo) {
      window.open(photo.url, '_blank')
      flashOk('Opened stock photo in a new tab — save from there.')
      return
    }
    if (imageMode === 'ai' && aiImage) {
      window.open(aiImage, '_blank')
      flashOk('Opened AI banner in a new tab — save from there.')
      return
    }
    const svgEl = canvasRef.current?.querySelector('svg')
    if (!svgEl) {
      flashErr('Nothing to download yet — generate a post first.')
      return
    }
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgEl)
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 627
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      const link = document.createElement('a')
      link.download = `linkedin-post-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      flashOk('PNG downloaded — attach to your LinkedIn post.')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      flashErr('PNG export failed — try again.')
    }
    img.src = url
  }

  function switchVisualMode(mode, hint, okMessage) {
    setImageMode(mode)
    setSmartHint(hint)
    flashOk(okMessage)
  }

  async function loadStockPhoto() {
    setSmartBusy(true)
    try {
      const stock = await tryUnsplashPhoto(parsed, topic)
      if (stock) {
        setPhoto(stock)
        setImageMode('photo')
        setSmartHint('Stock photo from Unsplash.')
        flashOk('Stock photo ready.')
      } else {
        flashErr('No stock photo match — try the news infographic instead.')
      }
    } finally {
      setSmartBusy(false)
    }
  }

  async function loadAiBanner() {
    setSmartBusy(true)
    try {
      const dalle = await tryDalleBanner(parsed, topic, topicId, postText)
      if (dalle) {
        setAiImage(dalle)
        setImageMode('ai')
        setSmartHint('AI banner — decorative only; numbers may be inaccurate.')
        flashOk('AI banner ready (use News infographic for verified data).')
      } else {
        flashErr('AI banner unavailable — check OpenAI key or use news infographic.')
      }
    } finally {
      setSmartBusy(false)
    }
  }

  if (!postText) return null

  const hasFallbackContent = parsed.stats.length > 0 || parsed.arrowLines.length > 0

  const modeLabel = {
    newsroom: 'Newsroom',
    headline: 'News infographic',
    generated: 'Classic',
    photo: 'Stock photo',
    ai: 'AI banner',
  }[imageMode] || 'News infographic'

  return (
    <section className="image-display fade-in-up">
      <h2 className="section-title">Post Graphic</h2>

      <div className="smart-visual-row">
        <button
          type="button"
          className={`smart-visual-btn ${isGraphicLoading ? 'is-loading' : ''}`}
          onClick={() => void runSmartVisual()}
          disabled={isGraphicLoading}
        >
          {isGraphicLoading ? (
            <>
              <ProgressRing progress={graphicProgress} size={22} strokeWidth={3} className="smart-visual-btn-ring" />
              <span>Creating graphic</span>
            </>
          ) : (
            '↻ Refresh graphic'
          )}
        </button>
        <span className="smart-visual-mode">{modeLabel}</span>
      </div>

      <button
        type="button"
        className="smart-visual-more-toggle"
        onClick={() => setShowOtherStyles((v) => !v)}
      >
        {showOtherStyles ? '▾ Hide other styles' : '▸ Other styles'}
      </button>

      {showOtherStyles && (
        <div className="smart-visual-alt-row">
          <button
            type="button"
            className={`smart-visual-secondary ${imageMode === 'headline' ? 'active' : ''}`}
            onClick={() =>
              switchVisualMode(
                'headline',
                'Headlines from GNews + stats verified against your data registry.',
                'Showing news infographic.',
              )
            }
          >
            News infographic
          </button>
          {hasOpenAiKey() && (
            <button
              type="button"
              className={`smart-visual-secondary ${imageMode === 'newsroom' ? 'active' : ''}`}
              onClick={() => void handleNewsroomClick()}
              disabled={smartBusy}
            >
              {smartBusy && !newsroomImage ? 'Creating…' : 'Newsroom'}
            </button>
          )}
          <button
            type="button"
            className={`smart-visual-secondary ${imageMode === 'generated' ? 'active' : ''}`}
            onClick={() => {
              setLayoutSalt(String(Date.now()))
              switchVisualMode('generated', 'Classic layout from post text.', 'Showing classic infographic.')
            }}
          >
            Classic
          </button>
          <button
            type="button"
            className="smart-visual-secondary"
            onClick={() => void loadStockPhoto()}
            disabled={smartBusy}
          >
            Stock photo
          </button>
          <button
            type="button"
            className="smart-visual-secondary"
            onClick={() => void loadAiBanner()}
            disabled={smartBusy}
          >
            AI banner
          </button>
        </div>
      )}
      {isGraphicLoading && (
        <div className="graphic-progress-panel">
          <ProgressRing progress={graphicProgress} size={72} strokeWidth={5} />
          <p className="graphic-progress-stage">{graphicStage || 'Refreshing graphic…'}</p>
        </div>
      )}
      {smartHint && !isGraphicLoading && <p className="smart-visual-hint">{smartHint}</p>}
      {!smartHint && !isGraphicLoading && headlineModel.hasNews && (
        <p className="smart-visual-hint">
          {headlineModel.verifiedCount} verified stat{headlineModel.verifiedCount === 1 ? '' : 's'} · lead story from {headlineModel.leadHeadline?.source}
        </p>
      )}

      {imageMode === 'newsroom' && newsroomImage && (
        <div className="image-wrapper image-wrapper-graphic">
          <img src={newsroomImage} alt="Newsroom-style editorial infographic" className="companion-photo" />
          <div className="unsplash-credit">
            {newsroomStyle} editorial style · DALL·E 3 · verified stats only · Prem Iyer
          </div>
        </div>
      )}

      {imageMode === 'headline' && (
        <div className="image-wrapper image-wrapper-graphic" ref={canvasRef}>
          <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
            <rect width="1200" height="627" fill="#0a0a0a" />
            <HeadlineInfographic model={headlineModel} palette={palette} />
            <rect x="0" y="600" width="1200" height="27" fill="#0f0f0f" />
            <text x="100" y="618" fill={palette.accent} fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">
              Prem Iyer
            </text>
            <text x="190" y="618" fill="#333" fontSize="10" fontFamily="Inter, sans-serif">
              ·  AI Software Transformation
            </text>
            <text x="1100" y="618" textAnchor="end" fill="#222" fontSize="10" fontFamily="Inter, sans-serif">
              {topic?.label || 'LinkedIn Post'}
            </text>
          </svg>
        </div>
      )}

      {imageMode === 'generated' && (
        <div className="image-wrapper image-wrapper-graphic" ref={canvasRef}>
          <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
            <rect width="1200" height="627" fill="#0a0a0a" />
            {hasFallbackContent ? (
              renderLayout(layout, parsed, palette, postText)
            ) : (
              <text x="600" y="280" textAnchor="middle" fill="#333" fontSize="18" fontFamily="Inter, sans-serif">
                Generate or edit a post to create a unique graphic
              </text>
            )}
            <rect x="0" y="600" width="1200" height="27" fill="#0f0f0f" />
            <text x="100" y="618" fill={palette.accent} fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">
              Prem Iyer
            </text>
            <text x="190" y="618" fill="#333" fontSize="10" fontFamily="Inter, sans-serif">
              ·  AI Software Transformation
            </text>
            <text x="1100" y="618" textAnchor="end" fill="#222" fontSize="10" fontFamily="Inter, sans-serif">
              {topic?.label || 'LinkedIn Post'}
            </text>
          </svg>
        </div>
      )}

      {imageMode === 'photo' && photo && (
        <div className="image-wrapper image-wrapper-graphic">
          <img src={photo.url} alt="LinkedIn post companion" className="companion-photo" />
          <div className="unsplash-credit">
            Photo by <a href={photo.link} target="_blank" rel="noopener noreferrer">{photo.credit}</a> on Unsplash
          </div>
        </div>
      )}

      {imageMode === 'ai' && aiImage && (
        <div className="image-wrapper image-wrapper-graphic">
          <img src={aiImage} alt="AI-generated LinkedIn graphic" className="companion-photo" />
          <div className="unsplash-credit">Generated with DALL·E 3 — Prem Iyer</div>
        </div>
      )}

      <button type="button" className="download-btn" onClick={handleDownload}>
        Download Image (PNG)
      </button>
      <ActionFeedback msg={graphicMsg} />
    </section>
  )
}
