import { useEffect } from 'react'

/**
 * Outer "Settings" wrapper — a single large collapsible header button that
 * houses the Cloud Sync, API Keys, and Voice Profile sub-panels. Built
 * dedicated rather than reusing CollapsibleSection because the inner panels
 * already use that and the outer header needs heavier visual weight.
 *
 * Controlled component: parent owns open state + localStorage persistence so
 * other affordances (e.g. "scroll to settings" buttons) can pop it open.
 */
export default function SettingsAccordion({
  id = 'app-settings-accordion',
  open,
  onOpenChange,
  children,
}) {
  const panelId = `${id}-panel`

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const matchHash = () => {
      if (!window.location.hash) return
      const target = window.location.hash.slice(1)
      if (
        target === id ||
        target === panelId ||
        target === 'app-settings' ||
        target === 'api-keys-setup' ||
        target === 'cloud-sync-setup' ||
        target === 'voice-profile-setup'
      ) {
        onOpenChange?.(true)
      }
    }
    matchHash()
    window.addEventListener('hashchange', matchHash)
    return () => window.removeEventListener('hashchange', matchHash)
  }, [id, panelId, onOpenChange])

  const toggle = () => onOpenChange?.(!open)

  return (
    <div
      className={`settings-accordion ${open ? 'is-open' : 'is-collapsed'}`}
      data-component="settings-accordion"
    >
      <button
        type="button"
        className="settings-accordion-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        id={`${id}-button`}
      >
        <span className="settings-accordion-left">
          <span className="settings-accordion-icon" aria-hidden="true">
            <SettingsGearIcon />
          </span>
          <span className="settings-accordion-title">Settings</span>
        </span>
        <span className="settings-accordion-chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          className="settings-accordion-body"
          role="region"
          aria-labelledby={`${id}-button`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function SettingsGearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M19.5 12c0-.23-.01-.45-.03-.68l1.86-1.41c.4-.3.51-.86.26-1.3l-1.87-3.23a.987.987 0 0 0-1.25-.42l-2.15.91c-.37-.26-.76-.49-1.17-.68l-.29-2.31c-.06-.5-.49-.88-.99-.88h-3.73c-.51 0-.94.38-1 .88l-.29 2.31c-.41.19-.8.42-1.17.68l-2.15-.91c-.46-.2-1-.02-1.25.42L2.41 8.62c-.25.44-.14.99.26 1.3l1.86 1.41a7.343 7.343 0 0 0 0 1.35l-1.86 1.41c-.4.3-.51.86-.26 1.3l1.87 3.23c.25.44.79.62 1.25.42l2.15-.91c.37.26.76.49 1.17.68l.29 2.31c.06.5.49.88.99.88h3.73c.5 0 .93-.38.99-.88l.29-2.31c.41-.19.8-.42 1.17-.68l2.15.91c.46.2 1 .02 1.25-.42l1.87-3.23c.25-.44.14-.99-.26-1.3l-1.86-1.41c.03-.23.04-.45.04-.68zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  )
}
