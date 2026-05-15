import { useState, useCallback } from 'react'
import TOPICS from '../data/postTemplates'
import { generateAIPost, hasOpenAiKey } from '../utils/aiPostGenerator'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

function saveOpenAiKey(key) {
  try {
    const trimmed = key?.trim() || ''
    if (trimmed) localStorage.setItem('openai_key', trimmed)
    else localStorage.removeItem('openai_key')
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save OpenAI key.' }
  }
}

function saveUnsplashKeyStorage(key) {
  try {
    const trimmed = key?.trim() || ''
    if (trimmed) localStorage.setItem('unsplash_access_key', trimmed)
    else localStorage.removeItem('unsplash_access_key')
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save Unsplash key.' }
  }
}

export default function AIGenerator({ topicId, onGenerated }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_key') || '')
  const [unsplashKey, setUnsplashKey] = useState(() => localStorage.getItem('unsplash_access_key') || '')
  const [openaiDraft, setOpenaiDraft] = useState('')
  const [unsplashDraft, setUnsplashDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [customAngle, setCustomAngle] = useState('')
  const [expanded, setExpanded] = useState(false)
  const { msg: keyMsg, flashOk: flashKeyOk, flashErr: flashKeyErr } = useFlashFeedback()
  const { msg: genMsg, flashOk: flashGenOk, flashErr: flashGenErr } = useFlashFeedback()

  const topic = TOPICS.find((t) => t.id === topicId)
  const hasKey = !!apiKey.trim()
  const hasUnsplash = !!unsplashKey.trim()

  const handleSaveOpenAi = useCallback(() => {
    const trimmed = openaiDraft.trim()
    if (!trimmed && !hasKey) {
      flashKeyErr('Paste your OpenAI API key first, then tap Save.')
      return
    }
    const result = saveOpenAiKey(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save OpenAI key.')
      return
    }
    setApiKey(trimmed)
    setOpenaiDraft('')
    flashKeyOk(
      result.cleared
        ? 'OpenAI key removed from this device.'
        : `OpenAI key saved on this device (ends in …${trimmed.slice(-4)}).`,
    )
  }, [openaiDraft, hasKey, flashKeyOk, flashKeyErr])

  const handleSaveUnsplash = useCallback(() => {
    const trimmed = unsplashDraft.trim()
    if (!trimmed && !hasUnsplash) {
      flashKeyErr('Paste your Unsplash key first, then tap Save.')
      return
    }
    const result = saveUnsplashKeyStorage(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save Unsplash key.')
      return
    }
    setUnsplashKey(trimmed)
    setUnsplashDraft('')
    flashKeyOk(
      result.cleared
        ? 'Unsplash key removed from this device.'
        : `Unsplash key saved on this device (ends in …${trimmed.slice(-4)}).`,
    )
  }, [unsplashDraft, hasUnsplash, flashKeyOk, flashKeyErr])

  async function handleGenerate() {
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { post } = await generateAIPost(topicId, { apiKey, customAngle })
      onGenerated(post)
      flashGenOk('AI post generated — scroll down to review and edit.')
    } catch (err) {
      setError(err.message)
      flashGenErr(err.message || 'Generation failed. Check your API key and try again.')
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
              placeholder={hasKey ? 'Paste a new OpenAI key to replace saved key' : 'OpenAI API Key (sk-...)'}
              value={openaiDraft}
              onChange={(e) => setOpenaiDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveOpenAi}>
              Save
            </button>
          </div>
          {hasKey && (
            <p className="ai-key-status">OpenAI key active on this device (ends in …{apiKey.slice(-4)})</p>
          )}

          <div className="ai-key-row">
            <input
              type="password"
              className="ai-input"
              placeholder={hasUnsplash ? 'Paste a new Unsplash key to replace' : 'Unsplash Access Key (optional)'}
              value={unsplashDraft}
              onChange={(e) => setUnsplashDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveUnsplash}>
              Save
            </button>
          </div>
          {hasUnsplash && (
            <p className="ai-key-status">Unsplash key active on this device (ends in …{unsplashKey.slice(-4)})</p>
          )}
          <ActionFeedback msg={keyMsg} />

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
          <ActionFeedback msg={genMsg} />
        </div>
      )}
    </div>
  )
}
