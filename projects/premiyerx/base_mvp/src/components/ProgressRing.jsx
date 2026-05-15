/**
 * Circular progress — shows % in center, or a checkmark when complete.
 */
export default function ProgressRing({
  progress = 0,
  size = 48,
  strokeWidth = 4,
  className = '',
  complete = false,
  showPercent = false,
  'aria-label': ariaLabel = 'Progress',
}) {
  const clamped = Math.min(100, Math.max(0, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const center = size / 2
  const fontSize = size < 40 ? 9 : size < 56 ? 11 : 14

  if (complete) {
    return (
      <div
        className={`progress-ring-complete ${className}`.trim()}
        style={{ width: size, height: size }}
        role="img"
        aria-label="Complete"
      >
        <span className="progress-ring-check" aria-hidden>
          ✓
        </span>
      </div>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`progress-ring ${className}`.trim()}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={ariaLabel}
    >
      <circle
        className="progress-ring-track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <circle
        className="progress-ring-fill"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
      {showPercent && (
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="progress-ring-label"
          fontSize={fontSize}
          fontWeight="700"
          fill="currentColor"
        >
          {Math.round(clamped)}%
        </text>
      )}
    </svg>
  )
}
