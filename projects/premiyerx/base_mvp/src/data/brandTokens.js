/**
 * Brand token system — one source of truth for the visual identity applied across the
 * AI infographic and the carousel, so every asset looks like the same publication.
 * Users can pick a theme; everything (palette, accent, footer, carousel colors) follows.
 */

export const BRAND_THEMES = [
  {
    id: 'ink-mint',
    label: 'Ink & Mint (default)',
    accentHex: '#3EDC81',
    // Infographic prompt palette (editorial image generation).
    palettePrompt:
      'near-black charcoal background (#0a0a0a), warm ivory headlines (#f2efe8), a single mint-green accent (#3EDC81) for connectors and key figures — high-contrast luxury editorial, no neon',
    // Carousel slide colors (SVG render + slide image prompt).
    carousel: { bg: '#050505', ink: '#f2efe8', accent: '#3EDC81' },
    footer: 'Prem Iyer · AI Software Transformation',
  },
  {
    id: 'editorial-cream',
    label: 'Editorial Cream (light)',
    accentHex: '#1F6FEB',
    palettePrompt:
      'warm cream / off-white newsprint background, near-black serif headlines, slate-gray body type, one confident blue accent (#1F6FEB) for charts and rules — FT-weekend editorial restraint',
    carousel: { bg: '#f7f4ee', ink: '#16140f', accent: '#1F6FEB' },
    footer: 'Prem Iyer · AI Software Transformation',
  },
  {
    id: 'midnight-gold',
    label: 'Midnight Gold',
    accentHex: '#E7B53B',
    palettePrompt:
      'deep navy-to-charcoal background, ivory headlines, a restrained gold accent (#E7B53B) for figures and foil-like rules — premium annual-report tone, no gradients-as-decoration',
    carousel: { bg: '#0b1020', ink: '#f3efe6', accent: '#E7B53B' },
    footer: 'Prem Iyer · AI Software Transformation',
  },
]

const STORAGE_KEY = 'lidp_brand_theme'

export function getActiveBrandTheme() {
  try {
    if (typeof localStorage !== 'undefined') {
      const id = localStorage.getItem(STORAGE_KEY)
      const found = id && BRAND_THEMES.find((t) => t.id === id)
      if (found) return found
    }
  } catch {
    /* ignore */
  }
  return BRAND_THEMES[0]
}

export function setActiveBrandTheme(id) {
  try {
    if (typeof localStorage !== 'undefined' && BRAND_THEMES.some((t) => t.id === id)) {
      localStorage.setItem(STORAGE_KEY, id)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function brandFooter() {
  return getActiveBrandTheme().footer
}

export function brandCarouselColors() {
  // Guard against a stray space in a hex literal; fall back to default if malformed.
  const c = getActiveBrandTheme().carousel || BRAND_THEMES[0].carousel
  const clean = (hex, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(hex).replace(/\s+/g, '')) ? String(hex).replace(/\s+/g, '') : fallback)
  return {
    bg: clean(c.bg, '#050505'),
    ink: clean(c.ink, '#f2efe8'),
    accent: clean(c.accent, '#3EDC81'),
  }
}
