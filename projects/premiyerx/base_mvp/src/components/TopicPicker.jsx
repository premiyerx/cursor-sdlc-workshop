import TOPICS from '../data/postTemplates'

export default function TopicPicker({ selectedTopic, onSelect }) {
  return (
    <section className="topic-picker">
      <h2 className="section-title">Choose Your Topic</h2>
      <p className="section-subtitle">Select a content pillar to generate a LinkedIn post</p>
      <div className="topic-grid">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            className={`topic-card ${selectedTopic === topic.id ? 'selected' : ''}`}
            style={{ '--card-accent': topic.color }}
            onClick={() => onSelect(topic.id)}
          >
            <span className="topic-icon">{topic.icon}</span>
            <span className="topic-label">{topic.label}</span>
            <span className="topic-desc">{topic.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
