import { useState } from 'react'

/**
 * Progressive disclosure panel — collapsed by default for long create flows.
 */
export default function CollapsibleSection({
  title,
  badge,
  hint,
  defaultOpen = false,
  className = '',
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`collapsible-section ${open ? 'is-open' : ''} ${className}`.trim()}>
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
