import { useState, useRef, useCallback } from 'react'
import FormattingToolbar from './FormattingToolbar'
import { applyFormatToSelection } from '../utils/unicodeFormatter'

const LINKEDIN_TRUNCATE = 210

export default function PostDisplay({ post, topicColor, onPostEdit }) {
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)

  const fullText = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags}`
  const [editedText, setEditedText] = useState(fullText)

  const charCount = editedText.length
  const firstLine = editedText.split('\n')[0] || ''
  const hookLength = firstLine.length
  const hookHealthy = hookLength <= LINKEDIN_TRUNCATE

  const handleTextChange = useCallback((e) => {
    setEditedText(e.target.value)
    onPostEdit?.(e.target.value)
  }, [onPostEdit])

  function handleCopy() {
    navigator.clipboard.writeText(editedText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleInsert(str) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const newText = editedText.slice(0, start) + str + editedText.slice(start)
    setEditedText(newText)
    onPostEdit?.(newText)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + str.length
      ta.focus()
    })
  }

  function handleFormat(formatter) {
    const ta = textareaRef.current
    if (!ta) return
    const { text, cursor } = applyFormatToSelection(editedText, ta.selectionStart, ta.selectionEnd, formatter)
    setEditedText(text)
    onPostEdit?.(text)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = cursor
      ta.focus()
    })
  }

  return (
    <section className="post-display">
      <div className="post-header">
        <h2 className="section-title">Edit Your Post</h2>
        <div className="post-meta">
          <span className={`char-badge ${charCount > 3000 ? 'warn' : ''}`}>
            {charCount.toLocaleString()} chars
          </span>
          <span className={`hook-badge ${hookHealthy ? 'good' : 'warn'}`} title="LinkedIn shows ~210 characters before See more">
            First line: {hookLength}/{LINKEDIN_TRUNCATE} chars {hookHealthy ? '✓' : '⚠'}
          </span>
        </div>
      </div>

      <FormattingToolbar onInsert={handleInsert} onFormat={handleFormat} />

      <textarea
        ref={textareaRef}
        className="post-editor"
        value={editedText}
        onChange={handleTextChange}
        rows={16}
        style={{ '--card-accent': topicColor }}
      />

      <button className="copy-btn" onClick={handleCopy} style={{ '--btn-color': topicColor }}>
        {copied ? '✓ Copied to Clipboard!' : 'Copy Post to Clipboard'}
      </button>
    </section>
  )
}
