import { useState, useCallback } from 'react'
import { hasOpenAiKey } from '../utils/aiPostGenerator'
import { saveOpenAiKey, getOpenAiKeyStatus } from '../utils/openaiKey'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import CollapsibleSection from './CollapsibleSection'

function saveOpenAiKeyToDevice(key) {
  return saveOpenAiKey(key)
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

/** Keys + optional angle — main Generate button does the actual post creation. */
export default function AIGenerator({ customAngle, onCustomAngleChange }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_key') || '')
  const [unsplashKey, setUnsplashKey] = useState(() => localStorage.getItem('unsplash_access_key') || '')
  const [openaiDraft, setOpenaiDraft] = useState('')
  const [unsplashDraft, setUnsplashDraft] = useState('')
  const [showExtraKeys, setShowExtraKeys] = useState(false)
  const { msg: keyMsg, flashOk: flashKeyOk, flashErr: flashKeyErr } = useFlashFeedback()

  const hasKey = !!apiKey.trim()
  const hasUnsplash = !!unsplashKey.trim()

  const handleSaveOpenAi = useCallback(() => {
    const trimmed = openaiDraft.trim()
    if (!trimmed && !hasKey) {
      flashKeyErr('Paste your OpenAI key first.')
      return
    }
    const result = saveOpenAiKeyToDevice(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save OpenAI key.')
      return
    }
    setApiKey(trimmed)
    setOpenaiDraft('')
    flashKeyOk(result.cleared ? 'OpenAI key removed.' : 'OpenAI key saved.')
  }, [openaiDraft, hasKey, flashKeyOk, flashKeyErr])

  const handleSaveUnsplash = useCallback(() => {
    const trimmed = unsplashDraft.trim()
    if (!trimmed && !hasUnsplash) {
      flashKeyErr('Paste your Unsplash key first.')
      return
    }
    const result = saveUnsplashKeyStorage(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save Unsplash key.')
      return
    }
    setUnsplashKey(trimmed)
    setUnsplashDraft('')
    flashKeyOk(result.cleared ? 'Unsplash key removed.' : 'Unsplash key saved.')
  }, [unsplashDraft, hasUnsplash, flashKeyOk, flashKeyErr])

  const keyStatus = getOpenAiKeyStatus()
  const statusBadge = keyStatus.saved ? `Key saved •••${keyStatus.lastFour}` : 'Needs OpenAI key'

  return (
    <CollapsibleSection
      className="ai-settings-wrap"
      title="Settings"
      badge={statusBadge}
      hint={keyStatus.saved ? 'Tap to view or change keys' : 'Add OpenAI key for AI posts and premium infographics'}
      defaultOpen={!hasKey}
    >
      <div className="ai-settings">
        <div className="ai-key-row">
          <input
            type="password"
            className="ai-input"
            placeholder={hasKey ? 'Replace OpenAI key' : 'OpenAI key (sk-…)'}
            value={openaiDraft}
            onChange={(e) => setOpenaiDraft(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="ai-save-key-btn" onClick={handleSaveOpenAi}>
            Save
          </button>
        </div>

        <textarea
          className="ai-angle-input"
          placeholder="Optional angle for next generate (e.g. focus on enterprise security)"
          value={customAngle}
          onChange={(e) => onCustomAngleChange?.(e.target.value)}
          rows={2}
        />

        <p className="ai-settings-note">
          {keyStatus.saved
            ? `Your key is saved on this device (${keyStatus.label}). Premium infographics use this key automatically.`
            : 'Paste your OpenAI key above and tap Save — required for AI posts and premium infographics.'}
        </p>

        <button
          type="button"
          className="ai-extra-keys-toggle"
          onClick={() => setShowExtraKeys((v) => !v)}
        >
          {showExtraKeys ? '▾ Hide optional keys' : '▸ Optional: Unsplash key'}
        </button>

        {showExtraKeys && (
          <div className="ai-key-row">
            <input
              type="password"
              className="ai-input"
              placeholder={hasUnsplash ? 'Replace Unsplash key' : 'Unsplash key (optional)'}
              value={unsplashDraft}
              onChange={(e) => setUnsplashDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveUnsplash}>
              Save
            </button>
          </div>
        )}

        <ActionFeedback msg={keyMsg} />
      </div>
    </CollapsibleSection>
  )
}
