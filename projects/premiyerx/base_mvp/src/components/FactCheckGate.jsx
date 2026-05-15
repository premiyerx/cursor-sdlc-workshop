import { useMemo, useState } from 'react'
import { extractClaimsFromText, verifyDataPoint } from '../utils/dataRegistry'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import CollapsibleSection from './CollapsibleSection'

const STATUS_META = {
  verified: { label: 'Verified', icon: '✅', cls: 'fc-verified' },
  stale: { label: 'Stale', icon: '⚠️', cls: 'fc-stale' },
  unverified: { label: 'Unverified', icon: '🔴', cls: 'fc-unverified' },
  unknown: { label: 'Unknown', icon: '❓', cls: 'fc-unknown' },
}

export default function FactCheckGate({ postText, onApprove }) {
  const claims = useMemo(() => extractClaimsFromText(postText), [postText])
  const [approvals, setApprovals] = useState({})
  const [dismissed, setDismissed] = useState(false)
  const { msg: fcMsg, flashOk } = useFlashFeedback()

  if (dismissed || claims.length === 0) return null

  const problemCount = claims.filter(
    (c) => c.status !== 'verified' && !approvals[c.text],
  ).length

  const allGood = claims.every((c) => c.status === 'verified' || approvals[c.text])

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

  const badge = problemCount > 0 ? `${problemCount} to review` : 'All clear'
  const hint = problemCount > 0 ? 'Review before you publish' : 'Optional — already verified'

  return (
    <CollapsibleSection
      className="fact-check-wrap"
      title="Fact check"
      badge={badge}
      hint={hint}
      defaultOpen={false}
    >
      <div className="fact-check-gate">
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
                      <span className="fc-claim-source">Source: {claim.registryMatch.source}</span>
                    ) : (
                      <span className="fc-claim-source fc-no-source">Not in registry — verify manually</span>
                    )}
                  </div>
                </div>
                {!approved && (
                  <button
                    type="button"
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
            <button type="button" className="fc-approve-all-btn" onClick={handleApproveAll}>
              Confirm all
            </button>
          )}
          {allGood && (
            <button type="button" className="fc-publish-btn" onClick={handlePublishApproval}>
              Done — continue
            </button>
          )}
        </div>
        <ActionFeedback msg={fcMsg} />
      </div>
    </CollapsibleSection>
  )
}
