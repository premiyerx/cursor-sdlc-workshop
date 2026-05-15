import { fnv1a, mulberry32 } from './generationVariety'

const SEED_KEY = 'lidp_refresh_seed_v1'

function readSeeds() {
  try {
    return JSON.parse(sessionStorage.getItem(SEED_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeSeeds(obj) {
  try {
    sessionStorage.setItem(SEED_KEY, JSON.stringify(obj))
  } catch { /* ignore */ }
}

/** Bump rotation counter so refresh / regenerate picks different headlines & stats. */
export function bumpRefreshSeed(topicId) {
  const day = new Date().toISOString().slice(0, 10)
  const seeds = readSeeds()
  const prev = seeds[topicId] || { day, n: 0 }
  const n = prev.day === day ? prev.n + 1 : 1
  seeds[topicId] = { day, n, ts: Date.now() }
  writeSeeds(seeds)
  return fnv1a(`${topicId}:${day}:${n}:${Date.now()}`) >>> 0
}

export function getRefreshSeed(topicId) {
  const seeds = readSeeds()
  const entry = seeds[topicId]
  const day = new Date().toISOString().slice(0, 10)
  const n = entry?.day === day ? entry.n : 0
  return fnv1a(`${topicId}:${day}:${n}`) >>> 0
}

export function rotateSlice(items, seed, count) {
  if (!items?.length) return []
  const rng = mulberry32(seed || 0xdecaf)
  const offset = Math.floor(rng() * items.length) % items.length
  const rotated = [...items.slice(offset), ...items.slice(0, offset)]
  const out = []
  const seen = new Set()
  for (const item of rotated) {
    const key = JSON.stringify(item).slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= count) break
  }
  return out
}

export function pickFromPool(pool, seed, label = '') {
  if (!pool?.length) return pool?.[0] || null
  const idx = mulberry32((seed ^ fnv1a(label)) >>> 0)() * pool.length
  return pool[Math.floor(idx) % pool.length]
}
