export function parsePostContent(text) {
  const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => ({
    value: m[1] + '%',
    context: extractContext(text, m.index, 60),
  }))

  const dollars = [...text.matchAll(/\$[\d.]+[BMK]?/g)].map((m) => ({
    value: m[0],
    context: extractContext(text, m.index, 60),
  }))

  const multipliers = [...text.matchAll(/(\d+)[xX]\b/g)].map((m) => ({
    value: m[1] + 'x',
    context: extractContext(text, m.index, 60),
  }))

  const timeframes = [...text.matchAll(/(\d+)\s*(weeks?|months?|quarters?|years?|days?|hours?)/gi)].map((m) => ({
    value: m[0],
    context: extractContext(text, m.index, 60),
  }))

  const stats = [...percentages, ...dollars, ...multipliers, ...timeframes]
    .slice(0, 8)
    .filter((s, i, arr) => arr.findIndex((x) => x.value === s.value) === i)

  const arrowLines = text
    .split('\n')
    .filter((l) => /^→|^►|^\d+\.\s/.test(l.trim()))
    .map((l) => l.replace(/^→\s*|^►\s*|^\d+\.\s*/, '').trim())
    .filter((l) => l.length > 5 && l.length < 100)
    .slice(0, 6)

  const keyPhrases = extractKeyPhrases(text)

  const hook = text.split('\n')[0] || ''

  return { stats, arrowLines, keyPhrases, hook }
}

function extractContext(text, index, radius) {
  const start = text.lastIndexOf('\n', index)
  const end = text.indexOf('\n', index)
  return text.slice(Math.max(start + 1, 0), end === -1 ? undefined : end).trim()
}

function extractKeyPhrases(text) {
  const importantPatterns = [
    /(?:the )?(?:real |biggest |key )?(?:unlock|insight|takeaway|difference|truth|pattern|signal)/gi,
    /(?:AI|Cursor|ROI|CIO|VP|DevOps|DevSecOps|enterprise|platform|codebase|developer|engineering)/gi,
    /(?:business model|competitive moat|workforce multiplier|talent strategy|revenue|cost reduction)/gi,
    /(?:payback period|time-to-market|time-to-ship|cycle time|production bugs)/gi,
  ]

  const phrases = new Set()
  for (const pattern of importantPatterns) {
    for (const match of text.matchAll(pattern)) {
      phrases.add(match[0])
    }
  }
  return [...phrases].slice(0, 8)
}

const LAYOUT_STYLES = [
  'stat-grid',
  'comparison',
  'framework-pillars',
  'big-number-stack',
  'list-with-header',
  'timeline-flow',
]

export function pickLayout(text, topicId, salt = '') {
  const { stats, arrowLines } = parsePostContent(text)
  const h = simpleHash(`${text}::${topicId || ''}::${salt}`)

  if (stats.length >= 4) {
    return h % 2 === 0 ? 'stat-grid' : 'big-number-stack'
  }
  if (arrowLines.length >= 4) {
    return h % 2 === 0 ? 'list-with-header' : 'timeline-flow'
  }
  if (stats.length >= 2) {
    return 'comparison'
  }

  return LAYOUT_STYLES[h % LAYOUT_STYLES.length]
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export { simpleHash }
