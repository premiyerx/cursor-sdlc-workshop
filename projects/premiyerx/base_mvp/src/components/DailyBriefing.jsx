import { useMemo } from 'react'
import TOPICS from '../data/postTemplates'

const DAILY_ANGLES = {
  Monday: {
    suggested: 'cursor',
    reason: 'Monday = high engagement from professionals starting their week. Lead with your strongest pillar.',
    angle: 'Start the week with a bold take on AI dev tools. Monday audiences respond to "here\'s what I\'m seeing" frameworks.',
  },
  Tuesday: {
    suggested: 'investment',
    reason: 'Tuesday is peak LinkedIn engagement. Market/investment content performs best mid-week.',
    angle: 'Share a VC/PE trend or funding insight. Tuesday readers have settled into work mode and consume longer content.',
  },
  Wednesday: {
    suggested: 'cio',
    reason: 'Mid-week is when CIOs and VPs are most active on LinkedIn between meetings.',
    angle: 'Address a CIO pain point directly. Wednesday is decision-making day — content that validates their concerns resonates.',
  },
  Thursday: {
    suggested: 'roi',
    reason: 'Thursday audiences are thinking about end-of-week reporting and ROI justification.',
    angle: 'Lead with hard numbers and ROI frameworks. Thursday readers want data they can bring to Friday leadership meetings.',
  },
  Friday: {
    suggested: 'cursor',
    reason: 'Friday = lighter tone works. Share a personal story or surprising anecdote about AI tools.',
    angle: 'Tell a story. Friday audiences engage with narrative-driven content over data-heavy posts.',
  },
  Saturday: {
    suggested: 'investment',
    reason: 'Weekend posting is risky but can work for thought leadership that isn\'t time-sensitive.',
    angle: 'If you post, make it a big-picture think piece. Weekend readers scroll slowly and engage deeply.',
  },
  Sunday: {
    suggested: 'cio',
    reason: 'Sunday evening can catch leaders doing weekly planning. Use sparingly.',
    angle: 'A "week ahead" framing works well. "This week, pay attention to..." style openers.',
  },
}

export default function DailyBriefing({ onSelectTopic }) {
  const today = useMemo(() => {
    const d = new Date()
    return {
      dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
      dateStr: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      hour: d.getHours(),
    }
  }, [])

  const briefing = DAILY_ANGLES[today.dayName]
  const suggestedTopic = TOPICS.find((t) => t.id === briefing.suggested)

  const greeting =
    today.hour < 12 ? 'Good morning' : today.hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <section className="daily-briefing">
      <div className="briefing-header">
        <div>
          <h2 className="briefing-greeting">{greeting}, Prem</h2>
          <p className="briefing-date">{today.dateStr} — {today.dayName}</p>
        </div>
      </div>

      <div className="briefing-card">
        <div className="briefing-recommendation">
          <span className="briefing-label">Today's Recommended Topic</span>
          <div className="briefing-topic" style={{ '--card-accent': suggestedTopic.color }}>
            <span className="topic-icon">{suggestedTopic.icon}</span>
            <div>
              <strong>{suggestedTopic.label}</strong>
              <p className="briefing-reason">{briefing.reason}</p>
            </div>
          </div>
          <p className="briefing-angle"><strong>Suggested angle:</strong> {briefing.angle}</p>
          <button
            className="briefing-action"
            style={{ '--btn-color': suggestedTopic.color }}
            onClick={() => onSelectTopic(briefing.suggested)}
          >
            Use this topic
          </button>
        </div>
      </div>
    </section>
  )
}
