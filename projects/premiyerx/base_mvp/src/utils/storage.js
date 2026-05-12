const HISTORY_KEY = 'lidp_post_history'
const SCHEDULE_KEY = 'lidp_schedule'

export function getPostHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export function savePost(entry) {
  const history = getPostHistory()
  history.unshift({
    id: Date.now(),
    ...entry,
    createdAt: new Date().toISOString(),
  })
  if (history.length > 100) history.length = 100
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function deletePost(id) {
  const history = getPostHistory().filter((p) => p.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getSchedule() {
  try {
    return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addScheduledPost(entry) {
  const schedule = getSchedule()
  schedule.push({
    id: Date.now(),
    ...entry,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  })
  schedule.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
}

export function removeScheduledPost(id) {
  const schedule = getSchedule().filter((p) => p.id !== id)
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
}

export function markScheduledAsPublished(id) {
  const schedule = getSchedule().map((p) =>
    p.id === id ? { ...p, status: 'published', publishedAt: new Date().toISOString() } : p
  )
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
}
