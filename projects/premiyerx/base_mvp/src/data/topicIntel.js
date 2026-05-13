/**
 * Per-topic research queries for live headline/context fetches.
 * When you add a topic in `postTemplates.js`, add a matching entry here
 * (or it will fall back to `defaultResearch()` using the topic label).
 */
export const TOPIC_RESEARCH = {
  cursor: {
    hnQueries: [
      'Cursor editor AI OR Windsurf OR Zed AI coding',
      'agentic coding OR "AI software development" enterprise',
      '"GitHub Copilot" OR "AI code review" OR Devin AI',
    ],
    gnewsQuery:
      '("Cursor" AI editor) OR ("AI coding" enterprise) OR (Windsurf IDE) OR ("software development" AI agents)',
  },
  investment: {
    hnQueries: [
      'AI startup funding OR venture capital developer tools',
      '"Series A" OR Series B AI infrastructure OR inference',
      'Groq OR OpenAI OR Anthropic enterprise deal OR valuation',
    ],
    gnewsQuery:
      '(AI developer tools funding) OR ("venture capital" AI software) OR (OpenAI OR Anthropic OR Groq investment 2026)',
  },
  cio: {
    hnQueries: [
      'CIO AI strategy OR "chief information officer" transformation',
      '"VP Engineering" OR CTO OR CDO cloud OR AI adoption enterprise',
      'Gartner OR McKinsey CIO survey OR IT budget AI',
    ],
    gnewsQuery:
      '(CIO AI) OR ("chief digital officer" technology) OR ("VP engineering" AI adoption) OR (enterprise IT transformation 2026)',
  },
  roi: {
    hnQueries: [
      'developer productivity ROI OR "software engineering" metrics',
      'DORA report OR Forrester TEI OR AI coding savings',
      '"cost of software" OR engineering efficiency OR incident reduction',
    ],
    gnewsQuery:
      '(AI developer productivity ROI) OR ("software engineering" cost savings) OR (Forrester OR Gartner IT ROI 2026)',
  },
}

export function defaultResearch(topicLabel) {
  const label = (topicLabel || 'enterprise technology').trim().slice(0, 96)
  return {
    hnQueries: [
      `${label} OR enterprise CIO OR CTO`,
      `${label} (funding OR acquisition OR product launch)`,
    ],
    gnewsQuery: `${label} enterprise OR cybersecurity OR AI`,
  }
}

export function researchForTopic(topicId, topicLabel) {
  if (topicId && TOPIC_RESEARCH[topicId]) return TOPIC_RESEARCH[topicId]
  return defaultResearch(topicLabel || topicId || '')
}
