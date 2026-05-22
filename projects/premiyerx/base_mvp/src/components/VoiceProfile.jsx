import { useState, useCallback, useEffect, useRef } from 'react'
import { getVoiceProfileForDisplay, getVoiceCorpusMeta, saveVoiceCorpus } from '../data/voiceProfile'
import { getCorpusSyncId, fetchCloudCorpusMeta, pushCloudCorpus } from '../utils/voiceCorpusCloud'

export default function VoiceProfile() {
  const [expanded, setExpanded] = useState(false)
  const [corpusExpanded, setCorpusExpanded] = useState(false)
  const vp = getVoiceProfileForDisplay()
  const corpusMeta = getVoiceCorpusMeta()
  const [corpusDraft, setCorpusDraft] = useState(corpusMeta.text)
  const [corpusSavedAt, setCorpusSavedAt] = useState(corpusMeta.updated)
  const [corpusSaveMsg, setCorpusSaveMsg] = useState(null)
  const [cloudHint, setCloudHint] = useState('')
  const importRef = useRef(null)

  const refreshMeta = useCallback(() => {
    const m = getVoiceCorpusMeta()
    setCorpusDraft(m.text)
    setCorpusSavedAt(m.updated)
  }, [])

  useEffect(() => {
    refreshMeta()
  }, [refreshMeta])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cloud = await fetchCloudCorpusMeta()
      if (cancelled) return
      if (cloud.ok) {
        setCloudHint('Cloud backup is on — your corpus syncs when you save.')
      } else if (cloud.reason === 'cloud_unconfigured') {
        setCloudHint(
          'Cloud: add a Vercel Blob store to this project for cross-device sync. Until then, corpus stays on this browser + IndexedDB backup + export file below.',
        )
      } else {
        setCloudHint('Cloud: not synced yet — save once to upload (when Blob is configured).')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [corpusSavedAt])

  const handleSaveCorpus = useCallback(async () => {
    try {
      saveVoiceCorpus(corpusDraft)
      refreshMeta()
      const cloud = await pushCloudCorpus(corpusDraft.trim(), new Date().toISOString())
      const len = corpusDraft.trim().length
      let text =
        len >= 80
          ? 'Voice corpus saved on this device (and IndexedDB backup).'
          : 'Saved locally (add more posts when you can — 80+ characters helps the model).'
      if (cloud.ok) text += ' Uploaded to cloud backup.'
      else if (cloud.reason === 'cloud_unconfigured') {
        text += ' Cloud sync needs Vercel Blob on the project — use Export backup below.'
      }
      setCorpusSaveMsg({ type: 'ok', text })
      setTimeout(() => setCorpusSaveMsg(null), 7000)
    } catch {
      setCorpusSaveMsg({ type: 'err', text: 'Could not save — browser storage may be blocked.' })
    }
  }, [corpusDraft, refreshMeta])

  const handleExportBackup = useCallback(() => {
    const payload = {
      text: corpusDraft,
      updated: corpusSavedAt || new Date().toISOString(),
      syncId: getCorpusSyncId(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'linkedinfluence-voice-corpus.json'
    a.click()
    URL.revokeObjectURL(url)
    setCorpusSaveMsg({ type: 'ok', text: 'Downloaded backup file — keep it in Drive or email so deploys never wipe your voice.' })
    setTimeout(() => setCorpusSaveMsg(null), 5000)
  }, [corpusDraft, corpusSavedAt])

  const handleImportBackup = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const j = JSON.parse(String(reader.result || '{}'))
          const text = String(j.text || '').trim()
          if (!text) throw new Error('empty')
          setCorpusDraft(text)
          saveVoiceCorpus(text)
          refreshMeta()
          setCorpusSaveMsg({ type: 'ok', text: 'Imported backup and saved locally + cloud (if configured).' })
        } catch {
          setCorpusSaveMsg({ type: 'err', text: 'Invalid backup file — use linkedinfluence-voice-corpus.json from Export.' })
        }
        setTimeout(() => setCorpusSaveMsg(null), 6000)
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [refreshMeta],
  )

  const hasVoiceCorpus = corpusMeta.text.trim().length >= 80

  return (
    <section className="voice-profile">
      <button className="voice-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="voice-toggle-left">
          <span className="voice-avatar">PI</span>
          <span>
            <strong>Your LinkedIn Writing Style</strong>
            <span className="voice-toggle-sub">
              Voice snapshot + pasted posts (saved across updates when you use Save)
            </span>
          </span>
        </span>
        <span className="voice-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="voice-details">
          {hasVoiceCorpus && (
            <p className="voice-corpus-hint voice-corpus-hint--ok">
              Voice corpus active: your pasted posts shape every draft (casual, brief, human — not generic AI).
            </p>
          )}

          <div className="voice-section">
            <h4>Background</h4>
            <ul className="voice-list">
              <li>
                <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
                  LinkedIn profile
                </a>
                {' — '}refresh the corpus below every 1–2 weeks.
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

          <div className="voice-section voice-section--corpus">
            <button type="button" className="voice-corpus-toggle" onClick={() => setCorpusExpanded(!corpusExpanded)}>
              <h4>Recent LinkedIn posts (paste to refresh voice)</h4>
              <span>{corpusExpanded ? '▲' : '▼'}</span>
            </button>
            {corpusExpanded && (
              <>
                <p className="voice-corpus-hint">
                  Paste several recent posts from your{' '}
                  <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
                    profile activity
                  </a>
                  , then click Save. Corpus is stored on this device, in a browser backup layer, and in the cloud when Vercel Blob is enabled — not wiped by app deploys.
                </p>
                {cloudHint ? <p className="voice-corpus-hint">{cloudHint}</p> : null}
                <textarea
                  className="voice-corpus-textarea"
                  placeholder="Paste recent LinkedIn posts here (combined is fine)…"
                  value={corpusDraft}
                  onChange={(e) => setCorpusDraft(e.target.value)}
                  onBlur={() => {
                    if (corpusDraft.trim().length >= 80) {
                      saveVoiceCorpus(corpusDraft)
                      refreshMeta()
                    }
                  }}
                  rows={10}
                />
                <div className="voice-corpus-actions">
                  <button type="button" className="voice-corpus-save" onClick={() => void handleSaveCorpus()}>
                    Save voice corpus
                  </button>
                  <button type="button" className="voice-corpus-clear" onClick={handleExportBackup}>
                    Export backup
                  </button>
                  <button
                    type="button"
                    className="voice-corpus-clear"
                    onClick={() => importRef.current?.click()}
                  >
                    Import backup
                  </button>
                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleImportBackup}
                  />
                  {corpusSavedAt && (
                    <span className="voice-corpus-meta">
                      Last saved: {corpusSavedAt.slice(0, 19).replace('T', ' ')} UTC
                    </span>
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
