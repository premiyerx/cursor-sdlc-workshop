import { useState, useCallback, useEffect, useRef } from 'react'
import { getVoiceProfileForDisplay, getVoiceCorpusMeta, saveVoiceCorpus } from '../data/voiceProfile'
import {
  getGnewsKeyMeta,
  saveGnewsApiKey,
  isGnewsKeyConfigured,
} from '../utils/realtimeData'

export default function VoiceProfile() {
  const [expanded, setExpanded] = useState(false)
  const [corpusExpanded, setCorpusExpanded] = useState(false)
  const vp = getVoiceProfileForDisplay()
  const corpusMeta = getVoiceCorpusMeta()
  const [corpusDraft, setCorpusDraft] = useState(corpusMeta.text)
  const [corpusSavedAt, setCorpusSavedAt] = useState(corpusMeta.updated)
  const [corpusSaveMsg, setCorpusSaveMsg] = useState(null)
  const [gnewsKey, setGnewsKey] = useState('')
  const [gnewsMeta, setGnewsMeta] = useState(() => getGnewsKeyMeta())
  const [gnewsSaveMsg, setGnewsSaveMsg] = useState(null)
  const gnewsMsgTimer = useRef(null)

  const refreshGnewsMeta = useCallback(() => {
    setGnewsMeta(getGnewsKeyMeta())
  }, [])

  useEffect(() => {
    if (expanded) refreshGnewsMeta()
  }, [expanded, refreshGnewsMeta])

  useEffect(() => () => {
    if (gnewsMsgTimer.current) clearTimeout(gnewsMsgTimer.current)
  }, [])

  const flashGnewsMessage = useCallback((msg) => {
    setGnewsSaveMsg(msg)
    if (gnewsMsgTimer.current) clearTimeout(gnewsMsgTimer.current)
    gnewsMsgTimer.current = setTimeout(() => setGnewsSaveMsg(null), 6000)
  }, [])

  const refreshMeta = useCallback(() => {
    const m = getVoiceCorpusMeta()
    setCorpusDraft(m.text)
    setCorpusSavedAt(m.updated)
  }, [])

  const handleSaveCorpus = useCallback(() => {
    try {
      saveVoiceCorpus(corpusDraft)
      refreshMeta()
      setCorpusSaveMsg(
        corpusDraft.trim().length >= 80
          ? { type: 'ok', text: 'Voice corpus saved on this device.' }
          : { type: 'ok', text: 'Saved (add more posts when you can — 80+ characters helps the model).' },
      )
      setTimeout(() => setCorpusSaveMsg(null), 5000)
    } catch {
      setCorpusSaveMsg({ type: 'err', text: 'Could not save — browser storage may be blocked.' })
    }
  }, [corpusDraft, refreshMeta])

  const handleGnewsSave = useCallback(() => {
    const trimmed = gnewsKey.trim()
    if (!trimmed && !isGnewsKeyConfigured()) {
      flashGnewsMessage({ type: 'err', text: 'Paste your GNews API key first, then tap Save key.' })
      return
    }
    const result = saveGnewsApiKey(trimmed)
    if (!result.ok) {
      flashGnewsMessage({
        type: 'err',
        text: result.error || 'Could not save. Try turning off Private Browsing or allow site storage.',
      })
      return
    }
    setGnewsKey('')
    refreshGnewsMeta()
    if (result.cleared) {
      flashGnewsMessage({
        type: 'ok',
        text: 'GNews key removed. Headlines will use Hacker News only until you save a key again.',
      })
      return
    }
    const meta = getGnewsKeyMeta()
    flashGnewsMessage({
      type: 'ok',
      text: `GNews key saved on this device${meta.lastFour ? ` (ends in …${meta.lastFour})` : ''}${meta.savedAt ? ` · ${meta.savedAt}` : ''}.`,
    })
  }, [gnewsKey, flashGnewsMessage, refreshGnewsMeta])

  const handleGnewsClear = useCallback(() => {
    const result = saveGnewsApiKey('')
    if (!result.ok) {
      flashGnewsMessage({ type: 'err', text: result.error || 'Could not clear key.' })
      return
    }
    setGnewsKey('')
    refreshGnewsMeta()
    flashGnewsMessage({ type: 'ok', text: 'GNews key removed from this device.' })
  }, [flashGnewsMessage, refreshGnewsMeta])

  const hasVoiceCorpus = corpusMeta.text.trim().length >= 80

  return (
    <section className="voice-profile">
      <button className="voice-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="voice-toggle-left">
          <span className="voice-avatar">PI</span>
          <span>
            <strong>Your LinkedIn Writing Style</strong>
            <span className="voice-toggle-sub">
              Voice snapshot + optional pasted posts for freshness (GNews key improves headlines)
            </span>
          </span>
        </span>
        <span className="voice-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="voice-details">
          {hasVoiceCorpus && (
            <p className="voice-corpus-hint voice-corpus-hint--ok">
              Voice corpus active: pasted posts are appended to the AI system prompt on every generation.
            </p>
          )}

          <div className="voice-section">
            <h4>Background</h4>
            <ul className="voice-list">
              <li>
                <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
                  LinkedIn profile
                </a>
                {' — '}refresh the “Recent posts” paste below every 1–2 weeks (LinkedIn cannot be auto-scraped from this app).
              </li>
              <li>{vp.background.currentRole}</li>
              <li>{vp.background.yearsExperience} years enterprise tech experience</li>
              <li>{vp.background.notableAchievement}</li>
              <li>{vp.background.education}</li>
              <li>{vp.background.entrepreneurship}</li>
              <li>Angel investments: {vp.background.investments.join(', ')}</li>
              <li>LP positions: {vp.background.lpPositions.join(', ')}</li>
            </ul>
          </div>

          <div className="voice-section">
            <h4>Tone Attributes</h4>
            <div className="voice-attrs">
              {Object.entries(vp.toneAttributes).map(([key, val]) => (
                <div key={key} className="voice-attr">
                  <span className="voice-attr-key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="voice-attr-val">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="voice-section">
            <h4>Style Guide</h4>
            <div className="voice-attrs">
              {Object.entries(vp.styleGuide).map(([key, val]) => (
                <div key={key} className="voice-attr">
                  <span className="voice-attr-key">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="voice-attr-val">{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="voice-section">
            <h4>Domains</h4>
            <div className="voice-domains">
              {vp.domains.map((d) => (
                <span key={d} className="domain-chip">{d}</span>
              ))}
            </div>
          </div>

          <div className="voice-section voice-section--research">
            <h4>Optional: GNews API key</h4>
            <p className="voice-corpus-hint">
              Improves headline diversity alongside Hacker News. Get a free key at{' '}
              <a href="https://gnews.io/" target="_blank" rel="noreferrer">gnews.io</a>
              . Stored only in this browser / phone.
            </p>
            {gnewsMeta.configured && !gnewsSaveMsg && (
              <p className="voice-corpus-hint voice-corpus-hint--ok" role="status">
                GNews active on this device
                {gnewsMeta.lastFour ? ` (key ends in …${gnewsMeta.lastFour})` : ''}
                {gnewsMeta.savedAt ? ` · saved ${gnewsMeta.savedAt}` : ''}
              </p>
            )}
            <div className="voice-corpus-actions">
              <input
                type="password"
                className="voice-corpus-input voice-corpus-input--inline"
                placeholder={gnewsMeta.configured ? 'Paste a new key to replace saved key' : 'GNews API key (optional)'}
                value={gnewsKey}
                onChange={(e) => setGnewsKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="voice-corpus-save" onClick={handleGnewsSave}>
                Save key
              </button>
              {gnewsMeta.configured && (
                <button type="button" className="voice-corpus-clear" onClick={handleGnewsClear}>
                  Remove
                </button>
              )}
            </div>
            {gnewsSaveMsg && (
              <p
                className={`voice-save-feedback voice-save-feedback--${gnewsSaveMsg.type}`}
                role="status"
                aria-live="polite"
              >
                {gnewsSaveMsg.type === 'ok' ? '✓ ' : '⚠ '}
                {gnewsSaveMsg.text}
              </p>
            )}
          </div>

          <div className="voice-section voice-section--corpus">
            <button type="button" className="voice-corpus-toggle" onClick={() => setCorpusExpanded(!corpusExpanded)}>
              <h4>Recent LinkedIn posts (paste to refresh voice)</h4>
              <span>{corpusExpanded ? '▲' : '▼'}</span>
            </button>
            {corpusExpanded && (
              <>
                <p className="voice-corpus-hint">
                  Every few weeks: copy several recent posts from your{' '}
                  <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
                    profile activity
                  </a>
                  {' '}or from a{' '}
                  <a
                    href="https://www.linkedin.com/help/linkedin/answer/a1342447"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn data export
                  </a>
                  , paste here, and save. The app cannot log into LinkedIn on your behalf from the browser. The model uses this for phrasing and POV — not as a fact source about third parties.
                </p>
                <textarea
                  className="voice-corpus-textarea"
                  placeholder="Paste recent LinkedIn posts here (combined is fine)…"
                  value={corpusDraft}
                  onChange={(e) => setCorpusDraft(e.target.value)}
                  rows={10}
                />
                <div className="voice-corpus-actions">
                  <button type="button" className="voice-corpus-save" onClick={handleSaveCorpus}>
                    Save voice corpus
                  </button>
                  {corpusSavedAt && (
                    <span className="voice-corpus-meta">Last saved: {corpusSavedAt}</span>
                  )}
                </div>
                {corpusSaveMsg && (
                  <p
                    className={`voice-save-feedback voice-save-feedback--${corpusSaveMsg.type}`}
                    role="status"
                    aria-live="polite"
                  >
                    {corpusSaveMsg.type === 'ok' ? '✓ ' : '⚠ '}
                    {corpusSaveMsg.text}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
