/**
 * Priority pillar briefs — what each topic must argue, who it's for, and how news should land.
 * Used by newsCraft + AI prompts to keep output fresh and on-message.
 */
export const TOPIC_NARRATIVES = {
  cursor: {
    label: 'Cursor vs. the field',
    signalLabel: 'What moved in AI coding this week',
    audience: 'VPs of Engineering, platform leads, and skeptical staff engineers choosing tools',
    coreThesis:
      'Cursor wins because it covers the full SDLC — not autocomplete — with codebase-wide reasoning, model choice, and runs that are faster and cheaper at comparable depth than narrow copilots.',
    competitiveFrame:
      'Contrast narrow copilots (line completion), chat-in-a-tab workflows, and agent hype without audit trails — vs. full-repo context, agentic tasks, and enterprise rollout reality.',
    newsLenses: [
      'Product launches, benchmarks, or enterprise wins for Cursor, Copilot, Windsurf, Devin, or Zed',
      'Developer trust, security review, or procurement friction for AI IDEs',
      'Agentic coding claims vs. what teams actually ship in production',
      'Model-neutral stacks and avoiding vendor lock-in on inference',
    ],
    hookDirections: [
      'Lead with a competitive gap the headlines expose (speed, context, or cost)',
      'Open on what changed in the last 7 days for teams evaluating AI IDEs',
      'Frame as "what PE/boards are asking" vs. "what engineers actually use"',
    ],
    avoid: ['Generic "AI will replace developers" fear posts', 'Unsourced win claims about any vendor'],
  },
  investment: {
    label: 'VC & PE × AI SDLC',
    signalLabel: 'Capital signals reshaping software delivery',
    audience: 'Investors, corp dev, CFOs, and operators who sit between cap table and engineering',
    coreThesis:
      'Money is underwriting AI-native delivery — valuations, NRR, and bottom-up adoption — but the gap between investor narrative and engineering reality is where the best posts live.',
    competitiveFrame:
      'Infrastructure (models, inference) vs. application layer (dev platforms) vs. services — where dollars flow and where returns compound.',
    newsLenses: [
      'Funding rounds, valuations, or M&A in AI dev tools / agents / inference',
      'PE roll-ups, secondary markets, or public-market comps for software',
      'Enterprise deal velocity and pilot-to-production conversion',
      'Talent and margin pressure driving automation spend',
    ],
    hookDirections: [
      'Lead with a dollar figure or valuation move from recent reporting',
      'Contrast what LPs want vs. what engineering orgs feel on the ground',
      'Name the second-order effect of a headline (hiring, M&A, infra spend)',
    ],
    avoid: ['Invented round sizes or dates', 'Ticker advice or stock picks'],
  },
  cio: {
    label: 'CIO & VP Engineering stakes',
    signalLabel: 'What keeps technology leaders up this week',
    audience: 'CIOs, CTOs, CDOs, and VPs of Engineering balancing speed, risk, and org design',
    coreThesis:
      'Leaders are past pilot theater — governance, security, talent, and operating models break at scale when AI touches the whole SDLC.',
    competitiveFrame:
      'Enablement vs. control — policy, data boundaries, auditability, and who owns outcomes when agents touch production.',
    newsLenses: [
      'CIO/CTO surveys, budget shifts, or board-level AI mandates',
      'Security incidents, compliance, or AI governance policy moves',
      'Talent shortage, reorg, or platform consolidation stories',
      'Gartner/McKinsey/Deloitte-style enterprise adoption signals',
    ],
    hookDirections: [
      'Lead with a leadership dilemma surfaced in this week\'s news',
      'Open on a governance or security tension executives are misreading',
      'Frame as "the meeting after the pilot succeeds" — scale problems',
    ],
    avoid: ['Talking down to practitioners', 'Policy jargon without a concrete move'],
  },
  roi: {
    label: 'ROI on an AI-led SDLC',
    signalLabel: 'Proof points on productivity and payback',
    audience: 'CFOs, COOs, and engineering leaders defending budget in QBRs',
    coreThesis:
      'ROI is defensible when tied to cycle time, incidents, rework, and revenue pull-through — not slideware hours saved.',
    competitiveFrame:
      'Payback period vs. risk reduction vs. revenue velocity — pick one storyline and prove it with sourced or hedged numbers.',
    newsLenses: [
      'Productivity studies, DORA/Forrester/Gartner ROI claims',
      'Cost takeout, incident reduction, or time-to-ship benchmarks',
      'Hidden cost centers (rework, meetings, review load) shifting with AI',
      'Pilot ROI that dies in procurement vs. bottom-up adoption that compounds',
    ],
    hookDirections: [
      'Lead with a payback or savings figure tied to a fresh report or trend',
      'Expose a hidden cost center the headlines ignore',
      'Contrast vanity metrics (LOC, commits) vs. business outcomes',
    ],
    avoid: ['Fabricated TEI numbers', 'Guaranteed ROI without hedging'],
  },
}

export function getTopicNarrative(topicId) {
  return TOPIC_NARRATIVES[topicId] || TOPIC_NARRATIVES.cursor
}
