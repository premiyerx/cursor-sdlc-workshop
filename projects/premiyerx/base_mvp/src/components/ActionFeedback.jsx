/** Inline success / error banner after button actions (aria-live for screen readers). */
export default function ActionFeedback({ msg, className = '' }) {
  if (!msg) return null
  return (
    <p
      className={`action-feedback action-feedback--${msg.type} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {msg.type === 'ok' ? '✓ ' : '⚠ '}
      {msg.text}
    </p>
  )
}
