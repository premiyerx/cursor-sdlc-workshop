import { useState, useMemo } from 'react'
import { findCitations } from '../data/citations'

const SEE_MORE_LIMIT = 210

export default function PostPreview({ text }) {
  const [expanded, setExpanded] = useState(false)

  const citations = useMemo(() => findCitations(text || ''), [text])

  if (!text) return null

  const shouldTruncate = text.length > SEE_MORE_LIMIT
  const displayText = !expanded && shouldTruncate ? text.slice(0, SEE_MORE_LIMIT) : text

  const wordCount = text.split(/\s+/).length
  const readTime = Math.max(1, Math.round(wordCount / 200))

  return (
    <section className="post-preview">
      <h2 className="section-title">Feed preview</h2>

      <div className="preview-card">
        <div className="preview-author">
          <div className="preview-avatar">PI</div>
          <div className="preview-author-info">
            <span className="preview-name">Prem Iyer</span>
            <span className="preview-headline">SVP, Strategic Pursuits at Palo Alto Networks | GTM Advisor at Rubrik</span>
            <span className="preview-time">Just now · 🌐</span>
          </div>
        </div>

        <div className="preview-body">
          {displayText.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              {i < displayText.split('\n').length - 1 && <br />}
            </span>
          ))}
          {shouldTruncate && !expanded && (
            <button className="see-more-btn" onClick={() => setExpanded(true)}>
              ...see more
            </button>
          )}
        </div>

        <div className="preview-meta-bar">
          <span className="preview-meta-item">{wordCount} words</span>
          <span className="preview-meta-item">{readTime} min read</span>
          {citations.length > 0 && <span className="preview-meta-item">{citations.length} sources cited</span>}
        </div>

        <div className="preview-engagement">
          <div className="preview-reactions">
            <span className="reaction-icons">👍 💡 🔥</span>
            <span className="reaction-count">&nbsp;and others</span>
          </div>
          <div className="preview-actions">
            <button className="preview-action">👍 Like</button>
            <button className="preview-action">💬 Comment</button>
            <button className="preview-action">🔄 Repost</button>
            <button className="preview-action">📤 Send</button>
          </div>
        </div>
      </div>

      {expanded && (
        <button className="collapse-btn" onClick={() => setExpanded(false)}>
          Collapse preview
        </button>
      )}
    </section>
  )
}
