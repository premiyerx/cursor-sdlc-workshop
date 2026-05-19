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
    ? 'OpenAI · Anthropic · Google'
    : [keyStatus.saved && 'OpenAI', anthStatus.saved && 'Anthropic', gemStatus.saved && 'Google'].filter(Boolean).join(' · ') || 'Add API keys'

  const defaultKeysOpen =
    (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) ||
    !hasOpenAiKey() ||
    !anthStatus.saved ||
    !gemStatus.saved

  return (
    <CollapsibleSection
      id="api-keys-setup"
      className="ai-settings-wrap"
      title="API keys: OpenAI, Anthropic & Google (Gemini)"
      badge={keysReady}
      hint="OpenAI, Anthropic & Google — expand to paste keys (scroll on phone)"
      defaultOpen={defaultKeysOpen}
    >
      <div className="ai-settings">
        <p className="ai-keys-heading">One-time setup — three keys, then Save on each row</p>
        <p className="ai-keys-sub">
          OpenAI, Anthropic (Claude), and Google (Gemini from AI Studio) are separate fields.{' '}
          <strong className="ai-keys-legend-saved">Green</strong> row = key on file;{' '}
          <strong className="ai-keys-legend-miss">Orange</strong> row = still empty. On a phone, scroll this panel — all
          three are here.
        </p>

        <div className={`ai-key-block ${hasKey ? 'ai-key-block--saved' : 'ai-key-block--missing'}`}>
          <div className="ai-key-block-head">
            <label className="ai-key-provider-label" htmlFor="key-openai">
              OpenAI
            </label>
            <span
              className={`ai-key-state ${hasKey ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
              aria-label={hasKey ? 'OpenAI key saved on this device' : 'OpenAI key not saved'}
            >
              {hasKey ? (
                <>
                  <span className="ai-key-pill-verb">On file</span>
                  {keyStatus.lastFour ? <span className="ai-key-pill-id">···{keyStatus.lastFour}</span> : null}
                </>
              ) : (
                <span className="ai-key-pill-verb">Not set</span>
              )}
            </span>
          </div>
          <div className="ai-key-row">
            <input
              id="key-openai"
              type="password"
              className={`ai-input ${hasKey ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
              placeholder={
                hasKey
                  ? `Paste new key to replace (current ends …${keyStatus.lastFour})`
                  : 'Paste OpenAI API key (sk-…)'
              }
              value={openaiDraft}
              onChange={(e) => setOpenaiDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveOpenAi}>
              Save
            </button>
          </div>
        </div>

        <p className="ai-keys-scroll-hint" aria-hidden="true">
          ↓ Anthropic &amp; Google keys are next — scroll this gray panel on your phone.
        </p>

        <div className={`ai-key-block ${anthStatus.saved ? 'ai-key-block--saved' : 'ai-key-block--missing'}`}>
          <div className="ai-key-block-head">
            <label className="ai-key-provider-label" htmlFor="key-anthropic">
              Anthropic (Claude)
            </label>
            <span
              className={`ai-key-state ${anthStatus.saved ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
              aria-label={anthStatus.saved ? 'Anthropic key saved' : 'Anthropic key not saved'}
            >
              {anthStatus.saved ? (
                <>
                  <span className="ai-key-pill-verb">On file</span>
                  {anthStatus.lastFour ? <span className="ai-key-pill-id">···{anthStatus.lastFour}</span> : null}
                </>
              ) : (
                <span className="ai-key-pill-verb">Not set</span>
              )}
            </span>
          </div>
          <div className="ai-key-row">
            <input
              id="key-anthropic"
              type="password"
              className={`ai-input ${anthStatus.saved ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
              placeholder={
                anthStatus.saved
                  ? `Paste new key to replace (current ends …${anthStatus.lastFour})`
                  : 'Paste Anthropic API key (sk-ant-…)'
              }
              value={anthropicDraft}
              onChange={(e) => setAnthropicDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveAnthropic}>
              Save
            </button>
          </div>
        </div>

        <div className={`ai-key-block ${gemStatus.saved ? 'ai-key-block--saved' : 'ai-key-block--missing'}`}>
          <div className="ai-key-block-head">
            <label className="ai-key-provider-label" htmlFor="key-google-gemini">
              Google (Gemini)
            </label>
            <span
              className={`ai-key-state ${gemStatus.saved ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
              aria-label={gemStatus.saved ? 'Google Gemini key saved' : 'Google Gemini key not saved'}
            >
              {gemStatus.saved ? (
                <>
                  <span className="ai-key-pill-verb">On file</span>
                  {gemStatus.lastFour ? <span className="ai-key-pill-id">···{gemStatus.lastFour}</span> : null}
                </>
              ) : (
                <span className="ai-key-pill-verb">Not set</span>
              )}
            </span>
          </div>
          <div className="ai-key-row">
            <input
              id="key-google-gemini"
              type="password"
              className={`ai-input ${gemStatus.saved ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
              placeholder={
                gemStatus.saved
                  ? `Paste new key to replace (current ends …${gemStatus.lastFour})`
                  : 'Paste Google AI Studio / Gemini API key'
              }
              value={geminiDraft}
              onChange={(e) => setGeminiDraft(e.target.value)}
              autoComplete="off"
            />
            <button type="button" className="ai-save-key-btn" onClick={handleSaveGemini}>
              Save
            </button>
          </div>
        </div>

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
              Runs <strong>GPT 5.5</strong>, <strong>Claude Opus 4.7</strong>, and <strong>Gemini 3 Flash</strong> in parallel.
              Save all three keys in the fields above first.
            </p>
          )}
        </fieldset>

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
          <div className={`ai-key-block ${hasUnsplash ? 'ai-key-block--saved' : 'ai-key-block--missing'}`}>
            <div className="ai-key-block-head">
              <label className="ai-key-provider-label" htmlFor="key-unsplash">
                Unsplash (optional)
              </label>
              <span
                className={`ai-key-state ${hasUnsplash ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
                aria-label={hasUnsplash ? 'Unsplash key saved' : 'Unsplash key not set'}
              >
                {hasUnsplash ? (
                  <>
                    <span className="ai-key-pill-verb">On file</span>
                    <span className="ai-key-pill-id">···{unsplashKey.trim().slice(-4)}</span>
                  </>
                ) : (
                  <span className="ai-key-pill-verb">Not set</span>
                )}
              </span>
            </div>
            <div className="ai-key-row">
              <input
                id="key-unsplash"
                type="password"
                className={`ai-input ${hasUnsplash ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
                placeholder={
                  hasUnsplash
                    ? `Paste new key to replace (current ends …${unsplashKey.trim().slice(-4)})`
                    : 'Paste Unsplash access key (optional)'
                }
                value={unsplashDraft}
                onChange={(e) => setUnsplashDraft(e.target.value)}
                autoComplete="off"
              />
              <button type="button" className="ai-save-key-btn" onClick={handleSaveUnsplash}>
                Save
              </button>
            </div>
          </div>
        )}

        <ActionFeedback msg={keyMsg} />
      </div>
    </CollapsibleSection>
  )
}
