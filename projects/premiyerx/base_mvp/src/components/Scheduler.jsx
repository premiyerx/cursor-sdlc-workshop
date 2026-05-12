import { useState, useEffect, useCallback } from 'react'
import { getSchedule, addScheduledPost, removeScheduledPost, markScheduledAsPublished, savePost } from '../utils/storage'
import { scorePost, POSTING_TIMEZONE } from '../data/algorithmRules'

export default function Scheduler({ currentPost, currentTopic, postText }) {
  const [schedule, setSchedule] = useState(getSchedule)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('07:30')
  const [publishStatus, setPublishStatus] = useState(null)

  const refreshSchedule = useCallback(() => setSchedule(getSchedule()), [])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const sched = getSchedule()
      let changed = false
      for (const post of sched) {
        if (post.status === 'scheduled' && new Date(post.scheduledFor) <= now) {
          markScheduledAsPublished(post.id)
          changed = true
          if (Notification.permission === 'granted') {
            new Notification('AI LinkedIn Post Generator', {
              body: `Time to post! Your scheduled content is ready.\nOpen the app and click "Open LinkedIn & Publish."`,
              icon: '/icon-192.png',
            })
          }
        }
      }
      if (changed) refreshSchedule()
    }, 30000)
    return () => clearInterval(interval)
  }, [refreshSchedule])

  function openLinkedInShareDialog() {
    if (!postText) return
    setPublishStatus('publishing')
    const { total } = scorePost(postText)
    savePost({ topicId: currentTopic, text: postText, score: total, published: false, method: 'share-dialog' })

    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`
    navigator.clipboard.writeText(postText).then(() => {
      window.open(shareUrl, '_blank', 'width=600,height=600')
      setPublishStatus('opened')
      setTimeout(() => setPublishStatus(null), 5000)
    })
  }

  function handleSchedule() {
    if (!postText || !scheduleDate) return
    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
    const { total } = scorePost(postText)
    addScheduledPost({
      text: postText,
      topicId: currentTopic,
      topicLabel: currentPost?.hook?.slice(0, 50) || currentTopic,
      score: total,
      scheduledFor,
    })
    refreshSchedule()
    setScheduleDate('')
  }

  function requestNotifications() {
    if ('Notification' in window) {
      Notification.requestPermission()
    }
  }

  const upcoming = schedule.filter((p) => p.status === 'scheduled')
  const reminded = schedule.filter((p) => p.status === 'published').slice(0, 5)

  return (
    <section className="scheduler fade-in-up">
      <h2 className="section-title">Publish & Remind</h2>
      <p className="section-subtitle">Copy your post to LinkedIn or set a reminder to post later</p>

      <div className="scheduler-grid">
        <div className="scheduler-publish">
          <h3 className="scheduler-subtitle">Publish Now</h3>

          <button
            className="publish-btn linkedin-share-btn"
            onClick={openLinkedInShareDialog}
            disabled={!postText || publishStatus === 'publishing'}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="li-icon">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            {publishStatus === 'publishing' ? 'Opening...' :
             publishStatus === 'opened' ? '✓ Post copied — paste in LinkedIn!' :
             'Copy & Open LinkedIn'}
          </button>
          <p className="publish-hint">
            {publishStatus === 'opened'
              ? 'Your post is on your clipboard. Paste it into the LinkedIn compose window that just opened.'
              : 'Copies your post to the clipboard and opens LinkedIn in a new window so you can paste and publish.'}
          </p>
        </div>

        <div className="scheduler-schedule">
          <h3 className="scheduler-subtitle">Set a Reminder</h3>
          <p className="schedule-hint" style={{ marginBottom: '0.75rem' }}>
            Save this post and get a browser notification at your chosen time reminding you to publish it.
          </p>
          <div className="schedule-inputs">
            <input
              type="date"
              className="schedule-input"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <input
              type="time"
              className="schedule-input"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
            <button
              className="schedule-btn"
              onClick={handleSchedule}
              disabled={!postText || !scheduleDate}
            >
              Set Reminder
            </button>
          </div>
          <p className="schedule-hint">
            Times are in your browser's local timezone. Optimal posting times are in {POSTING_TIMEZONE}.
          </p>
          <button className="notify-btn" onClick={requestNotifications}>
            Enable Browser Notifications
          </button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="schedule-queue">
          <h3 className="scheduler-subtitle">Upcoming Reminders</h3>
          {upcoming.map((post) => (
            <div key={post.id} className="queue-item">
              <div className="queue-info">
                <span className="queue-date">
                  {new Date(post.scheduledFor).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}at{' '}
                  {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
                <span className="queue-preview">{post.text?.slice(0, 60)}...</span>
                <span className="queue-score">Score: {post.score}</span>
              </div>
              <button className="queue-remove" onClick={() => { removeScheduledPost(post.id); refreshSchedule() }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {reminded.length > 0 && (
        <div className="schedule-queue">
          <h3 className="scheduler-subtitle">Past Reminders</h3>
          {reminded.map((post) => (
            <div key={post.id} className="queue-item published">
              <div className="queue-info">
                <span className="queue-date">
                  {new Date(post.publishedAt || post.scheduledFor).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="queue-preview">{post.text?.slice(0, 60)}...</span>
                <span className="queue-score published-badge">Reminded</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
