import { useState, useCallback } from 'react'
import { BRAND_THEMES, getActiveBrandTheme, setActiveBrandTheme } from '../data/brandTokens'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'
import SettingsCollapsiblePanel from './SettingsCollapsiblePanel'

/**
 * Brand theme picker — one consistent palette/accent/footer applied across the AI infographic
 * and the carousel. Persists to localStorage via brandTokens; defaults to Ink & Mint.
 */
export default function BrandThemePanel() {
  const [activeId, setActiveId] = useState(() => getActiveBrandTheme().id)
  const { msg, flashOk } = useFlashFeedback()

  const choose = useCallback(
    (id) => {
      if (setActiveBrandTheme(id)) {
        setActiveId(id)
        const theme = BRAND_THEMES.find((t) => t.id === id)
        flashOk(`${theme?.label || 'Theme'} applied — new infographics and carousels use this palette.`)
      }
    },
    [flashOk],
  )

  const active = BRAND_THEMES.find((t) => t.id === activeId) || BRAND_THEMES[0]

  return (
    <SettingsCollapsiblePanel
      id="brand-theme-setup"
      title="Brand theme — infographic & carousel"
      badge={active.label.replace(/\s*\(.*\)$/, '')}
      hint="Lock one palette across every visual"
      hintOpen="Tap again to collapse."
    >
      <p className="ai-keys-heading">Pick your visual identity</p>
      <p className="ai-keys-sub">
        Every infographic and carousel uses this palette, accent color, and footer — so your posts look like one
        publication. Applies to the next visual you generate.
      </p>

      <div className="brand-theme-grid">
        {BRAND_THEMES.map((theme) => {
          const isActive = theme.id === activeId
          return (
            <button
              key={theme.id}
              type="button"
              className={`brand-theme-card ${isActive ? 'is-active' : ''}`}
              onClick={() => choose(theme.id)}
              aria-pressed={isActive}
            >
              <span className="brand-theme-swatches" aria-hidden="true">
                <span className="brand-theme-swatch" style={{ background: theme.carousel.bg }} />
                <span className="brand-theme-swatch" style={{ background: theme.carousel.ink }} />
                <span className="brand-theme-swatch" style={{ background: theme.accentHex }} />
              </span>
              <span className="brand-theme-label">{theme.label}</span>
              {isActive && <span className="brand-theme-active-tag">Active</span>}
            </button>
          )
        })}
      </div>

      <ActionFeedback msg={msg} />
    </SettingsCollapsiblePanel>
  )
}
