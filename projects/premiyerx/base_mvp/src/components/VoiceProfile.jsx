import { useState, useCallback, useEffect, useRef } from 'react'
import { getVoiceProfileForDisplay, getVoiceCorpusMeta, saveVoiceCorpus } from '../data/voiceProfile'
import { getCorpusSyncId, fetchCloudCorpusMeta, pushCloudCorpus } from '../utils/voiceCorpusCloud'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import SettingsCollapsiblePanel from './SettingsCollapsiblePanel'
import SetupFieldBlock from './SetupFieldBlock'

export default function VoiceProfile() {
  const vp = getVoiceProfileForDisplay()
  const corpusMeta = getVoiceCorpusMeta()
  const [corpusDraft, setCorpusDraft] = useState(corpusMeta.text)
  const [corpusSavedAt, setCorpusSavedAt] = useState(corpusMeta.updated)
  const [cloudHint, setCloudHint] = useState('')
  const importRef = useRef(null)
  const { msg: corpusMsg, flashOk, flashErr } = useFlashFeedback()

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
          'Set your sync phrase in Cloud sync above. Until then, corpus stays on this browser + IndexedDB + export.',
        )
      } else {
        setCloudHint('Save once to upload to cloud (when sync phrase is set).')
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
        text += ' Set Cloud sync phrase above to enable upload.'
      }
      flashOk(text)
    } catch {
      flashErr('Could not save — browser storage may be blocked.')
    }
  }, [corpusDraft, refreshMeta, flashOk, flashErr])

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
    flashOk('Downloaded backup file — keep it in Drive or email so deploys never wipe your voice.')
  }, [corpusDraft, corpusSavedAt, flashOk])

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
          flashOk('Imported backup and saved locally + cloud (if configured).')
        } catch {
          flashErr('Invalid backup file — use linkedinfluence-voice-corpus.json from Export.')
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [refreshMeta, flashOk, flashErr],
  )

  const hasVoiceCorpus = corpusMeta.text.trim().length >= 80
  const corpusChars = corpusDraft.trim().length
  const corpusStatusId =
    corpusChars >= 1000
      ? `${(corpusChars / 1000).toFixed(1)}k chars`
      : corpusChars > 0
        ? `${corpusChars} chars`
        : ''

  const voiceHint = hasVoiceCorpus
    ? 'On file — tap to edit voice corpus or profile'
    : 'Setup step — paste recent LinkedIn posts'

  return (
    <SettingsCollapsiblePanel
      id="voice-profile-setup"
      title="Your LinkedIn writing style"
      badge={hasVoiceCorpus ? 'Ready' : 'Setup'}
      hint={voiceHint}
      hintOpen="Tap again to collapse voice settings."
      defaultOpen={!hasVoiceCorpus}
    >
      <p className="ai-keys-heading">Voice snapshot + pasted posts</p>
      <p className="ai-keys-sub">
        Profile background below is reference only. What shapes drafts is your{' '}
        <strong>voice corpus</strong> — paste recent posts from your{' '}
        <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
          LinkedIn activity
        </a>
        , then Save.
      </p>

      <SetupFieldBlock
        id="voice-corpus"
        label="Recent LinkedIn posts (paste to refresh voice)"
        saved={hasVoiceCorpus}
        lastFour={corpusStatusId}
      >
        {cloudHint ? <p className="ai-settings-note">{cloudHint}</p> : null}
        <textarea
          id="voice-corpus"
          className={`ai-input ai-input--area ${hasVoiceCorpus ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
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
        <div className="ai-key-row">
          <button type="button" className="ai-save-key-btn" onClick={() => void handleSaveCorpus()}>
            Save
          </button>
        </div>
        <div className="ai-setup-actions">
          <button type="button" className="ai-setup-secondary-btn" onClick={handleExportBackup}>
            Export backup
          </button>
          <button type="button" className="ai-setup-secondary-btn" onClick={() => importRef.current?.click()}>
            Import backup
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={handleImportBackup} />
          {corpusSavedAt ? (
            <span className="ai-settings-note ai-settings-note--inline">
              Last saved: {corpusSavedAt.slice(0, 19).replace('T', ' ')} UTC
            </span>
          ) : null}
        </div>
      </SetupFieldBlock>

      <ActionFeedback msg={corpusMsg} />

      <div className="voice-settings-readonly">
        <div className="voice-section">
          <h4>Background</h4>
          <ul className="voice-list">
            <li>
              <a href={vp.linkedinUrl || 'https://www.linkedin.com/in/premiyer/'} target="_blank" rel="noreferrer">
                LinkedIn profile
              </a>
              {' — '}refresh the corpus above every 1–2 weeks.
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
              <span key={d} className="domain-chip">
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SettingsCollapsiblePanel>
  )
}
