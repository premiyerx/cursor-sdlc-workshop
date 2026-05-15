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
      'codebase context OR "AI IDE" OR SWE agent production',
    ],
    gnewsQueries: [
      '("Cursor" AI editor OR "Anysphere") AND (enterprise OR developers)',
      '("GitHub Copilot" OR Windsurf OR Devin) AND ("AI coding" OR IDE)',
      '("agentic coding" OR "AI software development") AND (startup OR enterprise 2026)',
    ],
    gnewsQuery:
      '("Cursor" AI editor) OR ("AI coding" enterprise) OR (Windsurf IDE) OR ("software development" AI agents)',
  },
  investment: {
    hnQueries: [
      'AI startup funding OR venture capital developer tools',
      '"Series A" OR Series B AI infrastructure OR inference',
      'Groq OR OpenAI OR Anthropic enterprise deal OR valuation',
      'AI dev tools acquisition OR private equity software',
    ],
    gnewsQueries: [
      '(AI developer tools OR "coding agents") AND (funding OR valuation OR "Series")',
      '(OpenAI OR Anthropic OR Groq) AND (investment OR valuation OR enterprise deal)',
      '("private equity" OR venture capital) AND ("software development" OR SDLC) 2026',
    ],
    gnewsQuery:
      '(AI developer tools funding) OR ("venture capital" AI software) OR (OpenAI OR Anthropic OR Groq investment 2026)',
  },
  cio: {
    hnQueries: [
      'CIO AI strategy OR "chief information officer" transformation',
      '"VP Engineering" OR CTO OR CDO cloud OR AI adoption enterprise',
      'Gartner OR McKinsey CIO survey OR IT budget AI',
      'AI governance enterprise OR security review AI tools',
    ],
    gnewsQueries: [
      '(CIO OR CTO OR "chief digital officer") AND AI AND (enterprise OR strategy 2026)',
      '("VP engineering" OR "engineering leadership") AND (AI adoption OR transformation)',
      '(Gartner OR McKinsey OR Deloitte) AND (CIO OR IT) AND AI',
    ],
    gnewsQuery:
      '(CIO AI) OR ("chief digital officer" technology) OR ("VP engineering" AI adoption) OR (enterprise IT transformation 2026)',
  },
  roi: {
    hnQueries: [
      'developer productivity ROI OR "software engineering" metrics',
      'DORA report OR Forrester TEI OR AI coding savings',
      '"cost of software" OR engineering efficiency OR incident reduction',
      'AI coding productivity study OR payback enterprise',
    ],
    gnewsQueries: [
      '("developer productivity" OR "software engineering") AND (ROI OR savings OR payback)',
      '(DORA OR Forrester OR Gartner) AND (AI OR "developer tools") AND productivity',
      '("AI-led" OR "AI assisted") AND (SDLC OR "software delivery") AND (cost OR efficiency)',
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
    gnewsQueries: [`${label} enterprise OR AI OR cybersecurity`],
    gnewsQuery: `${label} enterprise OR cybersecurity OR AI`,
  }
}

export function researchForTopic(topicId, topicLabel) {
  if (topicId && TOPIC_RESEARCH[topicId]) return TOPIC_RESEARCH[topicId]
  return defaultResearch(topicLabel || topicId || '')
}
