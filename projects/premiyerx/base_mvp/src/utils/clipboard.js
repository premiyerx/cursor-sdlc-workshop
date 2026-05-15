/** Copy text; returns { ok: true } or { ok: false, error: string }. */
export async function copyToClipboard(text) {
  const value = text ?? ''
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return { ok: true }
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return { ok: true }
  } catch {
    /* fall through */
  }
  return { ok: false, error: 'Could not copy — try selecting the text manually.' }
}
