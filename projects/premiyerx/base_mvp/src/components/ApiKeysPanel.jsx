import { useState, useCallback } from 'react'

import { saveOpenAiKey, getOpenAiKeyStatus, getOpenAiKey } from '../utils/openaiKey'

import {

  saveAnthropicKey,

  getAnthropicKeyStatus,

  saveGeminiKey,

  getGeminiKeyStatus,

} from '../utils/llmProviderKeys'

import { vaultGetSync, vaultPutSync } from '../utils/apiKeyVault'

import { saveGnewsApiKey, isGnewsKeyConfigured, getGnewsKeyMeta } from '../utils/realtimeData'

import { useFlashFeedback } from '../hooks/useFlashFeedback'

import ActionFeedback from './ActionFeedback'

import SettingsCollapsiblePanel from './SettingsCollapsiblePanel'

import SetupFieldBlock from './SetupFieldBlock'



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

 * One-time API key setup — lives in Settings at the bottom of the page.

 */

export default function ApiKeysPanel({ open, onOpenChange, onLlmKeysSaved }) {

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

    const result = saveOpenAiKey(trimmed)

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

    flashKeyOk(

      result.cleared

        ? 'GNews key removed — headlines use Hacker News only until you save a key again.'

        : 'GNews key saved.',

    )

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



  const keysComplete = keyStatus.saved && anthStatus.saved && gemStatus.saved

  const keysHint = keysComplete

    ? 'On file — tap to view or rotate keys'

    : 'Setup step — paste OpenAI, Anthropic & Google keys'



  return (

    <SettingsCollapsiblePanel

      id="api-keys-setup"

      title={open ? 'Hide API Keys' : 'API Keys — one-time setup'}

      badge={keysComplete ? 'Ready' : 'Required'}

      hint={keysHint}

      hintOpen="Tap again to collapse and hide key fields."

      open={open}

      onOpenChange={onOpenChange}

      defaultOpen={!keysComplete}

    >

      <p className="ai-keys-heading">Paste keys once, then collapse this panel</p>

      <p className="ai-keys-sub">

        All three LLM keys are required for <strong>Generate three drafts</strong>. With{' '}

        <strong>Cloud sync</strong> above, keys also back up to your private Vercel vault. Optional{' '}

        <strong>GNews</strong> adds headlines (

        <a href="https://gnews.io/" target="_blank" rel="noreferrer">

          gnews.io

        </a>

        ).

      </p>



      <SetupFieldBlock id="key-openai" label="OpenAI" saved={hasKey} lastFour={keyStatus.lastFour ? `···${keyStatus.lastFour}` : ''}>

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

      </SetupFieldBlock>



      <SetupFieldBlock

        id="key-anthropic"

        label="Anthropic (Claude)"

        saved={anthStatus.saved}

        lastFour={anthStatus.lastFour ? `···${anthStatus.lastFour}` : ''}

      >

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

      </SetupFieldBlock>



      <SetupFieldBlock

        id="key-google-gemini"

        label="Google (Gemini)"

        saved={gemStatus.saved}

        lastFour={gemStatus.lastFour ? `···${gemStatus.lastFour}` : ''}

      >

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

      </SetupFieldBlock>



      <SetupFieldBlock

        id="key-gnews"

        label="GNews (headlines, optional)"

        saved={gnewsOk}

        optional={!gnewsOk}

        lastFour={gnewsMeta.lastFour ? `···${gnewsMeta.lastFour}` : ''}

      >

        <div className="ai-key-row">

          <input

            id="key-gnews"

            type="password"

            className={`ai-input ${gnewsOk ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}

            placeholder={gnewsOk ? `Replace (···${gnewsMeta.lastFour || '????'})` : 'GNews API key (optional)'}

            value={gnewsDraft}

            onChange={(e) => setGnewsDraft(e.target.value)}

            autoComplete="off"

          />

          <button type="button" className="ai-save-key-btn" onClick={handleSaveGnews}>

            Save

          </button>

        </div>

      </SetupFieldBlock>



      <button type="button" className="ai-extra-keys-toggle" onClick={() => setShowExtraKeys((v) => !v)}>

        {showExtraKeys ? '▾ Hide optional keys' : '▸ Optional: Unsplash key'}

      </button>



      {showExtraKeys && (

        <SetupFieldBlock id="key-unsplash" label="Unsplash (optional)" saved={hasUnsplash} optional={!hasUnsplash}>

          <div className="ai-key-row">

            <input

              id="key-unsplash"

              type="password"

              className={`ai-input ${hasUnsplash ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}

              placeholder="Unsplash access key (optional)"

              value={unsplashDraft}

              onChange={(e) => setUnsplashDraft(e.target.value)}

              autoComplete="off"

            />

            <button type="button" className="ai-save-key-btn" onClick={handleSaveUnsplash}>

              Save

            </button>

          </div>

        </SetupFieldBlock>

      )}



      <ActionFeedback msg={keyMsg} />

    </SettingsCollapsiblePanel>

  )

}


