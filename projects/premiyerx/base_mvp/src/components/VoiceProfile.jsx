import { useState, useCallback } from 'react'
import { getVoiceProfileForDisplay, getVoiceCorpusMeta, saveVoiceCorpus } from '../data/voiceProfile'
import { getGnewsApiKey, saveGnewsApiKey } from '../utils/realtimeData'

export default function VoiceProfile() {
  const [expanded, setExpanded] = useState(false)
  const [corpusExpanded, setCorpusExpanded] = useState(false)
  const vp = getVoiceProfileForDisplay()
  const corpusMeta = getVoiceCorpusMeta()
  const [corpusDraft, setCorpusDraft] = useState(corpusMeta.text)
  const [corpusSavedAt, setCorpusSavedAt] = useState(corpusMeta.updated)
  const [gnewsKey, setGnewsKey] = useState(() => getGnewsApiKey())

  const refreshMeta = useCallback(() => {
    const m = getVoiceCorpusMeta()
    setCorpusDraft(m.text)
    setCorpusSavedAt(m.updated)
  }, [])

  const handleSaveCorpus = useCallback(() => {
    saveVoiceCorpus(corpusDraft)
    refreshMeta()
  }, [corpusDraft, refreshMeta])

  const handleGnewsSave = useCallback(() => {
    saveGnewsApiKey(gnewsKey === 'demo' ? '' : gnewsKey)
    setGnewsKey(getGnewsApiKey())
  }, [gnewsKey])

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
              . Stored only in this browser.
            </p>
            <div className="voice-corpus-actions">
              <input
                type="password"
                className="voice-corpus-input voice-corpus-input--inline"
                placeholder="GNews API key (optional)"
                value={gnewsKey === 'demo' ? '' : gnewsKey}
                onChange={(e) => setGnewsKey(e.target.value)}
              />
              <button type="button" className="voice-corpus-save" onClick={handleGnewsSave}>
                Save key
              </button>
            </div>
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
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
