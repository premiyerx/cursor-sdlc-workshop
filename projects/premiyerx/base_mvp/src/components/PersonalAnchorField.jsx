import { useState, useCallback } from 'react'
import { suggestPersonalAnchors } from '../utils/personalAnchorSuggest'

/**
 * Personal-anchor input — Move 1 of the LinkedIn distribution playbook.
 *
 * LinkedIn's 360Brew demotes "pure AI" posts ~20-45%, but hybrid posts with
 * real lived specifics test identical to human writing. This is where the
 * author drops 1-2 concrete details from their actual week so every draft is
 * built around something only a real person would know.
 *
 * If they don't have one handy, "Suggest one" offers honest options: a real,
 * sourced number to react to (usable as-is) or a quick-recall scaffold.
 */
export default function PersonalAnchorField({ value, onChange, disabled, topicId }) {
  const filled = Boolean(String(value || '').trim())
  const [open, setOpen] = useState(false)
  const [sugg, setSugg] = useState(null)

  const toggleSuggest = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next && !sugg) setSugg(suggestPersonalAnchors(topicId))
      return next
    })
  }, [sugg, topicId])

  const use = useCallback(
    (text) => {
      onChange?.(text)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <section
      className={`personal-anchor-section${filled ? ' is-filled' : ''}`}
      aria-labelledby="personal-anchor-heading"
    >
      <h2 id="personal-anchor-heading" className="optional-angle-title">
        Personal anchor{' '}
        <span className="personal-anchor-badge">{filled ? 'human signal on' : 'recommended'}</span>
      </h2>
      <p className="optional-angle-lead">
        Drop 1–2 real specifics from your week — a number you saw, a role you spoke with, a moment.
        The post gets built around it, which is what makes it read human and slip past LinkedIn&apos;s
        AI filter. Never invent; leave blank if you have nothing real today.
      </p>
      <textarea
        className="ai-angle-input optional-angle-input"
        placeholder={
          'e.g. A CISO at a Fortune 100 told me Thursday their AI tool rollout stalled on SOC2 evidence, not cost.\nWe expanded one pilot from 30 to 400 seats in 6 weeks.'
        }
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={3}
        disabled={disabled}
      />
      <button type="button" className="anchor-suggest-toggle" onClick={toggleSuggest} disabled={disabled}>
        {open ? 'Hide suggestions' : "Don't have one? Suggest one"}
      </button>

      {open && sugg && (
        <div className="anchor-suggest-panel">
          {sugg.reactAnchors.length > 0 && (
            <div className="anchor-suggest-group">
              <p className="anchor-suggest-label">Ready to use — react to a real, sourced number</p>
              {sugg.reactAnchors.map((a, i) => (
                <button key={`ra${i}`} type="button" className="anchor-suggest-item" onClick={() => use(a.text)}>
                  <span className="anchor-suggest-text">{a.text}</span>
                  <span className="anchor-suggest-use">Use</span>
                </button>
              ))}
            </div>
          )}
          <div className="anchor-suggest-group">
            <p className="anchor-suggest-label">Quick-recall prompts — fill the [bracket] with something true</p>
            {sugg.memoryJogs.map((m, i) => (
              <button key={`mj${i}`} type="button" className="anchor-suggest-item" onClick={() => use(m)}>
                <span className="anchor-suggest-text">{m}</span>
                <span className="anchor-suggest-use">Use</span>
              </button>
            ))}
          </div>
          <p className="anchor-suggest-foot">
            {topicId
              ? 'The "react to a number" option is true as-is (a real, current stat). Keep any bracketed prompt truthful before you post.'
              : 'Pick a topic above to get a real, sourced number you can react to. Bracketed prompts work for any topic.'}
          </p>
        </div>
      )}
    </section>
  )
}
