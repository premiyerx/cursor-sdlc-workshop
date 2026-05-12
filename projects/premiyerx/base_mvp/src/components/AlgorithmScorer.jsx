import { useMemo } from 'react'
import { scorePost, HASHTAG_SUGGESTIONS } from '../data/algorithmRules'

function ScoreGauge({ score }) {
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference
  const color = score >= 95 ? '#3EDC81' : score >= 80 ? '#55efc4' : score >= 60 ? '#fdcb6e' : score >= 40 ? '#e17055' : '#d63031'

  return (
    <div className="gauge">
      <svg viewBox="0 0 120 120" className="gauge-svg">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#1a1a1a" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" fill="#f0f0f5" fontSize="28" fontWeight="800">{score}</text>
        <text x="60" y="72" textAnchor="middle" fill="#6a6a8a" fontSize="10">/100</text>
      </svg>
      <span className="gauge-label">Algorithm Score</span>
      <span className="gauge-target">Reach model: 92+ (dwell + comments weighted)</span>
    </div>
  )
}

export default function AlgorithmScorer({ postText, topicId }) {
  const result = useMemo(() => scorePost(postText), [postText])

  const suggestions = HASHTAG_SUGGESTIONS[topicId] || []

  return (
    <section className="algorithm-scorer">
      <h2 className="section-title">Algorithm Optimizer</h2>

      <div className="scorer-layout">
        <ScoreGauge score={result.total} />

        <div className="score-breakdown">
          {result.details.map((rule) => (
            <div key={rule.id} className="score-row">
              <div className="score-row-header">
                <span className="score-rule-name">{rule.label}</span>
                <span className={`score-pill ${rule.score >= 95 ? 'premier' : rule.score >= 70 ? 'good' : rule.score >= 40 ? 'mid' : 'low'}`}>
                  {rule.score}
                </span>
              </div>
              <div className="score-bar-track">
                <div
                  className="score-bar-fill"
                  style={{
                    width: `${rule.score}%`,
                    background: rule.score >= 95 ? '#3EDC81' : rule.score >= 70 ? '#00b894' : rule.score >= 40 ? '#fdcb6e' : '#e17055',
                  }}
                />
              </div>
              <span className="score-hint">{rule.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="scorer-extras">
        {suggestions.length > 0 && (
          <div className="hashtag-suggestions">
            <span className="timing-label">Suggested Hashtags</span>
            <div className="hashtag-list">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  className="hashtag-chip"
                  onClick={() => navigator.clipboard.writeText(tag)}
                  title="Click to copy"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
