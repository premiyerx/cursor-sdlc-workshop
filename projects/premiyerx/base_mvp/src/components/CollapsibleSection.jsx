import { useState, useEffect } from 'react'

/**
 * Progressive disclosure panel — collapsed by default for long create flows.
 * Pass `open` + `onOpenChange` for controlled mode (e.g. hero "API Keys" button).
 */
export default function CollapsibleSection({
  id,
  title,
  badge,
  hint,
  /** Shown on the right when expanded — makes “click to close” obvious (optional). */
  hintOpen,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className = '',
  children,
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? Boolean(controlledOpen) : internalOpen

  const setOpen = (next) => {
    const value = typeof next === 'function' ? next(open) : next
    if (isControlled) {
      onOpenChange?.(value)
    } else {
      setInternalOpen(value)
    }
  }

  useEffect(() => {
    if (!id || typeof window === 'undefined') return
    const match = () => {
      if (window.location.hash === `#${id}`) {
        if (isControlled) onOpenChange?.(true)
        else setInternalOpen(true)
      }
    }
    match()
    window.addEventListener('hashchange', match)
    return () => window.removeEventListener('hashchange', match)
  }, [id, isControlled, onOpenChange])

  const affordance = open ? hintOpen : hint
  const ariaLabel = [title, badge && String(badge), affordance].filter(Boolean).join('. ')

  return (
    <section id={id} className={`collapsible-section ${open ? 'is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="collapsible-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open && id ? `${id}-panel` : undefined}
        aria-label={ariaLabel}
      >
        <span className="collapsible-left">
          <span className="collapsible-icon" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="collapsible-title">{title}</span>
          {badge && <span className="collapsible-badge">{badge}</span>}
        </span>
        {open && hintOpen && <span className="collapsible-hint collapsible-hint--open">{hintOpen}</span>}
        {!open && hint && <span className="collapsible-hint">{hint}</span>}
      </button>
      {open && (
        <div className="collapsible-body" id={id ? `${id}-panel` : undefined} role="region" aria-label={title}>
          {children}
        </div>
      )}
    </section>
  )
}
