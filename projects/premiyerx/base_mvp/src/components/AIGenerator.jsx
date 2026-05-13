import { useState } from 'react'
import TOPICS from '../data/postTemplates'
import { getActiveProfile } from '../data/voiceProfile'
import { fetchRealtimeContext, formatRealtimeForPrompt } from '../utils/realtimeData'
import { buildVarietyEnvelope, recordGeneratedHook } from '../utils/generationVariety'

export default function AIGenerator({ topicId, onGenerated }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_key') || '')
  const [unsplashKey, setUnsplashKey] = useState(() => localStorage.getItem('unsplash_access_key') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [customAngle, setCustomAngle] = useState('')
  const [expanded, setExpanded] = useState(false)

  const topic = TOPICS.find((t) => t.id === topicId)
  const hasKey = !!apiKey.trim()

  function saveKey(key) {
    setApiKey(key)
    if (key) localStorage.setItem('openai_key', key)
    else localStorage.removeItem('openai_key')
  }

  function saveUnsplashKey(key) {
    setUnsplashKey(key)
    if (key.trim()) localStorage.setItem('unsplash_access_key', key.trim())
    else localStorage.removeItem('unsplash_access_key')
  }

  async function handleGenerate() {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      return
    }
    setLoading(true)
    setError(null)

    const systemPrompt = getActiveProfile().promptInstructions

    let realtimeContext = ''
    try {
      const realtimeData = await fetchRealtimeContext(topicId, {
        forceRefresh: true,
        topicLabel: topic?.label || '',
      })
      realtimeContext = formatRealtimeForPrompt(realtimeData, topicId)
    } catch { /* continue without realtime data */ }

    const varietyBlock = buildVarietyEnvelope(topicId, topic.label)

    const userPrompt = `Write a LinkedIn post in the content pillar: "${topic.label}".

Pillar context (use themes from this, stay sourced): ${topic.description}

${customAngle ? `Specific angle or news to cover: ${customAngle}` : ''}

${varietyBlock}
CONTEXT:
- Content pillar: "${topic.label}" — ${topic.description}
- Target audience: CIOs, CTOs, CDOs, VPs of Engineering, DevOps/DevSecOps leaders, board members
- The post MUST feel timely: ground the narrative in the research headlines below (this fetch is refreshed every time you generate).
${realtimeContext}

DATA ACCURACY (non-negotiable):
- Every stat MUST have an inline parenthetical source (e.g., "(Gartner, 2025)")
- Cursor facts: millions of developers, 1M+ DAU, 50,000+ businesses, half the Fortune 500 (Cursor, 2026). Raised $2.3B at $29B valuation Nov 2025. $2B+ ARR.
- Never fabricate numbers. If uncertain, use directional language instead.

ALGORITHM OPTIMIZATION (every rule below is based on LinkedIn's 2026 algorithm signals and analysis of creators who've built 500M+ impressions):

1. HOOK (determines if anyone clicks "see more" — 80% of your post's success):
   - One-liner, 8-12 words, contains a NUMBER
   - First-person or direct address. NEVER start with negative words (stop/don't/quit — 30% lower performance)
   - Must create a curiosity gap or make a bold claim

2. RE-HOOK (line 2-3):
   - Parenthetical that amplifies the hook: "(And the $2B lesson most companies are missing)"
   - Can also use "what nobody talks about" or "here's the real story" framing

3. BODY (optimized for DWELL TIME — the #1 signal in 2026. 61+ seconds of dwell = 15.6% engagement vs 1.2% at 3 seconds):
   - Every 1-2 sentences on its own line. Zero walls of text. Mobile-first (60% of LinkedIn is mobile)
   - Use → arrows for data point lists
   - 2-3 professional emoji anchors (📊 💡 🔑 🎯) at SECTION TRANSITIONS only — never scatter
   - Include a numbered framework (3-5 steps/points) — frameworks increase dwell time
   - First-person authority: "I've seen", "I talked to 30 CIOs", "Here's what the data shows"
   - Position insights as facts, not opinions
   - Include a "flip the script" moment: "But here's what nobody talks about..."
   - Minimum 5 specific data points with source citations

4. STRUCTURE PATTERN (use one):
   - PAS: Problem → Agitate → Solution
   - Relatable Enemy → Flip the Script → Gasoline
   - Framework reveal: "The 4 questions that actually matter"

5. COMMENT TRIGGER (comments = 15x the algorithmic weight of likes):
   - End with a SPECIFIC question using "you/your"
   - Ask about THEIR experience, not generic "thoughts?"
   - Examples: "Which of these fears hits closest to home for YOUR org?" or "How does YOUR team evaluate AI tools?"

6. HASHTAGS: Exactly 3-5. Mix: 1 broad + 2 mid-size + 1-2 niche. Place at end.

7. FIRST COMMENT: Generate a P.S. with:
   - Additional insight NOT in the main post (15+ words minimum)
   - End with a follow-up question designed to spark 3+ reply threads
   - Threaded conversations unlock viral Phase 3 distribution

8. LENGTH: 200-280 words (1000-1800 chars). Enough depth for 60+ seconds dwell time.

Structure the output EXACTLY like this (no markdown, plain text only):
HOOK:
[One-liner hook with number]

BODY:
[Re-hook in parentheses, then body optimized for dwell time: aggressive line breaks, arrows, emoji anchors, numbered framework, data with citations, flip-the-script moment]

CTA:
[Specific "you/your" question that triggers comments]

HASHTAGS:
[3-5 hashtags: 1 broad + 2 mid + 1-2 niche]

FIRST_COMMENT:
[P.S. with additional insight + follow-up question for threaded replies]`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.92,
          top_p: 0.94,
          presence_penalty: 0.55,
          frequency_penalty: 0.35,
          max_tokens: 1200,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      const raw = data.choices[0].message.content

      const hookMatch = raw.match(/HOOK:\s*\n([\s\S]*?)(?=\nBODY:)/i)
      const bodyMatch = raw.match(/BODY:\s*\n([\s\S]*?)(?=\nCTA:)/i)
      const ctaMatch = raw.match(/CTA:\s*\n([\s\S]*?)(?=\nHASHTAGS:)/i)
      const hashMatch = raw.match(/HASHTAGS:\s*\n([\s\S]*?)(?=\nFIRST_COMMENT:|$)/i)
      const commentMatch = raw.match(/FIRST_COMMENT:\s*\n([\s\S]*?)$/i)

      const hookOut = hookMatch ? hookMatch[1].trim() : raw.slice(0, 200)
      recordGeneratedHook(hookOut)

      onGenerated({
        hook: hookOut,
        body: bodyMatch ? bodyMatch[1].trim() : raw,
        cta: ctaMatch ? ctaMatch[1].trim() : '',
        hashtags: hashMatch ? hashMatch[1].trim() : '',
        firstComment: commentMatch ? commentMatch[1].trim() : '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`ai-generator ${expanded ? 'expanded' : 'collapsed'}`}>
      <button className="ai-toggle" onClick={() => setExpanded(!expanded)}>
        <div className="ai-toggle-left">
          <span className="ai-toggle-icon">{expanded ? '▾' : '▸'}</span>
          <span className="ai-toggle-title">AI-Powered Generation</span>
          {hasKey && !expanded && <span className="ai-key-badge">API key saved</span>}
        </div>
        <span className="ai-toggle-hint">
          {expanded ? '' : 'GPT-4o + your voice profile'}
        </span>
      </button>

      {expanded && (
        <div className="ai-body">
          <p className="ai-subtitle">
            Uses your voice profile (including optional pasted posts) + OpenAI GPT-4o. Each run fetches fresh headlines
            (Hacker News + optional GNews — set key under Your LinkedIn Writing Style). Keys stay in this browser only.
          </p>

          <div className="ai-key-row">
            <input
              type="password"
              className="ai-input"
              placeholder="OpenAI API Key (sk-...) — for AI posts & optional DALL·E visuals"
              value={apiKey}
              onChange={(e) => saveKey(e.target.value)}
            />
            {hasKey && <span className="key-saved">Saved locally</span>}
          </div>

          <div className="ai-key-row">
            <input
              type="password"
              className="ai-input"
              placeholder="Unsplash Access Key (optional — for “Get best visual” stock matches)"
              value={unsplashKey}
              onChange={(e) => saveUnsplashKey(e.target.value)}
            />
            {unsplashKey.trim() && <span className="key-saved">Unsplash saved</span>}
          </div>

          <textarea
            className="ai-angle-input"
            placeholder="Optional: specific angle, news item, or data point to cover..."
            value={customAngle}
            onChange={(e) => setCustomAngle(e.target.value)}
            rows={2}
          />

          <button
            className="ai-generate-btn"
            onClick={handleGenerate}
            disabled={loading || !hasKey}
          >
            {loading ? 'Generating with AI...' : 'Generate with AI + Voice Profile'}
          </button>

          {error && <div className="ai-error">{error}</div>}
        </div>
      )}
    </div>
  )
}
