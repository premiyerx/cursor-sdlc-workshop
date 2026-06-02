import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import TOPICS from './data/postTemplates'
import { findCitations } from './data/citations'
import {
  canRunCompareAll,
  generateAIPostCompareAll,
} from './utils/aiPostGenerator'
import { createCompanionGraphic } from './utils/companionGraphic'
import { getOpenAiKey } from './utils/openaiKey'
import VoiceProfile from './components/VoiceProfile'
import ApiKeysPanel from './components/ApiKeysPanel'
import CloudSyncPanel from './components/CloudSyncPanel'
import BrandThemePanel from './components/BrandThemePanel'
import SettingsAccordion from './components/SettingsAccordion'
import OptionalAngleField from './components/OptionalAngleField'
import ThreeModelWorkbench, { variantPostToLiveText } from './components/ThreeModelWorkbench'
import { useFlashFeedback } from './hooks/useFlashFeedback'
import { useFooterBuildStamp } from './hooks/useFooterBuildStamp'
import ActionFeedback from './components/ActionFeedback'
import CommandProgress from './components/CommandProgress'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const DAILY_ANGLES = {
  Monday: { suggested: 'cursor', reason: 'Monday = high engagement from professionals starting their week.' },
  Tuesday: { suggested: 'investment', reason: 'Peak LinkedIn engagement day. Market content performs best.' },
  Wednesday: { suggested: 'cio', reason: 'Mid-week CIOs and VPs are most active between meetings.' },
  Thursday: { suggested: 'roi', reason: 'Thursday audiences want ROI data for Friday leadership meetings.' },
  Friday: { suggested: 'cursor', reason: 'Lighter tone works. Stories and anecdotes about AI tools resonate.' },
  Saturday: { suggested: 'investment', reason: 'Weekend = big-picture think pieces for deep engagement.' },
  Sunday: { suggested: 'cio', reason: 'Sunday evening catches leaders doing weekly planning.' },
}

function emptyVariantAssets() {
  return {}
}

export default function App() {
  const { time: footerBuildTime, sha: footerBuildSha } = useFooterBuildStamp()
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [draftVariants, setDraftVariants] = useState(null)
  const [draftRecommendation, setDraftRecommendation] = useState(null)
  const [variantAssets, setVariantAssets] = useState(emptyVariantAssets)
  const [assetFocus, setAssetFocus] = useState(null)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [assetBusy, setAssetBusy] = useState(false)
  const [generatePhase, setGeneratePhase] = useState(null)
  const [postProgress, setPostProgress] = useState(0)
  const [postStage, setPostStage] = useState('')
  const [graphicProgress, setGraphicProgress] = useState(0)
  const [graphicStage, setGraphicStage] = useState('')
  const [phaseComplete, setPhaseComplete] = useState(false)
  const [customAngle, setCustomAngle] = useState('')
  const [apiKeysMetaTick, setApiKeysMetaTick] = useState(0)
  const [apiKeysPanelOpen, setApiKeysPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return !canRunCompareAll()
  })
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem('lidp_settings_open_v1') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('lidp_settings_open_v1', settingsOpen ? '1' : '0')
    } catch {
      /* storage unavailable — fall back to in-memory state */
    }
  }, [settingsOpen])
  const compareContextRef = useRef({ realtimeData: null, seed: 0 })
  const { msg: generateMsg, flashOk: flashGenerateOk, flashErr: flashGenerateErr } = useFlashFeedback()

  const reportPostProgress = useCallback((pct, stage) => {
    setPostProgress((prev) => Math.max(prev, pct))
    if (stage) setPostStage(stage)
  }, [])

  const reportGraphicProgress = useCallback((pct, stage) => {
    setGraphicProgress((prev) => Math.max(prev, pct))
    if (stage) setGraphicStage(stage)
  }, [])

  const resetGenerateProgress = useCallback(() => {
    setGeneratePhase(null)
    setPostProgress(0)
    setPostStage('')
    setGraphicProgress(0)
    setGraphicStage('')
    setPhaseComplete(false)
  }, [])

  const flashPhaseComplete = useCallback(async (phase, stage) => {
    setPhaseComplete(true)
    if (stage) {
      if (phase === 'graphic') setGraphicStage(stage)
      else setPostStage(stage)
    }
    await sleep(1400)
    setPhaseComplete(false)
  }, [])

  useEffect(() => {
    if (!generateBusy || phaseComplete || !generatePhase) return undefined
    const timer = setInterval(() => {
      const tick = (prev) => {
        if (prev >= 94) return prev
        const bump = prev < 40 ? 1.2 : prev < 70 ? 1.6 : 1
        return Math.min(94, prev + bump)
      }
      if (generatePhase === 'post') setPostProgress(tick)
      else if (generatePhase === 'graphic') setGraphicProgress(tick)
    }, 1100)
    return () => clearInterval(timer)
  }, [generateBusy, generatePhase, phaseComplete])

  const topic = TOPICS.find((t) => t.id === selectedTopic)

  const allCompareKeysSaved = useMemo(() => {
    void apiKeysMetaTick
    return canRunCompareAll()
  }, [apiKeysMetaTick])

  const handleLlmKeysSaved = useCallback(() => {
    setApiKeysMetaTick((n) => n + 1)
    queueMicrotask(() => {
      if (canRunCompareAll()) setApiKeysPanelOpen(false)
    })
  }, [])

  const scrollToSettings = useCallback(() => {
    setSettingsOpen(true)
    setApiKeysPanelOpen(true)
    queueMicrotask(() => {
      document.getElementById('app-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

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
    if (!canRunCompareAll()) {
      flashGenerateErr('Add OpenAI, Anthropic, and Google keys in Settings at the bottom of the page, then try again.')
      scrollToSettings()
      return
    }

    setGenerateBusy(true)
    resetGenerateProgress()
    setDraftVariants(null)
    setDraftRecommendation(null)
    setVariantAssets(emptyVariantAssets())
    setAssetFocus(null)

    try {
      setGeneratePhase('post')
      const result = await generateAIPostCompareAll(selectedTopic, {
        customAngle,
        onProgress: reportPostProgress,
      })
      compareContextRef.current = { realtimeData: result.realtimeData, seed: result.seed }
      setDraftVariants(result.variants)
      setDraftRecommendation(result.recommendation ?? null)
      setPostProgress(100)
      const okCount = result.variants.filter((v) => v.post && !v.error).length
      setPostStage(okCount === 3 ? 'Three drafts ready' : `${okCount} of 3 drafts ready`)
      await flashPhaseComplete('post', okCount === 3 ? 'Three drafts ready' : `${okCount} of 3 drafts ready`)
      const belowBar = result.variants.filter((v) => v.post && v.reachWarning).length
      if (okCount < 3) {
        flashGenerateErr(
          'Some models failed to generate — check the red column. Other columns may still have copy you can use.',
          10000,
        )
      } else if (belowBar > 0) {
        flashGenerateErr(
          `${belowBar} draft${belowBar > 1 ? 's' : ''} scored below the 81+ reach bar — copy is still available; regenerate to try for a higher score.`,
          11000,
        )
      }
      const rec = result.recommendation
      flashGenerateOk(
        rec?.label
          ? rec.reachClearedBar !== false
            ? `${rec.label} is best for reach (${rec.reachScore}) after editor review.`
            : `${rec.label} scored highest (${rec.reachScore}) — below the 81+ bar but ready to copy.`
          : 'Three drafts are below — pick the one that sounds most like you.',
      )
    } catch (err) {
      flashGenerateErr(err?.message || 'Could not generate. Check your API keys and connection.')
    } finally {
      setGenerateBusy(false)
      setGeneratePhase(null)
    }
  }, [
    topic,
    selectedTopic,
    customAngle,
    flashGenerateOk,
    flashGenerateErr,
    reportPostProgress,
    resetGenerateProgress,
    flashPhaseComplete,
    scrollToSettings,
  ])

  const handleVariantGraphic = useCallback(
    async (variant) => {
      if (!variant?.post || !topic) return
      const cited = variantPostToLiveText(variant.post, appendCitations)
      const { realtimeData, seed } = compareContextRef.current

      setAssetBusy(true)
      setAssetFocus({ variantId: variant.id, type: 'graphic' })
      setGraphicProgress(0)
      setGraphicStage('Planning your infographic…')
      resetGenerateProgress()
      setGeneratePhase('graphic')

      try {
        const graphic = await createCompanionGraphic({
          postText: cited,
          topicId: selectedTopic,
          topicLabel: topic.label,
          realtimeData,
          seed,
          apiKey: getOpenAiKey(),
          preferNewsroom: true,
          bumpSeed: true,
          onProgress: reportGraphicProgress,
        })
        const assetId = `${Date.now()}-${variant.id}`
        setVariantAssets((prev) => {
          const pack = prev[variant.id] || { graphics: [], carousels: [] }
          return {
            ...prev,
            [variant.id]: {
              ...pack,
              graphics: [
                ...pack.graphics,
                {
                  id: assetId,
                  liveText: cited,
                  graphic,
                  sessionId: assetId,
                },
              ],
            },
          }
        })
        setGraphicProgress(100)
        if (graphic.ok) {
          flashGenerateOk(`Infographic ready for ${variant.shortLabel || variant.label}.`)
        } else {
          flashGenerateErr(graphic.error || 'Infographic could not be created.', 12000)
        }
      } catch (err) {
        flashGenerateErr(err?.message || 'Infographic failed.')
      } finally {
        setAssetBusy(false)
        setAssetFocus(null)
        setGeneratePhase(null)
      }
    },
    [
      topic,
      selectedTopic,
      appendCitations,
      reportGraphicProgress,
      resetGenerateProgress,
      flashGenerateOk,
      flashGenerateErr,
    ],
  )

  const handleVariantCarousel = useCallback(
    (variant) => {
      if (!variant?.post) return
      const cited = variantPostToLiveText(variant.post, appendCitations)
      const assetId = `${Date.now()}-carousel-${variant.id}`
      setVariantAssets((prev) => {
        const pack = prev[variant.id] || { graphics: [], carousels: [] }
        return {
          ...prev,
          [variant.id]: {
            ...pack,
            carousels: [...pack.carousels, { id: assetId, liveText: cited }],
          },
        }
      })
      flashGenerateOk(`Carousel section added for ${variant.shortLabel || variant.label} — scroll that column to preview and download the PDF.`)
    },
    [appendCitations, flashGenerateOk],
  )

  const handleGraphicAssetUpdate = useCallback((variantId, assetId, graphic) => {
    setVariantAssets((prev) => {
      const pack = prev[variantId]
      if (!pack) return prev
      return {
        ...prev,
        [variantId]: {
          ...pack,
          graphics: pack.graphics.map((g) => (g.id === assetId ? { ...g, graphic } : g)),
        },
      }
    })
  }, [])

  const handleTopicSelect = useCallback((id) => {
    setSelectedTopic(id)
    setDraftVariants(null)
    setDraftRecommendation(null)
    setVariantAssets(emptyVariantAssets())
    setAssetFocus(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">AI LinkedIn Post Generator</h1>
          <p className="app-subtitle">Optimized for LinkedIn Algorithms</p>
        </div>
      </header>

      <main className="app-main">
        <section className="hero-greeting">
          <div className="hero-top">
            <div className="hero-welcome">
              <h2 className="hero-hello">{today.greeting}, Prem</h2>
              <p className="hero-date">{today.dateStr}</p>
              {!allCompareKeysSaved && (
                <button type="button" className="hero-settings-link" onClick={scrollToSettings}>
                  First time? Add API keys in Settings ↓
                </button>
              )}
            </div>
          </div>

          {suggestedTopic && !selectedTopic && (
            <div className="hero-suggestion">
              <span className="hero-suggestion-icon">{suggestedTopic.icon}</span>
              <span className="hero-suggestion-text">
                <strong>Recommended for today:</strong> {suggestedTopic.label} — {today.angle.reason}
              </span>
              <button className="hero-suggestion-btn" type="button" onClick={() => handleTopicSelect(today.angle.suggested)}>
                Use this topic
              </button>
            </div>
          )}
        </section>

        <section className="command-bar command-bar--topics">
          <div className="command-row">
            <div className="command-group command-group--full">
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
                    <span className="chip-icon" aria-hidden="true">
                      {t.icon}
                    </span>
                    <span className="chip-body">
                      <span className="chip-label">{t.label}</span>
                      <span className="chip-desc">{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <OptionalAngleField value={customAngle} onChange={setCustomAngle} disabled={generateBusy || assetBusy} />

        <section className="command-bar command-bar--generate">
          <button
            type="button"
            className={`command-generate command-generate--wide ${generateBusy ? 'is-loading' : ''}`}
            onClick={() => void handleGenerate()}
            disabled={!selectedTopic || generateBusy || assetBusy}
          >
            {generateBusy
              ? 'Generating three drafts…'
              : draftVariants
                ? '↻ Regenerate three drafts'
                : 'Generate three drafts'}
          </button>
          {generateBusy && generatePhase === 'post' && (
            <CommandProgress
              progress={postProgress}
              stage={postStage || 'Running GPT 5.5, Claude Opus 4.8, and Gemini 3 Pro…'}
              complete={phaseComplete}
              sub="Usually 15–30 seconds"
            />
          )}
          <ActionFeedback msg={generateMsg} className="command-generate-feedback" />
          {selectedTopic && !allCompareKeysSaved && (
            <p className="command-key-hint">
              Save <strong>OpenAI</strong>, <strong>Anthropic</strong>, and <strong>Google Gemini</strong> keys in{' '}
              <button type="button" className="command-key-hint-link" onClick={scrollToSettings}>
                Settings
              </button>{' '}
              before generating.
            </p>
          )}
        </section>

        {draftVariants && draftVariants.length > 0 && (
          <ThreeModelWorkbench
            variants={draftVariants}
            recommendation={draftRecommendation}
            topicId={selectedTopic}
            variantAssets={variantAssets}
            assetFocus={assetFocus}
            assetBusy={assetBusy}
            graphicProgress={graphicProgress}
            graphicStage={graphicStage}
            phaseComplete={phaseComplete}
            appendCitations={appendCitations}
            onGenerateGraphic={(v) => void handleVariantGraphic(v)}
            onGenerateCarousel={handleVariantCarousel}
            onGraphicAssetUpdate={handleGraphicAssetUpdate}
          />
        )}

        <section id="app-settings" className="app-settings-footer">
          <SettingsAccordion open={settingsOpen} onOpenChange={setSettingsOpen}>
            <p className="app-settings-footer-lead ai-keys-sub settings-accordion-lead">
              Cloud sync, API keys, and voice corpus use the same panels below — green border means saved, red means
              still needed. Collapse each block after setup.
            </p>
            <CloudSyncPanel />
            <ApiKeysPanel
              open={apiKeysPanelOpen}
              onOpenChange={setApiKeysPanelOpen}
              onLlmKeysSaved={handleLlmKeysSaved}
            />
            <VoiceProfile />
            <BrandThemePanel />
          </SettingsAccordion>
        </section>
      </main>

      <footer className="app-footer">
        <p className="footer-title">AI LinkedIn Post Generator</p>
        <p className="footer-subtitle-sm">Optimized for LinkedIn Algorithms</p>
        <p className="footer-copy">© Prem Iyer 2026</p>
        <p
          className="footer-build"
          title={`Host ${typeof window !== 'undefined' ? window.location.host : ''}. Build ${footerBuildSha || __DEPLOY_SHA__}.`}
        >
          Last updated: {footerBuildTime} · build {footerBuildSha || __DEPLOY_SHA__}
        </p>
      </footer>
    </div>
  )
}
