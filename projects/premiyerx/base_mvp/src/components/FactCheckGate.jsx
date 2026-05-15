import { useMemo, useState } from 'react'
import { extractClaimsFromText, verifyDataPoint } from '../utils/dataRegistry'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

const STATUS_META = {
  verified: { label: 'Verified', icon: '✅', cls: 'fc-verified' },
  stale: { label: 'Stale — re-verify', icon: '⚠️', cls: 'fc-stale' },
  unverified: { label: 'Never verified', icon: '🔴', cls: 'fc-unverified' },
  unknown: { label: 'Not in registry', icon: '❓', cls: 'fc-unknown' },
}

export default function FactCheckGate({ postText, onApprove }) {
  const claims = useMemo(() => extractClaimsFromText(postText), [postText])
  const [approvals, setApprovals] = useState({})
  const [dismissed, setDismissed] = useState(false)
  const { msg: fcMsg, flashOk } = useFlashFeedback()

  if (dismissed || claims.length === 0) return null

  const allGood = claims.every(
    (c) => c.status === 'verified' || approvals[c.text]
  )

  function handleApprove(claimText, registryId) {
    if (registryId) verifyDataPoint(registryId)
    setApprovals((prev) => ({ ...prev, [claimText]: true }))
    flashOk('Claim confirmed.')
  }

  function handleApproveAll() {
    const next = { ...approvals }
    for (const c of claims) {
      next[c.text] = true
      if (c.registryMatch?.id) verifyDataPoint(c.registryMatch.id)
    }
    setApprovals(next)
    flashOk('All claims confirmed.')
  }

  function handlePublishApproval() {
    setDismissed(true)
    if (onApprove) onApprove()
  }

  const problemCount = claims.filter(
    (c) => c.status !== 'verified' && !approvals[c.text]
  ).length

  return (
    <section className="fact-check-gate fade-in-up">
      <div className="fc-header">
        <div className="fc-title-row">
          <h3 className="fc-title">Fact Check</h3>
          {problemCount > 0 ? (
            <span className="fc-badge fc-badge-warn">{problemCount} need review</span>
          ) : (
            <span className="fc-badge fc-badge-ok">All verified</span>
          )}
        </div>
        <p className="fc-subtitle">
          Every data claim in your post is shown below. Confirm accuracy before publishing.
        </p>
      </div>

      <div className="fc-claims">
        {claims.map((claim, i) => {
          const approved = approvals[claim.text]
          const meta = STATUS_META[approved ? 'verified' : claim.status]
          return (
            <div key={i} className={`fc-claim ${meta.cls} ${approved ? 'fc-approved' : ''}`}>
              <div className="fc-claim-content">
                <span className="fc-claim-icon">{meta.icon}</span>
                <div className="fc-claim-detail">
                  <span className="fc-claim-text">"{claim.text}"</span>
                  {claim.registryMatch ? (
                    <span className="fc-claim-source">
                      Source: {claim.registryMatch.source}
                      {claim.registryMatch.verifiedAt && (
                        <> · Last verified: {new Date(claim.registryMatch.verifiedAt).toLocaleDateString()}</>
                      )}
                    </span>
                  ) : (
                    <span className="fc-claim-source fc-no-source">
                      No matching source in registry — verify manually
                    </span>
                  )}
                </div>
              </div>
              {!approved && (
                <button
                  className="fc-approve-btn"
                  onClick={() => handleApprove(claim.text, claim.registryMatch?.id)}
                >
                  Confirm ✓
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="fc-gate-actions">
        {problemCount > 0 && (
          <button className="fc-approve-all-btn" onClick={handleApproveAll}>
            Confirm All as Accurate
          </button>
        )}
        {allGood && (
          <button className="fc-publish-btn" onClick={handlePublishApproval}>
            All Data Verified — Continue
          </button>
        )}
      </div>
      <ActionFeedback msg={fcMsg} />
    </section>
  )
}
