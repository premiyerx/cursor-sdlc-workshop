/** Optional steering line for the next three-model generate run. */
export default function OptionalAngleField({ value, onChange, disabled }) {
  return (
    <section className="optional-angle-section" aria-labelledby="optional-angle-heading">
      <h2 id="optional-angle-heading" className="optional-angle-title">
        Optional angle
      </h2>
      <p className="optional-angle-lead">
        Steer all three models the same way for the next generate (e.g. enterprise security, board readout, pilot
        conversion).
      </p>
      <textarea
        className="ai-angle-input optional-angle-input"
        placeholder="Optional angle for next generate (e.g. focus on enterprise security)"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={3}
        disabled={disabled}
      />
    </section>
  )
}
