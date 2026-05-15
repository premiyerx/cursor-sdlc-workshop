import { useState, useCallback, useMemo } from 'react'
import TOPICS from './data/postTemplates'
import { findCitations } from './data/citations'
import { getRealtimeSprinkle, fetchRealtimeContext, invalidateRealtimeCache } from './utils/realtimeData'
import { weaveNewsIntoTemplate, getResearchSummary } from './utils/newsCraft'
import { pickTemplateIndex, recordGeneratedHook } from './utils/generationVariety'
import { hasOpenAiKey, generateAIPost } from './utils/aiPostGenerator'
import { createCompanionGraphic } from './utils/companionGraphic'
import { bumpRefreshSeed } from './utils/freshnessRotation'
import VoiceProfile from './components/VoiceProfile'
import AIGenerator from './components/AIGenerator'
import PostDisplay from './components/PostDisplay'
import PostPreview from './components/PostPreview'
import AlgorithmScorer from './components/AlgorithmScorer'
import DynamicGraphic from './components/DynamicGraphic'
import FirstComment from './components/FirstComment'
import CarouselGenerator from './components/CarouselGenerator'
import FactCheckGate from './components/FactCheckGate'
import Scheduler from './components/Scheduler'
import Analytics from './components/Analytics'
import DataManager from './components/DataManager'
import { useFlashFeedback } from './hooks/useFlashFeedback'
import ActionFeedback from './components/ActionFeedback'
import ProgressRing from './components/ProgressRing'

const DAILY_ANGLES = {
  Monday: { suggested: 'cursor', reason: 'Monday = high engagement from professionals starting their week.' },
  Tuesday: { suggested: 'investment', reason: 'Peak LinkedIn engagement day. Market content performs best.' },
  Wednesday: { suggested: 'cio', reason: 'Mid-week CIOs and VPs are most active between meetings.' },
  Thursday: { suggested: 'roi', reason: 'Thursday audiences want ROI data for Friday leadership meetings.' },
  Friday: { suggested: 'cursor', reason: 'Lighter tone works. Stories and anecdotes about AI tools resonate.' },
  Saturday: { suggested: 'investment', reason: 'Weekend = big-picture think pieces for deep engagement.' },
  Sunday: { suggested: 'cio', reason: 'Sunday evening catches leaders doing weekly planning.' },
}

export default function App() {
  const [activeTab, setActiveTab] = useState('create')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [format, setFormat] = useState('image')
  const [generatedPost, setGeneratedPost] = useState(null)
  const [liveText, setLiveText] = useState('')
  const [generateBusy, setGenerateBusy] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateStage, setGenerateStage] = useState('')
  const [customAngle, setCustomAngle] = useState('')
  const [companionGraphic, setCompanionGraphic] = useState(null)
  const [graphicSessionId, setGraphicSessionId] = useState(0)
  const { msg: generateMsg, flashOk: flashGenerateOk, flashErr: flashGenerateErr } = useFlashFeedback()

  const reportGenerateProgress = useCallback((pct, stage) => {
    setGenerateProgress((prev) => Math.max(prev, pct))
    if (stage) setGenerateStage(stage)
  }, [])

  const resetGenerateProgress = useCallback(() => {
    setGenerateProgress(0)
    setGenerateStage('')
  }, [])

  const topic = TOPICS.find((t) => t.id === selectedTopic)

  const today = useMemo(() => {
    const d = new Date()
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
    const hour = d.getHours()
    return {
      dayName,
      dateStr: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      greeting: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
      angle: DAILY_ANGLES[dayName],
    }
  }, [])

  const suggestedTopic = TOPICS.find((t) => t.id === today.angle?.suggested)

  const appendCitations = useCallback((text) => {
    const cites = findCitations(text)
    if (cites.length === 0) return text
    return `${text}\n\n—\nSources: ${cites.join(' · ')}`
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!topic) return
    setGenerateBusy(true)
    resetGenerateProgress()
    setCompanionGraphic(null)
    try {
      if (hasOpenAiKey()) {
        const { post, realtimeData, seed } = await generateAIPost(selectedTopic, {
          customAngle,
          onProgress: reportGenerateProgress,
        })
        setGeneratedPost(post)
        const raw = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags}`
        const cited = appendCitations(raw)
        setLiveText(cited)

        reportGenerateProgress(68, 'Creating newsroom graphic…')
        const graphic = await createCompanionGraphic({
          postText: cited,
          topicId: selectedTopic,
          topicLabel: topic.label,
          realtimeData,
          seed,
          preferNewsroom: true,
          onProgress: (pct, stage) => {
            const mapped = 68 + Math.round(pct * 0.32)
            reportGenerateProgress(mapped, stage)
          },
        })
        setCompanionGraphic(graphic)
        setGraphicSessionId((n) => n + 1)

        if (graphic.mode === 'newsroom') {
          flashGenerateOk('Post and newsroom graphic ready — scroll to review.')
        } else if (graphic.newsroomError) {
          flashGenerateOk('Post ready. SVG graphic shown — newsroom image could not be created this time.')
        } else {
          flashGenerateOk('Post and verified SVG graphic ready.')
        }
        return
      }

      reportGenerateProgress(10, 'Choosing template…')
      bumpRefreshSeed(selectedTopic)
      invalidateRealtimeCache(selectedTopic)

      const templates = topic.templates
      const idx = pickTemplateIndex(selectedTopic, templates.length)
      const pick = templates[idx]
      setGeneratedPost(pick)
      recordGeneratedHook(pick.hook)
      const freshDataPoint = getRealtimeSprinkle(selectedTopic)
      const freshLine = freshDataPoint ? `\n\n📊 Fresh data: ${freshDataPoint}` : ''
      let woven = pick
      let headlineCount = 0
      let leadTitle = ''
      let rt = null
      try {
        reportGenerateProgress(28, 'Loading today\'s headlines…')
        rt = await fetchRealtimeContext(selectedTopic, {
          forceRefresh: true,
          topicLabel: topic?.label || '',
        })
        reportGenerateProgress(52, 'Weaving headlines into post…')
        const summary = getResearchSummary(rt, selectedTopic)
        headlineCount = summary.count
        leadTitle = summary.lead?.title || ''
        woven = weaveNewsIntoTemplate(pick, rt, selectedTopic)
      } catch {
        reportGenerateProgress(45, 'Using template without live headlines…')
      }

      const raw = `${woven.hook}\n\n${woven.body}${freshLine}\n\n${woven.cta}\n\n${woven.hashtags}`
      const cited = appendCitations(raw)
      setLiveText(cited)

      reportGenerateProgress(72, 'Creating graphic…')
      const graphic = await createCompanionGraphic({
        postText: cited,
        topicId: selectedTopic,
        topicLabel: topic.label,
        realtimeData: rt,
        preferNewsroom: false,
        onProgress: (pct, stage) => {
          const mapped = 72 + Math.round(pct * 0.28)
          reportGenerateProgress(mapped, stage)
        },
      })
      setCompanionGraphic(graphic)
      setGraphicSessionId((n) => n + 1)
      reportGenerateProgress(100, 'Post ready')

      flashGenerateOk(
        headlineCount > 0
          ? leadTitle
            ? `Post and graphic ready — woven with ${headlineCount} headline${headlineCount === 1 ? '' : 's'}.`
            : `Post and graphic ready — ${headlineCount} live headline${headlineCount === 1 ? '' : 's'}.`
          : 'Post and graphic ready.',
      )
    } catch (err) {
      flashGenerateErr(err?.message || 'Could not generate. Check your connection and API key.')
    } finally {
      setGenerateBusy(false)
    }
  }, [topic, selectedTopic, customAngle, appendCitations, flashGenerateOk, flashGenerateErr, reportGenerateProgress, resetGenerateProgress])

  const handleTopicSelect = useCallback((id) => {
    setSelectedTopic(id)
    setGeneratedPost(null)
    setLiveText('')
    setCompanionGraphic(null)
  }, [])

  const handlePostEdit = useCallback((text) => {
    setLiveText(text)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">AI LinkedIn Post Generator</h1>
          <p className="app-subtitle">Optimized for LinkedIn Algorithms</p>
          <nav className="app-tabs">
            <button className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
              Create
            </button>
            <button className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
              Publish & Remind
            </button>
            <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
              Content Log
            </button>
            <button className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
              Data Registry
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'create' && (
          <>
            {/* STEP 1: Welcome + Context — sets the personal tone */}
            <section className="hero-greeting">
              <div className="hero-top">
                <div className="hero-welcome">
                  <h2 className="hero-hello">{today.greeting}, Prem</h2>
                  <p className="hero-date">{today.dateStr}</p>
                </div>
              </div>

              {suggestedTopic && !selectedTopic && (
                <div className="hero-suggestion">
                  <span className="hero-suggestion-icon">{suggestedTopic.icon}</span>
                  <span className="hero-suggestion-text">
                    <strong>Recommended:</strong> {suggestedTopic.label} — {today.angle.reason}
                  </span>
                  <button className="hero-suggestion-btn" onClick={() => handleTopicSelect(today.angle.suggested)}>
                    Use this
                  </button>
                </div>
              )}
            </section>

            {/* STEP 2: The one action — pick, configure, generate */}
            <section className="command-bar">
              <div className="command-row">
                <div className="command-group">
                  <span className="command-label">Topic</span>
                  <div className="topic-chips">
                    {TOPICS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`topic-chip ${selectedTopic === t.id ? 'active' : ''}`}
                        onClick={() => handleTopicSelect(t.id)}
                        title={t.description}
                      >
                        <span className="chip-icon" aria-hidden="true">{t.icon}</span>
                        <span className="chip-body">
                          <span className="chip-label">{t.label}</span>
                          <span className="chip-desc">{t.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="command-group">
                  <span className="command-label">Format</span>
                  <div className="format-chips">
                    <button className={`format-chip ${format === 'image' ? 'active' : ''}`} onClick={() => setFormat('image')}>
                      Text + Image
                    </button>
                    <button className={`format-chip ${format === 'carousel' ? 'active' : ''}`} onClick={() => setFormat('carousel')}>
                      Carousel
                    </button>
                  </div>
                </div>

                <button
                  className={`command-generate ${generateBusy ? 'is-loading' : ''}`}
                  onClick={() => void handleGenerate()}
                  disabled={!selectedTopic || generateBusy}
                >
                  {generateBusy ? (
                    <>
                      <ProgressRing progress={generateProgress} size={22} strokeWidth={3} className="command-generate-ring" />
                      <span>{hasOpenAiKey() ? 'Writing fresh post' : 'Building post'}</span>
                    </>
                  ) : generatedPost
                    ? '↻ Regenerate fresh'
                    : hasOpenAiKey()
                      ? 'Generate post + graphic'
                      : 'Generate'}
                </button>
              </div>
              {generateBusy && (
                <div className="graphic-progress-panel command-generate-progress">
                  <ProgressRing progress={generateProgress} size={72} strokeWidth={5} />
                  <p className="graphic-progress-stage">{generateStage || 'Creating your post…'}</p>
                </div>
              )}
              <ActionFeedback msg={generateMsg} className="command-generate-feedback" />
            </section>

            {selectedTopic && (
              <AIGenerator customAngle={customAngle} onCustomAngleChange={setCustomAngle} />
            )}

            {/* STEP 3: Output — the payoff */}
            {generatedPost && (
              <>
                {format === 'carousel' && (
                  <CarouselGenerator postText={liveText} topicId={selectedTopic} />
                )}

                <div className="output-columns">
                  <div className="output-left">
                    <PostDisplay post={generatedPost} topicColor={topic.color} onPostEdit={handlePostEdit} />
                    {format === 'image' && (
                      <DynamicGraphic
                        postText={liveText}
                        topicId={selectedTopic}
                        bundleGraphic={companionGraphic}
                        graphicSessionId={graphicSessionId}
                        onGraphicUpdate={setCompanionGraphic}
                      />
                    )}
                  </div>
                  <div className="output-right">
                    <PostPreview text={liveText} />
                    <AlgorithmScorer postText={liveText} topicId={selectedTopic} />
                  </div>
                </div>

                <FirstComment post={generatedPost} liveText={liveText} />

                <FactCheckGate postText={liveText} />
              </>
            )}

            {/* STEP 4: Supporting context (progressive disclosure) */}
            <VoiceProfile />
          </>
        )}

        {activeTab === 'schedule' && (
          <Scheduler currentPost={generatedPost} currentTopic={selectedTopic} postText={liveText} />
        )}

        {activeTab === 'analytics' && (
          <Analytics />
        )}

        {activeTab === 'data' && (
          <DataManager linkedTopicId={selectedTopic} />
        )}
      </main>

      <footer className="app-footer">
        <p className="footer-title">AI LinkedIn Post Generator</p>
        <p className="footer-subtitle-sm">Optimized for LinkedIn Algorithms</p>
        <p className="footer-copy">© Prem Iyer 2026</p>
        <p className="footer-build" title="Vercel injects VERCEL_GIT_COMMIT_SHA at build time when this app is the deployed root">
          Deploy: {__DEPLOY_SHA__}
        </p>
      </footer>
    </div>
  )
}
