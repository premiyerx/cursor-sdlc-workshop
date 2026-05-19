import { useState, useEffect } from 'react'

/**
 * Progressive disclosure panel — collapsed by default for long create flows.
 */
export default function CollapsibleSection({
  id,
  title,
  badge,
  hint,
  defaultOpen = false,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!id || typeof window === 'undefined') return
    const match = () => {
      if (window.location.hash === `#${id}`) setOpen(true)
    }
    match()
    window.addEventListener('hashchange', match)
    return () => window.removeEventListener('hashchange', match)
  }, [id])

  return (
    <section id={id} className={`collapsible-section ${open ? 'is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="collapsible-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="collapsible-left">
          <span className="collapsible-icon" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="collapsible-title">{title}</span>
          {badge && <span className="collapsible-badge">{badge}</span>}
        </span>
        {!open && hint && <span className="collapsible-hint">{hint}</span>}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  )
}
