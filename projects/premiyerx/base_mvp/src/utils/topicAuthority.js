/**
 * Topic Authority — Move 3 of the LinkedIn distribution playbook.
 *
 * LinkedIn's ranking assigns each creator a "topic fingerprint"; content that
 * stays inside a tight niche travels to 2nd/3rd-degree networks far better than
 * content that drifts. This scores how well a draft matches the author's locked
 * niche (AI × SDLC × enterprise engineering leadership) and warns on drift.
 *
 * Deterministic, no API cost.
 */

// Curated niche vocabulary. Multi-word phrases are matched as substrings;
// single tokens are matched on word boundaries.
const NICHE_TERMS = [
  'ai',
  'artificial intelligence',
  'llm',
  'gen ai',
  'copilot',
  'cursor',
  'agent',
  'sdlc',
  'software',
  'developer',
  'engineering',
  'engineer',
  'dev tool',
  'devops',
  'devsecops',
  'ci/cd',
  'pipeline',
  'codebase',
  'code review',
  'shipping',
  'deploy',
  'release',
  'security',
  'governance',
  'compliance',
  'platform',
  'productivity',
  'velocity',
  'cycle time',
  'technical debt',
  'enterprise',
  'fortune 500',
  'procurement',
  'roi',
  'seats',
  'adoption',
  'pilot',
  'production',
  'cio',
  'cto',
  'ciso',
  'cfo',
  'vp eng',
  'vp of engineering',
  'platform team',
]

const WORD_TERMS = new Set([
  'ai',
  'llm',
  'copilot',
  'cursor',
  'agent',
  'sdlc',
  'software',
  'developer',
  'engineering',
  'engineer',
  'devops',
  'devsecops',
  'pipeline',
  'codebase',
  'security',
  'governance',
  'compliance',
  'platform',
  'productivity',
  'velocity',
  'enterprise',
  'procurement',
  'roi',
  'seats',
  'adoption',
  'pilot',
  'production',
  'cio',
  'cto',
  'ciso',
  'cfo',
])

const DRIFT_THRESHOLD = 35

function matchedTerms(text) {
  const lower = String(text || '').toLowerCase()
  const hits = new Set()
  for (const term of NICHE_TERMS) {
    if (term.includes(' ') || term.includes('/')) {
      if (lower.includes(term)) hits.add(term)
    } else if (WORD_TERMS.has(term)) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) hits.add(term)
    } else if (lower.includes(term)) {
      hits.add(term)
    }
  }
  return [...hits]
}

/**
 * @param {{hook?:string, body?:string, cta?:string}} post
 * @param {{topicLabel?:string}} [opts]
 * @returns {{ score:number, onTopic:boolean, matchedTerms:string[], warning:(string|null) }}
 */
export function scoreTopicAuthority(post, opts = {}) {
  const text = `${post?.hook || ''}\n${post?.body || ''}\n${post?.cta || ''}`
  const hits = matchedTerms(text)
  // Score scales with the number of DISTINCT niche terms; saturates at ~6.
  const score = Math.min(100, Math.round((hits.length / 6) * 100))
  const onTopic = score >= DRIFT_THRESHOLD
  const warning = onTopic
    ? null
    : `This draft reads light on your niche (AI × SDLC × enterprise). Off-fingerprint posts travel poorly past your direct network — anchor it harder to ${
        opts.topicLabel || 'AI in the SDLC'
      } before posting.`
  return { score, onTopic, matchedTerms: hits, warning }
}
