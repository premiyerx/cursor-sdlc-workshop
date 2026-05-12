import { useState, useMemo } from 'react'
import { getPostHistory } from '../utils/storage'
import TOPICS from '../data/postTemplates'

export default function Analytics() {
  const [history] = useState(getPostHistory)

  const stats = useMemo(() => {
    if (history.length === 0) return null

    const topicCounts = {}
    let totalScore = 0
    const dailyCounts = {}
    const scoreDist = { '90-100': 0, '80-89': 0, '70-79': 0, '<70': 0 }

    for (const post of history) {
      const tid = post.topicId || 'unknown'
      topicCounts[tid] = (topicCounts[tid] || 0) + 1
      totalScore += post.score || 0

      const day = (post.createdAt || '').split('T')[0]
      if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1

      const s = post.score || 0
      if (s >= 90) scoreDist['90-100']++
      else if (s >= 80) scoreDist['80-89']++
      else if (s >= 70) scoreDist['70-79']++
      else scoreDist['<70']++
    }

    const avgScore = Math.round(totalScore / history.length)
    const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]
    const streak = Object.keys(dailyCounts).length

    return { topicCounts, avgScore, totalPosts: history.length, topTopic, streak, scoreDist, dailyCounts }
  }, [history])

  if (!stats) {
    return (
      <section className="analytics fade-in-up">
        <h2 className="section-title">Content Log</h2>
        <p className="section-subtitle">Track what you've generated and your algorithm optimization scores</p>
        <div className="analytics-empty">
          <p>No content yet. Generate posts to start building your content log.</p>
          <p className="analytics-hint">Every post you generate or copy to LinkedIn is logged here with its algorithm score.</p>
        </div>
      </section>
    )
  }

  const maxTopicCount = Math.max(...Object.values(stats.topicCounts))
  const topTopicData = TOPICS.find((t) => t.id === stats.topTopic?.[0])

  return (
    <section className="analytics fade-in-up">
      <h2 className="section-title">Content Log</h2>
      <p className="section-subtitle">
        Tracks posts generated in this app and their algorithm optimization scores.
        This does not connect to LinkedIn — engagement metrics require LinkedIn's native analytics.
      </p>

      <div className="analytics-kpis">
        <div className="kpi-card">
          <span className="kpi-value">{stats.totalPosts}</span>
          <span className="kpi-label">Posts Generated</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{stats.avgScore}</span>
          <span className="kpi-label">Avg Algorithm Score</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{stats.streak}</span>
          <span className="kpi-label">Active Days</span>
        </div>
      </div>

      <div className="analytics-panels">
        <div className="analytics-panel">
          <h3 className="panel-title">Topic Distribution</h3>
          {TOPICS.map((topic) => {
            const count = stats.topicCounts[topic.id] || 0
            const pct = maxTopicCount > 0 ? (count / maxTopicCount) * 100 : 0
            return (
              <div key={topic.id} className="topic-bar-row">
                <span className="topic-bar-label">{topic.icon} {topic.label}</span>
                <div className="topic-bar-track">
                  <div className="topic-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="topic-bar-count">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="analytics-panel">
          <h3 className="panel-title">Score Distribution</h3>
          {Object.entries(stats.scoreDist).map(([range, count]) => (
            <div key={range} className="score-dist-row">
              <span className="score-dist-label">{range}</span>
              <div className="topic-bar-track">
                <div
                  className="topic-bar-fill"
                  style={{
                    width: stats.totalPosts > 0 ? `${(count / stats.totalPosts) * 100}%` : '0%',
                    background: range === '90-100' ? '#3EDC81' : range === '80-89' ? '#4AE3A0' : range === '70-79' ? '#fdcb6e' : '#e17055',
                  }}
                />
              </div>
              <span className="topic-bar-count">{count}</span>
            </div>
          ))}

          {topTopicData && (
            <div className="top-topic-callout">
              <span className="callout-label">Most Generated Topic</span>
              <span className="callout-value">{topTopicData.icon} {topTopicData.label}</span>
              <span className="callout-hint">Consider diversifying — LinkedIn rewards variety</span>
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="analytics-panel">
          <h3 className="panel-title">Recent Content Log</h3>
          <div className="history-list">
            {history.slice(0, 10).map((post) => (
              <div key={post.id} className="history-item">
                <div className="history-meta">
                  <span className="history-date">
                    {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="history-score">Score: {post.score}</span>
                </div>
                <span className="history-preview">{post.text?.slice(0, 80)}...</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
