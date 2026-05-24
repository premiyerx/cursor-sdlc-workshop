import { useState, useCallback, useEffect } from 'react'
import {
  getSavedSyncPassphrase,
  saveSyncPassphrase,
  clearSyncPassphrase,
  hasCloudSyncPassphrase,
} from '../utils/cloudSync'
import { fetchCloudVault, mergeUserVaultWithCloud } from '../utils/userVaultCloud'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import SettingsCollapsiblePanel from './SettingsCollapsiblePanel'
import SetupFieldBlock from './SetupFieldBlock'

export default function CloudSyncPanel() {
  const [phraseDraft, setPhraseDraft] = useState(() => getSavedSyncPassphrase())
  const [cloudLinked, setCloudLinked] = useState(false)
  const { msg, flashOk, flashErr } = useFlashFeedback()

  const phraseSaved = hasCloudSyncPassphrase()

  const refreshCloudMeta = useCallback(async () => {
    if (!phraseSaved) {
      setCloudLinked(false)
      return
    }
    const cloud = await fetchCloudVault()
    setCloudLinked(Boolean(cloud.ok))
  }, [phraseSaved])

  useEffect(() => {
    void refreshCloudMeta()
  }, [refreshCloudMeta, phraseDraft])

  const handleSavePhrase = useCallback(async () => {
    const result = await saveSyncPassphrase(phraseDraft)
    if (!result.ok) {
      flashErr(result.error)
      return
    }
    flashOk('Sync phrase saved. Pulling cloud vault…')
    await mergeUserVaultWithCloud()
    await refreshCloudMeta()
  }, [phraseDraft, flashOk, flashErr, refreshCloudMeta])

  const handleClearPhrase = useCallback(() => {
    clearSyncPassphrase()
    setPhraseDraft('')
    setCloudLinked(false)
    flashOk('Sync phrase cleared on this device (cloud copy unchanged).')
  }, [flashOk])

  const syncReady = phraseSaved && cloudLinked
  const badge = syncReady ? 'Ready' : phraseSaved ? 'Saved' : 'Required'
  const hint = phraseSaved
    ? cloudLinked
      ? 'On file — corpus + keys sync across devices'
      : 'Phrase saved — save corpus or keys once to upload'
    : 'Setup step — same phrase on laptop and phone'

  return (
    <SettingsCollapsiblePanel
      id="cloud-sync-setup"
      title="Cloud sync — laptop ↔ phone"
      badge={badge}
      hint={hint}
      hintOpen="Tap again to collapse and hide sync phrase."
      defaultOpen={!phraseSaved}
    >
      <p className="ai-keys-heading">Back up voice corpus and API keys</p>
      <p className="ai-keys-sub">
        Enter one private phrase on each device (8+ characters). After you save keys or your voice corpus once, they
        reload on your other device automatically.
      </p>

      <SetupFieldBlock
        id="cloud-sync-phrase"
        label="Sync phrase"
        saved={phraseSaved}
        statusVerb={phraseSaved ? 'On file' : 'Not set'}
      >
        <div className="ai-key-row">
          <input
            id="cloud-sync-phrase"
            type="password"
            className={`ai-input ${phraseSaved ? 'ai-input--key-saved' : 'ai-input--key-missing'}`}
            placeholder={
              phraseSaved ? 'Paste a new phrase to replace (saved on this device)' : 'Private phrase (8+ characters)'
            }
            value={phraseDraft}
            onChange={(e) => setPhraseDraft(e.target.value)}
            autoComplete="off"
          />
          <button type="button" className="ai-save-key-btn" onClick={() => void handleSavePhrase()}>
            Save
          </button>
        </div>
        <div className="ai-setup-actions">
          <button type="button" className="ai-setup-secondary-btn" onClick={handleClearPhrase}>
            Clear on this device
          </button>
        </div>
      </SetupFieldBlock>

      <ActionFeedback msg={msg} />
    </SettingsCollapsiblePanel>
  )
}
