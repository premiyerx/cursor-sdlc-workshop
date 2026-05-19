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
import { saveGnewsApiKey, isGnewsKeyConfigured, getGnewsKeyMeta } from '../utils/realtimeData'
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
  apiKeysPanelOpen,
  onApiKeysPanelOpenChange,
  onLlmKeysSaved,
}) {
  const [apiKey, setApiKey] = useState(() => getOpenAiKey())
  const [anthropicDraft, setAnthropicDraft] = useState('')
  const [geminiDraft, setGeminiDraft] = useState('')
  const [unsplashKey, setUnsplashKey] = useState(() => vaultGetSync(UNSPLASH_STORAGE_KEY))
  const [openaiDraft, setOpenaiDraft] = useState('')
  const [unsplashDraft, setUnsplashDraft] = useState('')
  const [gnewsDraft, setGnewsDraft] = useState('')
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
    onLlmKeysSaved?.()
  }, [openaiDraft, hasKey, flashKeyOk, flashKeyErr, onLlmKeysSaved])

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
    onLlmKeysSaved?.()
  }, [anthropicDraft, flashKeyOk, flashKeyErr, onLlmKeysSaved])

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
    onLlmKeysSaved?.()
  }, [geminiDraft, flashKeyOk, flashKeyErr, onLlmKeysSaved])

  const handleSaveGnews = useCallback(() => {
    const trimmed = gnewsDraft.trim()
    const cur = isGnewsKeyConfigured()
    if (!trimmed && !cur) {
      flashKeyErr('Paste your GNews API key first.')
      return
    }
    const result = saveGnewsApiKey(trimmed)
    if (!result.ok) {
      flashKeyErr(result.error || 'Could not save GNews key.')
      return
    }
    setGnewsDraft('')
    flashKeyOk(result.cleared ? 'GNews key removed — headlines use Hacker News only until you save a key again.' : 'GNews key saved.')
  }, [gnewsDraft, flashKeyOk, flashKeyErr])

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
  const gnewsMeta = getGnewsKeyMeta()
  const gnewsOk = gnewsMeta.configured

  const keysReady =
    keyStatus.saved && anthStatus.saved && gemStatus.saved
      ? `OpenAI · Anthropic · Google${gnewsOk ? ' · GNews' : ''}`
      : [keyStatus.saved && 'OpenAI', anthStatus.saved && 'Anthropic', gemStatus.saved && 'Google', gnewsOk && 'GNews']
          .filter(Boolean)
          .join(' · ') || 'Add API keys'

  const keysComplete = keyStatus.saved && anthStatus.saved && gemStatus.saved
  const keysHint = keysComplete
    ? gnewsOk
      ? 'Open to view or rotate keys'
      : 'Open to view or rotate keys — add GNews (optional) for richer headlines'
    : 'Open first — paste OpenAI, Anthropic & Google keys, then Save each row'

  return (
    <div className="ai-generator-stack">
      <CollapsibleSection
        id="api-keys-setup"
        className="ai-settings-wrap"
        title={apiKeysPanelOpen ? 'Close API Keys' : 'Open API Keys'}
        badge={keysReady}
        hint={keysHint}
        hintOpen="Click here again to collapse and hide all key fields."
        open={apiKeysPanelOpen}
        onOpenChange={onApiKeysPanelOpenChange}
      >
        <div className="ai-settings">
          <p className="ai-keys-heading">One-time setup — LLM keys to generate; GNews &amp; Unsplash optional</p>
          <p className="ai-keys-sub">
            OpenAI, Anthropic (Claude), and Google (Gemini from AI Studio) are separate fields. Optional:{' '}
            <strong>GNews</strong> for extra headlines (
            <a href="https://gnews.io/" target="_blank" rel="noreferrer">
              gnews.io
            </a>
            ).{' '}
            <strong className="ai-keys-legend-saved">Green</strong> row = key on file;{' '}
            <strong className="ai-keys-legend-miss">Red</strong> row = still empty (optional rows can stay red). Scroll
            on a phone to see every row.
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
            ↓ Anthropic, Google &amp; GNews — scroll this gray panel on your phone.
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

          <div className={`ai-key-block ${gnewsOk ? 'ai-key-block--saved' : 'ai-key-block--missing'}`}>
            <div className="ai-key-block-head">
              <label className="ai-key-provider-label" htmlFor="key-gnews">
                GNews (headlines)
              </label>
              <span
                className={`ai-key-state ${gnewsOk ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
                aria-label={gnewsOk ? 'GNews API key saved on this device' : 'GNews not configured — demo quota only'}
              >
                {gnewsOk ? (
                  <>
                    <span className="ai-key-pill-verb">On file</span>
                    {gnewsMeta.lastFour ? <span className="ai-key-pill-id">···{gnewsMeta.lastFour}</span> : null}
                  </>
                ) : (
                  <span className="ai-key-pill-verb">Optional</span>
                )}
              </span>
            </div>
            <p className="ai-keys-gnews-note">
              Pulls news articles alongside Hacker News for fresher context. Without a key, the app uses a limited demo
              quota. Clear the field and tap Save to remove the key.
            </p>
            <div className="ai-key-row">
              <input
                id="key-gnews"
                type="password"
                className={`ai-input ${gnewsOk ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
                placeholder={
                  gnewsOk
                    ? `Paste new key to replace (current ends …${gnewsMeta.lastFour || '????'})`
                    : 'Paste GNews API key (optional)'
                }
                value={gnewsDraft}
                onChange={(e) => setGnewsDraft(e.target.value)}
                autoComplete="off"
              />
              <button type="button" className="ai-save-key-btn" onClick={handleSaveGnews}>
                Save
              </button>
            </div>
          </div>

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

      <div className="ai-generator ai-gen-post-settings">
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
                Runs <strong>GPT 5.5</strong>, <strong>Claude Opus 4.7</strong>, and <strong>Gemini 3 Flash</strong> in parallel.
                Save all three keys under <strong>API Keys</strong> first.
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
            GNews lives here too (same storage as before). Keys stay on this device only; they are mirrored in your
            browser (including a backup store) so a normal app update is less likely to wipe them. Clearing site data
            or opening a different site URL will still require saving again.
          </p>
        </div>
      </div>
    </div>
  )
}
