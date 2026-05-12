import { toBold, toItalic, PROFESSIONAL_EMOJIS } from '../utils/unicodeFormatter'
import { useState } from 'react'

export default function FormattingToolbar({ onInsert, onFormat }) {
  const [showEmojis, setShowEmojis] = useState(false)

  return (
    <div className="formatting-toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => onFormat(toBold)} title="Bold (Unicode)">
          <strong>B</strong>
        </button>
        <button className="toolbar-btn" onClick={() => onFormat(toItalic)} title="Italic (Unicode)">
          <em>I</em>
        </button>
        <button className="toolbar-btn" onClick={() => onInsert('→ ')} title="Arrow">→</button>
        <button className="toolbar-btn" onClick={() => onInsert('\n\n')} title="Line break">¶</button>
        <button className="toolbar-btn" onClick={() => onInsert('—')} title="Em dash">—</button>
        <button
          className={`toolbar-btn ${showEmojis ? 'active' : ''}`}
          onClick={() => setShowEmojis(!showEmojis)}
          title="Emoji picker"
        >
          😀
        </button>
      </div>

      {showEmojis && (
        <div className="emoji-picker">
          {PROFESSIONAL_EMOJIS.map(({ emoji, label }) => (
            <button
              key={label}
              className="emoji-btn"
              onClick={() => { onInsert(emoji); setShowEmojis(false) }}
              title={label}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
