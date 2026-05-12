import { useState } from 'react'
import VOICE_PROFILE from '../data/voiceProfile'

export default function VoiceProfile() {
  const [expanded, setExpanded] = useState(false)
  const vp = VOICE_PROFILE

  return (
    <section className="voice-profile">
      <button className="voice-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="voice-toggle-left">
          <span className="voice-avatar">PI</span>
          <span>
            <strong>Your LinkedIn Writing Style</strong>
            <span className="voice-toggle-sub">Guides AI tone, vocabulary, and structure to match your voice</span>
          </span>
        </span>
        <span className="voice-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="voice-details">
          <div className="voice-section">
            <h4>Background</h4>
            <ul className="voice-list">
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
        </div>
      )}
    </section>
  )
}
