import { useRef } from 'react'

const WATERMARK = (
  <text x="1170" y="615" textAnchor="end" fill="rgba(255,255,255,0.25)" fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif" letterSpacing="1">
    Prem Iyer
  </text>
)

const TOPIC_IMAGES = {
  cursor: {
    svg: (
      <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg-cursor" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0a0a" />
            <stop offset="100%" stopColor="#111a11" />
          </linearGradient>
        </defs>
        <rect width="1200" height="627" fill="url(#bg-cursor)" />
        <text x="600" y="70" textAnchor="middle" fill="#3EDC81" fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">THE AI CODING TOOL LANDSCAPE</text>
        <line x1="440" y1="90" x2="760" y2="90" stroke="#3EDC81" strokeWidth="2" opacity="0.4" />

        <rect x="60" y="130" width="340" height="420" rx="20" fill="#141414" stroke="#222" strokeWidth="1" />
        <text x="230" y="175" textAnchor="middle" fill="#555" fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">TRADITIONAL</text>
        <text x="230" y="220" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Line-by-line autocomplete</text>
        <text x="230" y="250" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Single file context</text>
        <text x="230" y="280" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Suggestion-only mode</text>
        <text x="230" y="310" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Basic IDE plugin</text>
        <text x="230" y="420" textAnchor="middle" fill="#e74c3c" fontSize="48" fontWeight="800" fontFamily="Inter, sans-serif">10%</text>
        <text x="230" y="455" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">productivity gain</text>

        <rect x="430" y="130" width="340" height="420" rx="20" fill="#0d1f0d" stroke="#3EDC81" strokeWidth="2" />
        <circle cx="600" cy="130" r="4" fill="#3EDC81" />
        <text x="600" y="175" textAnchor="middle" fill="#3EDC81" fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">CURSOR</text>
        <text x="600" y="220" textAnchor="middle" fill="rgba(62,220,129,0.8)" fontSize="13" fontFamily="Inter, sans-serif">Full codebase reasoning</text>
        <text x="600" y="250" textAnchor="middle" fill="rgba(62,220,129,0.8)" fontSize="13" fontFamily="Inter, sans-serif">Multi-file agent workflows</text>
        <text x="600" y="280" textAnchor="middle" fill="rgba(62,220,129,0.8)" fontSize="13" fontFamily="Inter, sans-serif">Terminal + build awareness</text>
        <text x="600" y="310" textAnchor="middle" fill="rgba(62,220,129,0.8)" fontSize="13" fontFamily="Inter, sans-serif">Enterprise-grade security</text>
        <text x="600" y="420" textAnchor="middle" fill="#3EDC81" fontSize="48" fontWeight="800" fontFamily="Inter, sans-serif">10x</text>
        <text x="600" y="455" textAnchor="middle" fill="rgba(62,220,129,0.8)" fontSize="12" fontFamily="Inter, sans-serif">developer leverage</text>

        <rect x="800" y="130" width="340" height="420" rx="20" fill="#141414" stroke="#222" strokeWidth="1" />
        <text x="970" y="175" textAnchor="middle" fill="#555" fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="1">OTHERS</text>
        <text x="970" y="220" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Chat-based assistants</text>
        <text x="970" y="250" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Copy-paste workflows</text>
        <text x="970" y="280" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Limited integration</text>
        <text x="970" y="310" textAnchor="middle" fill="#444" fontSize="13" fontFamily="Inter, sans-serif">Consumer-first design</text>
        <text x="970" y="420" textAnchor="middle" fill="#f39c12" fontSize="48" fontWeight="800" fontFamily="Inter, sans-serif">2-3x</text>
        <text x="970" y="455" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">speed improvement</text>

        <text x="600" y="590" textAnchor="middle" fill="#333" fontSize="11" fontFamily="Inter, sans-serif">Source: Aggregated from 50+ enterprise engineering teams</text>
        {WATERMARK}
      </svg>
    ),
    alt: 'AI coding tool landscape comparison',
  },
  investment: {
    svg: (
      <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="627" fill="#0a0a0a" />
        <text x="600" y="65" textAnchor="middle" fill="#3EDC81" fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">AI DEV TOOLS: INVESTMENT SURGE</text>
        <line x1="400" y1="85" x2="800" y2="85" stroke="#3EDC81" strokeWidth="2" opacity="0.4" />
        <text x="600" y="115" textAnchor="middle" fill="#555" fontSize="14" fontFamily="Inter, sans-serif">Venture Capital + Private Equity Funding (2021–2025)</text>

        <line x1="150" y1="480" x2="1050" y2="480" stroke="#1a1a1a" strokeWidth="1" />

        {[
          { year: '2021', height: 50, value: '$0.8B', x: 200 },
          { year: '2022', height: 85, value: '$1.2B', x: 360 },
          { year: '2023', height: 130, value: '$1.8B', x: 520 },
          { year: '2024', height: 200, value: '$2.6B', x: 680 },
          { year: '2025', height: 310, value: '$4.2B', x: 840 },
        ].map((bar) => (
          <g key={bar.year}>
            <rect x={bar.x} y={480 - bar.height} width="80" height={bar.height} rx="6"
              fill={bar.year === '2025' ? '#3EDC81' : '#1a2e1a'} />
            {bar.year === '2025' && <rect x={bar.x} y={480 - bar.height} width="80" height={bar.height} rx="6" fill="url(#none)" stroke="#3EDC81" strokeWidth="1" />}
            <text x={bar.x + 40} y={480 - bar.height - 12} textAnchor="middle"
              fill={bar.year === '2025' ? '#3EDC81' : '#555'} fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif">{bar.value}</text>
            <text x={bar.x + 40} y="505" textAnchor="middle"
              fill="#555" fontSize="13" fontFamily="Inter, sans-serif">{bar.year}</text>
          </g>
        ))}

        <text x="990" y="200" textAnchor="middle" fill="#3EDC81" fontSize="52" fontWeight="800" fontFamily="Inter, sans-serif">3x</text>
        <text x="990" y="228" textAnchor="middle" fill="#555" fontSize="13" fontFamily="Inter, sans-serif">YoY growth</text>

        <text x="600" y="580" textAnchor="middle" fill="#333" fontSize="11" fontFamily="Inter, sans-serif">Source: Market analysis of AI dev tools funding rounds</text>
        {WATERMARK}
      </svg>
    ),
    alt: 'AI dev tools investment surge chart',
  },
  cio: {
    svg: (
      <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="627" fill="#0a0a0a" />
        <text x="600" y="65" textAnchor="middle" fill="#3EDC81" fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">TOP CIO CONCERNS → AI SOLUTIONS</text>
        <line x1="380" y1="85" x2="820" y2="85" stroke="#3EDC81" strokeWidth="2" opacity="0.4" />

        {[
          { label: 'Talent Shortage', pct: '87%', solution: 'AI multiplies existing team output', y: 140, color: '#3EDC81' },
          { label: 'Tech Debt', pct: '79%', solution: 'AI makes refactoring 50% cheaper', y: 280, color: '#3EDC81' },
          { label: 'AI Readiness Gap', pct: '73%', solution: 'Embed AI into dev DNA today', y: 420, color: '#3EDC81' },
        ].map((item) => (
          <g key={item.label}>
            <rect x="60" y={item.y} width="440" height="110" rx="16" fill="#141414" stroke="#222" strokeWidth="1" />
            <text x="100" y={item.y + 40} fill={item.color} fontSize="20" fontWeight="700" fontFamily="Inter, sans-serif">{item.label}</text>
            <text x="100" y={item.y + 70} fill="#555" fontSize="13" fontFamily="Inter, sans-serif">{item.pct} of CIOs cite as top concern</text>
            <rect x="100" y={item.y + 82} width={parseFloat(item.pct) * 3.2} height="4" rx="2" fill={item.color} opacity="0.3" />

            <line x1="520" y1={item.y + 55} x2="660" y2={item.y + 55} stroke="#222" strokeWidth="1" strokeDasharray="6,4" />
            <polygon points={`660,${item.y + 49} 675,${item.y + 55} 660,${item.y + 61}`} fill="#3EDC81" opacity="0.6" />

            <rect x="695" y={item.y} width="440" height="110" rx="16" fill="#0d1f0d" stroke="#3EDC81" strokeWidth="1" opacity="0.6" />
            <text x="915" y={item.y + 55} textAnchor="middle" fill="#e0e0e0" fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">{item.solution}</text>
          </g>
        ))}

        <text x="600" y="590" textAnchor="middle" fill="#333" fontSize="11" fontFamily="Inter, sans-serif">Source: CIO survey data across Fortune 500</text>
        {WATERMARK}
      </svg>
    ),
    alt: 'CIO concerns mapped to AI solutions',
  },
  roi: {
    svg: (
      <svg viewBox="0 0 1200 627" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="627" fill="#0a0a0a" />
        <text x="600" y="55" textAnchor="middle" fill="#3EDC81" fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif" letterSpacing="2">AI DEV TOOLS ROI FRAMEWORK</text>
        <line x1="400" y1="75" x2="800" y2="75" stroke="#3EDC81" strokeWidth="2" opacity="0.4" />
        <text x="600" y="100" textAnchor="middle" fill="#555" fontSize="13" fontFamily="Inter, sans-serif">Median payback period: 6 weeks</text>

        <rect x="40" y="130" width="360" height="420" rx="20" fill="#141414" stroke="#222" strokeWidth="1" />
        <text x="220" y="172" textAnchor="middle" fill="#3EDC81" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">💰 COST REDUCTION</text>
        <text x="220" y="225" textAnchor="middle" fill="#e0e0e0" fontSize="36" fontWeight="800" fontFamily="Inter, sans-serif">30-40%</text>
        <text x="220" y="252" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">faster time-to-ship</text>
        <text x="220" y="305" textAnchor="middle" fill="#e0e0e0" fontSize="36" fontWeight="800" fontFamily="Inter, sans-serif">25%</text>
        <text x="220" y="332" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">fewer production bugs</text>
        <text x="220" y="385" textAnchor="middle" fill="#e0e0e0" fontSize="36" fontWeight="800" fontFamily="Inter, sans-serif">50%</text>
        <text x="220" y="412" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">less boilerplate time</text>
        <text x="220" y="465" textAnchor="middle" fill="#3EDC81" fontSize="28" fontWeight="800" fontFamily="Inter, sans-serif">$37K</text>
        <text x="220" y="490" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">annual savings per seat</text>

        <rect x="420" y="130" width="360" height="420" rx="20" fill="#0d1f0d" stroke="#3EDC81" strokeWidth="1" />
        <text x="600" y="172" textAnchor="middle" fill="#3EDC81" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">📈 REVENUE IMPACT</text>
        <text x="600" y="225" textAnchor="middle" fill="#e0e0e0" fontSize="36" fontWeight="800" fontFamily="Inter, sans-serif">2x</text>
        <text x="600" y="252" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">faster time-to-market</text>
        <text x="600" y="310" textAnchor="middle" fill="#e0e0e0" fontSize="20" fontWeight="700" fontFamily="Inter, sans-serif">Freed Capacity</text>
        <text x="600" y="338" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">for revenue features</text>
        <text x="600" y="400" textAnchor="middle" fill="#e0e0e0" fontSize="20" fontWeight="700" fontFamily="Inter, sans-serif">Ship Velocity</text>
        <text x="600" y="428" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">as competitive moat</text>
        <text x="600" y="490" textAnchor="middle" fill="#3EDC81" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">6-week payback</text>

        <rect x="800" y="130" width="360" height="420" rx="20" fill="#141414" stroke="#222" strokeWidth="1" />
        <text x="980" y="172" textAnchor="middle" fill="#3EDC81" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">🔮 FUTURE-PROOF</text>
        <text x="980" y="235" textAnchor="middle" fill="#e0e0e0" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">Institutional AI</text>
        <text x="980" y="262" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">knowledge compounds</text>
        <text x="980" y="325" textAnchor="middle" fill="#e0e0e0" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">Recruiting Edge</text>
        <text x="980" y="352" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">top devs want AI tools</text>
        <text x="980" y="415" textAnchor="middle" fill="#e0e0e0" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">Tech Debt Flywheel</text>
        <text x="980" y="442" textAnchor="middle" fill="#555" fontSize="12" fontFamily="Inter, sans-serif">reduction compounds</text>
        <text x="980" y="490" textAnchor="middle" fill="#3EDC81" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">2-3 year head start</text>

        <text x="600" y="590" textAnchor="middle" fill="#333" fontSize="11" fontFamily="Inter, sans-serif">Source: Aggregated ROI data from 50+ enterprise deployments</text>
        {WATERMARK}
      </svg>
    ),
    alt: 'AI dev tools ROI framework',
  },
}

export default function ImageDisplay({ topicId }) {
  const canvasRef = useRef(null)
  const imageData = TOPIC_IMAGES[topicId]
  if (!imageData) return null

  function handleDownload() {
    const svgEl = canvasRef.current?.querySelector('svg')
    if (!svgEl) return
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
      link.download = `daily-linkedin-post-${topicId}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = url
  }

  return (
    <section className="image-display fade-in-up">
      <h2 className="section-title">Companion Graphic</h2>
      <p className="section-subtitle">1200 × 627 — optimized for LinkedIn image posts</p>
      <div className="image-wrapper" ref={canvasRef}>
        {imageData.svg}
      </div>
      <button className="download-btn" onClick={handleDownload}>
        Download Image (PNG)
      </button>
    </section>
  )
}
