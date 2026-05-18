import { useState, useCallback } from 'react'
import { hasOpenAiKey } from '../utils/aiPostGenerator'
import { saveOpenAiKey, getOpenAiKeyStatus, getOpenAiKey } from '../utils/openaiKey'
import {
  saveAnthropicKey,
  getAnthropicKeyStatus,
  saveGeminiKey,
  getGeminiKeyStatus,
} from '../utils/llmProviderKeys'
import { vaultGetSync, vaultPutSync } from '../utils/apiKeyVault'
import { TEXT_MODEL_PROFILES, DEFAULT_TEXT_MODEL_ID } from '../data/textModelProfiles'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import CollapsibleSection from './CollapsibleSection'

function saveOpenAiKeyToDevice(key) {
  return saveOpenAiKey(key)
}

const UNSPLASH_STORAGE_KEY = 'unsplash_access_key'

function saveUnsplashKeyStorage(key) {
  try {
    const trimmed = key?.trim() || ''
    vaultPutSync(UNSPLASH_STORAGE_KEY, trimmed)
    return { ok: true, cleared: !trimmed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save Unsplash key.' }
  }
}

/**
 * Keys, model choice, optional angle — main Generate runs post creation.
 */
export default function AIGenerator({
  customAngle,
  onCustomAngleChange,
  textGenMode,
  onTextGenModeChange,
  selectedTextModelId,
  onSelectedTextModelIdChange,
}) {
  const [apiKey, setApiKey] = useState(() => getOpenAiKey())
  const [anthropicDraft, setAnthropicDraft] = useState('')
  const [geminiDraft, setGeminiDraft] = useState('')
  const [unsplashKey, setUnsplashKey] = useState(() => vaultGetSync(UNSPLASH_STORAGE_KEY))
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

  const handleSaveAnthropic = useCallback(() => {
    const trimmed = anthropicDraft.trim()
    const cur = getAnthropicKeyStatus().saved
    if (!trimmed && !cur) {
      flashKeyErr('Paste your Anthropic key first.')
      return
    }
    const result = saveAnthropicKey(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save Anthropic key.')
      return
    }
    setAnthropicDraft('')
    flashKeyOk(result.cleared ? 'Anthropic key removed.' : 'Anthropic key saved.')
  }, [anthropicDraft, flashKeyOk, flashKeyErr])

  const handleSaveGemini = useCallback(() => {
    const trimmed = geminiDraft.trim()
    const cur = getGeminiKeyStatus().saved
    if (!trimmed && !cur) {
      flashKeyErr('Paste your Gemini API key first.')
      return
    }
    const result = saveGeminiKey(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save Gemini key.')
      return
    }
    setGeminiDraft('')
    flashKeyOk(result.cleared ? 'Gemini key removed.' : 'Gemini key saved.')
  }, [geminiDraft, flashKeyOk, flashKeyErr])

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
  const anthStatus = getAnthropicKeyStatus()
  const gemStatus = getGeminiKeyStatus()
  const keysReady =
    keyStatus.saved && anthStatus.saved && gemStatus.saved
    ? 'OpenAI · Anthropic · Gemini'
    : [keyStatus.saved && 'OpenAI', anthStatus.saved && 'Anthropic', gemStatus.saved && 'Gemini'].filter(Boolean).join(' · ') || 'Add API keys'

  return (
    <CollapsibleSection
      className="ai-settings-wrap"
      title="API keys & model"
      badge={keysReady}
      hint="Save each key once on this device — then collapse and use Generate"
      defaultOpen={!hasOpenAiKey() || !anthStatus.saved || !gemStatus.saved}
    >
      <div className="ai-settings">
        <fieldset className="ai-model-fieldset">
          <legend className="ai-model-legend">Post text generation</legend>
          <div className="ai-gen-mode-row">
            <label className="ai-radio">
              <input
                type="radio"
                name="textGenMode"
                checked={textGenMode === 'single'}
                onChange={() => onTextGenModeChange?.('single')}
              />
              One model
            </label>
            <label className="ai-radio">
              <input
                type="radio"
                name="textGenMode"
                checked={textGenMode === 'compare'}
                onChange={() => onTextGenModeChange?.('compare')}
              />
              Compare all three (same headlines)
            </label>
          </div>
          {textGenMode === 'single' && (
            <div className="ai-model-select-row">
              <label htmlFor="text-model-select" className="ai-model-select-label">
                Model
              </label>
              <select
                id="text-model-select"
                className="ai-model-select"
                value={selectedTextModelId || DEFAULT_TEXT_MODEL_ID}
                onChange={(e) => onSelectedTextModelIdChange?.(e.target.value)}
              >
                {TEXT_MODEL_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {textGenMode === 'compare' && (
            <p className="ai-settings-note ai-compare-note">
              Runs <strong>GPT 5.5</strong>, <strong>Claude Opus 4.7</strong>, and <strong>Gemini 3 Flash</strong> in parallel. Save all three keys below first.
            </p>
          )}
        </fieldset>

        <p className="ai-keys-heading">One-time setup — paste each key and tap Save</p>
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

        <div className="ai-key-row">
          <input
            type="password"
            className="ai-input"
            placeholder={anthStatus.saved ? 'Replace Anthropic key' : 'Anthropic key (sk-ant-…)'}
            value={anthropicDraft}
            onChange={(e) => setAnthropicDraft(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="ai-save-key-btn" onClick={handleSaveAnthropic}>
            Save
          </button>
        </div>

        <div className="ai-key-row">
          <input
            type="password"
            className="ai-input"
            placeholder={gemStatus.saved ? 'Replace Gemini key' : 'Gemini / Google AI Studio key'}
            value={geminiDraft}
            onChange={(e) => setGeminiDraft(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="ai-save-key-btn" onClick={handleSaveGemini}>
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
          Infographics still use your OpenAI key when you pick Text + Image. Voice profile applies to every model.
          Keys stay on this device only; they are mirrored in your browser (including a backup store) so a normal app update is less likely to wipe them. Clearing site data or opening a different site URL will still require saving again.
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
