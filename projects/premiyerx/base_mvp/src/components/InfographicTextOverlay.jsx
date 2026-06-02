/**
 * InfographicTextOverlay
 *
 * Lets the user patch text on an already-rendered AI infographic without
 * regenerating the whole image. Workflow:
 *
 *  1. Show the infographic (`imageSrc`) inside a positioned wrapper.
 *  2. "Edit text" toggles an overlay layer on top of the image.
 *  3. The user clicks+drags to mark the region that should be replaced.
 *  4. A floating input lets them type the new label. An optional mask color
 *     fills the box first so the old text is hidden, then the new text is
 *     drawn centered.
 *  5. `onCommit(dataUrl)` returns a merged PNG (image + all overlays) so the
 *     parent's existing save path stays intact.
 *
 * No new network calls. All compositing happens on a local <canvas>.
 *
 * @param {{
 *   imageSrc: string,
 *   accent?: string,
 *   onCommit: (dataUrl: string) => void,
 *   onCancel?: () => void,
 * }} props
 */
import { useEffect, useRef, useState } from 'react'

const DEFAULT_ACCENT = '#3EDC81'

function MaskedRect({ box, accent, value, fontSize, onChange, onRemove }) {
  const handleInput = (e) => onChange({ ...box, value: e.target.value })
  return (
    <div
      className="ito-box"
      style={{
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        background: box.fill || 'rgba(10, 22, 14, 0.96)',
        color: accent,
        fontSize: `${fontSize}px`,
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={handleInput}
        placeholder="New text"
        spellCheck={false}
        style={{ color: accent }}
      />
      <button
        type="button"
        className="ito-box-remove"
        onClick={onRemove}
        aria-label="Remove this overlay"
        title="Remove this overlay"
      >
        ×
      </button>
    </div>
  )
}

export default function InfographicTextOverlay({
  imageSrc,
  accent = DEFAULT_ACCENT,
  onCommit,
  onCancel,
}) {
  const wrapperRef = useRef(null)
  const imgRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [overlays, setOverlays] = useState([])
  const [dragStart, setDragStart] = useState(null)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ width: 1200, height: 627 })

  useEffect(() => {
    if (!imgRef.current) return
    const img = imgRef.current
    if (img.complete && img.naturalWidth) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    } else {
      img.addEventListener('load', () =>
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight }),
      )
    }
  }, [imageSrc])

  function localPointPercent(e) {
    const rect = wrapperRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  function handlePointerDown(e) {
    if (!editing) return
    if (e.target !== e.currentTarget) return
    const p = localPointPercent(e)
    setDragStart(p)
    setPending({ left: p.x, top: p.y, width: 0, height: 0 })
  }

  function handlePointerMove(e) {
    if (!editing || !dragStart) return
    const p = localPointPercent(e)
    const left = Math.min(dragStart.x, p.x)
    const top = Math.min(dragStart.y, p.y)
    const width = Math.abs(p.x - dragStart.x)
    const height = Math.abs(p.y - dragStart.y)
    setPending({ left, top, width, height })
  }

  function handlePointerUp() {
    if (!editing || !dragStart || !pending) {
      setDragStart(null)
      return
    }
    if (pending.width >= 1.5 && pending.height >= 1) {
      setOverlays((prev) => [
        ...prev,
        {
          id: `box-${Date.now()}-${prev.length}`,
          left: pending.left,
          top: pending.top,
          width: pending.width,
          height: pending.height,
          value: '',
          fill: 'rgba(10, 22, 14, 0.96)',
        },
      ])
    }
    setDragStart(null)
    setPending(null)
  }

  function updateOverlay(id, next) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...next } : o)))
  }

  function removeOverlay(id) {
    setOverlays((prev) => prev.filter((o) => o.id !== id))
  }

  async function composeAndCommit() {
    if (!imgRef.current) return
    setBusy(true)
    try {
      const W = naturalSize.width
      const H = naturalSize.height
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageSrc
      })
      ctx.drawImage(img, 0, 0, W, H)

      for (const o of overlays) {
        if (!o.value?.trim()) continue
        const x = (o.left / 100) * W
        const y = (o.top / 100) * H
        const w = (o.width / 100) * W
        const h = (o.height / 100) * H

        ctx.fillStyle = o.fill || 'rgba(10, 22, 14, 0.96)'
        ctx.fillRect(x, y, w, h)

        // Pick a font size that fits the box at ~70% of its height, capped at 96px.
        let fontSize = Math.min(96, Math.max(14, h * 0.7))
        ctx.fillStyle = accent
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `700 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`

        // Shrink to fit if the rendered width exceeds the box.
        const padding = Math.max(8, w * 0.04)
        while (ctx.measureText(o.value).width > w - padding * 2 && fontSize > 12) {
          fontSize -= 2
          ctx.font = `700 ${fontSize}px "Inter", "Helvetica Neue", Arial, sans-serif`
        }
        ctx.fillText(o.value, x + w / 2, y + h / 2)
      }

      const dataUrl = canvas.toDataURL('image/png')
      onCommit?.(dataUrl)
    } finally {
      setBusy(false)
    }
  }

  function handleCancel() {
    setEditing(false)
    setOverlays([])
    setPending(null)
    setDragStart(null)
    onCancel?.()
  }

  // Use the wrapper's rendered height to roughly size the input font (matches
  // how the user perceives the box on screen). The canvas pass below picks the
  // true font size against natural pixels.
  const previewBoxFontSize = (rect) => {
    if (!wrapperRef.current) return 28
    const h = wrapperRef.current.getBoundingClientRect().height
    return Math.max(14, (rect.height / 100) * h * 0.65)
  }

  return (
    <div className="ito-shell">
      <div
        ref={wrapperRef}
        className={`ito-stage ${editing ? 'is-editing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img ref={imgRef} src={imageSrc} alt="Infographic preview" className="ito-image" />
        {overlays.map((box) => (
          <MaskedRect
            key={box.id}
            box={box}
            accent={accent}
            value={box.value}
            fontSize={previewBoxFontSize(box)}
            onChange={(next) => updateOverlay(box.id, next)}
            onRemove={() => removeOverlay(box.id)}
          />
        ))}
        {pending && (
          <div
            className="ito-pending"
            style={{
              left: `${pending.left}%`,
              top: `${pending.top}%`,
              width: `${pending.width}%`,
              height: `${pending.height}%`,
            }}
          />
        )}
      </div>

      <div className="ito-toolbar">
        {!editing && (
          <button type="button" className="ito-btn" onClick={() => setEditing(true)}>
            Edit text on graphic
          </button>
        )}
        {editing && (
          <>
            <span className="ito-hint">
              Drag a box over a number, then type the new value. Repeat for each fix.
            </span>
            <div className="ito-toolbar-actions">
              <button
                type="button"
                className="ito-btn ito-btn--ghost"
                onClick={handleCancel}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ito-btn ito-btn--primary"
                onClick={() => void composeAndCommit()}
                disabled={busy || overlays.length === 0}
              >
                {busy ? 'Saving…' : 'Apply text edits'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
