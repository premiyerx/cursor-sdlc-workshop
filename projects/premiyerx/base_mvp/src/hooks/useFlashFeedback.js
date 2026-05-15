import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * @returns {{ msg: { type: 'ok'|'err', text: string }|null, flashOk: Function, flashErr: Function, clear: Function }}
 */
export function useFlashFeedback(defaultMs = 5000) {
  const [msg, setMsg] = useState(null)
  const timer = useRef(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const flash = useCallback(
    (type, text, ms = defaultMs) => {
      setMsg({ type, text })
      if (timer.current) clearTimeout(timer.current)
      if (ms > 0) timer.current = setTimeout(() => setMsg(null), ms)
    },
    [defaultMs],
  )

  const flashOk = useCallback((text, ms) => flash('ok', text, ms), [flash])
  const flashErr = useCallback((text, ms) => flash('err', text, ms), [flash])
  const clear = useCallback(() => setMsg(null), [])

  return { msg, flash, flashOk, flashErr, clear }
}
