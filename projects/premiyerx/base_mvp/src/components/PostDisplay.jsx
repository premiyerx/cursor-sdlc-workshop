import { useState, useRef, useCallback, useEffect } from 'react'
import FormattingToolbar from './FormattingToolbar'
import { applyFormatToSelection } from '../utils/unicodeFormatter'
import { copyToClipboard } from '../utils/clipboard'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

export default function PostDisplay({ post, topicColor, onPostEdit }) {
  const [copied, setCopied] = useState(false)
  const { msg: copyMsg, flashOk, flashErr } = useFlashFeedback()
  const textareaRef = useRef(null)

  const fullText = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags}`
  const [editedText, setEditedText] = useState(fullText)

  useEffect(() => {
    const next = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags}`
    setEditedText(next)
  }, [post.hook, post.body, post.cta, post.hashtags])

  const charCount = editedText.length

  const handleTextChange = useCallback((e) => {
    setEditedText(e.target.value)
    onPostEdit?.(e.target.value)
  }, [onPostEdit])

  async function handleCopy() {
    const result = await copyToClipboard(editedText)
    if (!result.ok) {
      flashErr(result.error || 'Could not copy — try selecting the text manually.')
      return
    }
    setCopied(true)
    flashOk('Post copied to clipboard.')
    setTimeout(() => setCopied(false), 3000)
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
        <h2 className="section-title">Your post</h2>
        <div className="post-meta">
          <span className={`char-badge ${charCount > 3000 ? 'warn' : ''}`} title="Approximate length for LinkedIn">
            {charCount.toLocaleString()} characters
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

      <button className="copy-btn" onClick={() => void handleCopy()} style={{ '--btn-color': topicColor }}>
        {copied ? '✓ Copied to Clipboard!' : 'Copy Post to Clipboard'}
      </button>
      <ActionFeedback msg={copyMsg} />
    </section>
  )
}
