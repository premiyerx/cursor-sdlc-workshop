/**
 * One settings field row — matches API Keys saved/missing colors and "On file" pill.
 */
export default function SetupFieldBlock({
  id,
  label,
  saved = false,
  optional = false,
  lastFour = '',
  statusVerb = '',
  children,
  className = '',
}) {
  const verb = statusVerb || (saved ? 'On file' : optional ? 'Optional' : 'Not set')

  return (
    <div
      className={`ai-key-block ${saved ? 'ai-key-block--saved' : 'ai-key-block--missing'} ${className}`.trim()}
    >
      <div className="ai-key-block-head">
        {id ? (
          <label className="ai-key-provider-label" htmlFor={id}>
            {label}
          </label>
        ) : (
          <span className="ai-key-provider-label">{label}</span>
        )}
        <span
          className={`ai-key-state ${saved ? 'ai-key-state--saved' : 'ai-key-state--missing'}`}
          aria-label={saved ? `${label} saved` : `${label} not saved`}
        >
          <span className="ai-key-pill-verb">{verb}</span>
          {saved && lastFour ? <span className="ai-key-pill-id">{lastFour}</span> : null}
        </span>
      </div>
      {children}
    </div>
  )
}
