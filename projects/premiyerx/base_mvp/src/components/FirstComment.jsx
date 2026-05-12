import { useState, useMemo } from 'react'

const COMMENT_STRATEGIES = [
  {
    id: 'addContext',
    label: 'Add Context',
    description: 'Share a data point or anecdote not in the main post',
    generate: (text, hook) => {
      const dataPoints = text.split('\n').filter((l) => /→|→|\d+%|\$[\d.]+[MBK]?|\dx/.test(l))
      const unusedData = dataPoints.length > 3 ? dataPoints.slice(-2) : []
      if (unusedData.length > 0) {
        const point = unusedData[0].replace(/^(→|➜|►|▸|•|\d+\.|-)\s*/, '').trim()
        return `P.S. One data point I left out of the main post:\n\n→ ${point}\n\nThis one stuck with me because the compounding effect is what most leaders underestimate.\n\nThe gap between "aware" and "acting" is widening every quarter.\n\nAnyone seeing this play out differently in their org? I'd genuinely love the counterexample.`
      }
      return `P.S. Adding some context to "${hook.slice(0, 50)}..."\n\nThe conversations I've had with enterprise leaders this quarter consistently reinforce this pattern.\n\nWhat's interesting is HOW the early movers are pulling ahead:\n\n→ They started small (1-2 teams)\n→ They measured obsessively (not LOC — business outcomes)\n→ They let results speak louder than strategy decks\n\nThat playbook works every time. What's your org's approach — top-down mandate or bottom-up adoption?`
    },
  },
  {
    id: 'contrarian',
    label: 'Contrarian Take',
    description: 'Challenge your own post to spark debate',
    generate: (text, hook) => {
      return `P.S. Playing devil's advocate on my own post:\n\nSomeone might argue this is survivorship bias — we only hear about the wins.\n\nFair point.\n\nBut here's what the skeptics miss:\n\n→ The failures aren't from the tools — they're from the rollout\n→ Top-down mandates fail. Developer choice succeeds.\n→ The data on this is getting hard to argue with.\n\nI've been wrong before. What am I missing here? Genuinely want to hear from anyone who's seen this NOT work.`
    },
  },
  {
    id: 'resource',
    label: 'Offer Value',
    description: 'Offer to share a resource, framework, or deeper analysis',
    generate: (text, hook) => {
      return `P.S. I put together a more detailed breakdown of this with specific numbers from the deployments I've tracked.\n\nIf this resonated — drop a comment or DM and I'll share the full analysis.\n\nAlso curious: what metric does YOUR leadership team care about most when evaluating AI tools?\n\n→ Cost reduction?\n→ Speed to market?\n→ Talent retention?\n\nThe answer tells you a lot about where an org is in their AI maturity.`
    },
  },
]

function generateSmartComment(post, liveText) {
  if (!liveText) return ''
  const lines = liveText.split('\n').filter((l) => l.trim())
  const hook = lines[0] || ''

  if (post?.firstComment) return post.firstComment

  const strategyIndex = Math.floor(Math.random() * COMMENT_STRATEGIES.length)
  return COMMENT_STRATEGIES[strategyIndex].generate(liveText, hook)
}

export default function FirstComment({ post, liveText, onCommentReady }) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedComment, setEditedComment] = useState('')
  const [strategy, setStrategy] = useState(null)

  const comment = useMemo(() => {
    if (editedComment) return editedComment
    if (strategy) {
      const lines = (liveText || '').split('\n').filter((l) => l.trim())
      return strategy.generate(liveText || '', lines[0] || '')
    }
    return generateSmartComment(post, liveText)
  }, [post, liveText, editedComment, strategy])

  function handleCopy() {
    navigator.clipboard.writeText(comment).then(() => {
      setCopied(true)
      onCommentReady?.(comment)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  function handleEdit() {
    if (!editing) setEditedComment(comment)
    setEditing(!editing)
  }

  function handleStrategyPick(s) {
    setStrategy(s)
    setEditedComment('')
    setEditing(false)
  }

  if (!liveText) return null

  const wordCount = comment.split(/\s+/).length
  const isLongEnough = wordCount >= 15

  return (
    <div className="first-comment fade-in-up">
      <div className="fc-header">
        <h3 className="fc-title">First Comment</h3>
        <span className="fc-badge">Post within 30s — comments carry 15x the weight of likes</span>
      </div>

      <p className="fc-hint">
        Your first comment triggers "threaded conversation" signals. Long comments (15+ words) with a follow-up question generate 3+ reply threads, which unlock Phase 3 viral distribution.
      </p>

      <div className="fc-strategies">
        {COMMENT_STRATEGIES.map((s) => (
          <button
            key={s.id}
            className={`fc-strategy-btn ${strategy?.id === s.id ? 'active' : ''}`}
            onClick={() => handleStrategyPick(s)}
            title={s.description}
          >
            {s.label}
          </button>
        ))}
      </div>

      {editing ? (
        <textarea
          className="fc-editor"
          value={editedComment}
          onChange={(e) => setEditedComment(e.target.value)}
          rows={8}
        />
      ) : (
        <div className="fc-preview">{comment}</div>
      )}

      <div className="fc-actions">
        <button className="fc-copy-btn" onClick={handleCopy}>
          {copied ? '✓ Comment Copied!' : 'Copy First Comment'}
        </button>
        <button className="fc-edit-btn" onClick={handleEdit}>
          {editing ? 'Done Editing' : 'Edit'}
        </button>
        <div className="fc-meta">
          <span className="fc-chars">{comment.length} chars · {wordCount} words</span>
          {!isLongEnough && <span className="fc-warn">Add more — short comments get minimal algorithmic credit</span>}
        </div>
      </div>

      <div className="fc-flow">
        <div className="fc-step">
          <span className="fc-step-num">1</span>
          <span className="fc-step-text">Publish your post</span>
        </div>
        <div className="fc-step-arrow">→</div>
        <div className="fc-step">
          <span className="fc-step-num">2</span>
          <span className="fc-step-text">Copy this comment</span>
        </div>
        <div className="fc-step-arrow">→</div>
        <div className="fc-step">
          <span className="fc-step-num">3</span>
          <span className="fc-step-text">Paste as reply in 30s</span>
        </div>
        <div className="fc-step-arrow">→</div>
        <div className="fc-step">
          <span className="fc-step-num">4</span>
          <span className="fc-step-text">Reply to every comment in first hour</span>
        </div>
      </div>
    </div>
  )
}
