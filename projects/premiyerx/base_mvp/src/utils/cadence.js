/**
 * Posting cadence tracker — Move 3 of the LinkedIn distribution playbook.
 *
 * 2026 reach data: 2–4 posts/week is the sweet spot. Daily posting drops
 * average reach PER POST ~26% and accelerates content fatigue. This is a
 * self-contained publish log (the author marks when they actually post, which
 * is different from how many drafts they generate) plus a weekly read-out.
 */

const KEY = 'lidp_publish_log_v1'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const SWEET_MIN = 2
const SWEET_MAX = 4

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    // Keep the trailing ~60 days; we only ever read a 7-day window.
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
    localStorage.setItem(KEY, JSON.stringify(list.filter((n) => n >= cutoff).slice(-40)))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Record that a post was published now (or at `ts`). */
export function markPosted(ts = Date.now()) {
  const list = read()
  list.push(ts)
  write(list)
  return getCadenceStatus()
}

/** Undo the most recent mark (in case of a misclick). */
export function undoLastPosted() {
  const list = read()
  list.pop()
  write(list)
  return getCadenceStatus()
}

/**
 * @param {number} [now]
 * @returns {{ weekCount:number, tone:'low'|'good'|'high', headline:string, detail:string }}
 */
export function getCadenceStatus(now = Date.now()) {
  const weekCount = read().filter((ts) => ts >= now - WEEK_MS).length

  if (weekCount > SWEET_MAX) {
    return {
      weekCount,
      tone: 'high',
      headline: `${weekCount} posts in the last 7 days — over the sweet spot`,
      detail:
        'Daily/near-daily posting drops average reach per post ~26% and accelerates fatigue. Space them out; 2–4 high-effort posts/week wins.',
    }
  }
  if (weekCount < SWEET_MIN) {
    return {
      weekCount,
      tone: 'low',
      headline: `${weekCount} post${weekCount === 1 ? '' : 's'} in the last 7 days`,
      detail:
        'Room to post more. 2–4 posts/week is the reach sweet spot — consistency builds your topic authority without fatigue.',
    }
  }
  return {
    weekCount,
    tone: 'good',
    headline: `${weekCount} posts in the last 7 days — right in the sweet spot`,
    detail: '2–4 high-effort posts/week is the reach-optimal cadence. Keep it here.',
  }
}
