/**
 * Priority pillar briefs — what each topic must argue, who it's for, and how news should land.
 * Used by newsCraft + AI prompts to keep output fresh and on-message.
 * `carouselTrio`, `carouselPillarCols`, `platformLegendCells`, and `carouselCtas` feed the PDF carousel
 * so Roadmap / Ship / Prove and pillar columns stay readable and on-theme.
 */

/** End-of-post questions when the draft reuses the same CTA too often (carousel slide 4). */
export const CAROUSEL_CTA_BANK = [
  'Which single workflow would you trust an agent to own end-to-end in the next 90 days?',
  'Where does your org still default to line-only help instead of repo-wide context?',
  'What would change your mind on an AI IDE: speed, security review, or procurement terms?',
  'If you froze new tools for a quarter, what would still be true about how your team ships?',
  'Who owns the outcome when an agent touches production: platform, security, or the squad lead?',
  'What is the one metric you would show a skeptical CFO before expanding seats?',
  'When a pilot succeeds, what breaks first at scale: policy, latency, or trust?',
  'Which vendor claim would you demand receipts for before the next budget cycle?',
  'How do you decide between best-in-class models vs. one standardized stack?',
  'What is the smallest proof you would accept before rolling wider to adjacent teams?',
  'Where have you seen AI tooling help retention—not just throughput?',
  'What would you stop doing manually if the IDE understood your whole repo tomorrow?',
]

const DEFAULT_PLATFORM_LEGEND = ['THEMES', 'SCOPE', 'SPEED', 'RISK', 'CODE', 'SHIP', 'PROOF', 'NEXT']

const DEFAULT_CAROUSEL_TRIO = {
  roadmap:
    'Roadmap the change: name the quarter where planning and review get faster when the tool understands the whole repo—not just the current line.',
  ship:
    'Ship with owners: fewer handoffs, clearer diffs, and releases that survive real users—not a chat tab guessing without context.',
  prove:
    'Prove it on outcomes: cycle time, rework, incidents, and stakeholder trust—not slideware hours or one cherry-picked demo.',
}

const DEFAULT_PILLAR_COLS = [
  'External signals: what customers, candidates, and critics see in public channels before your release notes say anything.',
  'Entity-level surfaces: brands, people, products, and launches each need coherent facts, tone, and owners.',
  'AI-native delivery: agents and automation need an audit trail procurement and security can defend.',
]

export const TOPIC_NARRATIVES = {
  cursor: {
    label: 'Cursor vs. the field',
    signalLabel: 'What moved in AI coding this week',
    audience: 'VPs of Engineering, platform leads, and skeptical staff engineers choosing tools',
    coreThesis:
      'Cursor wins because it covers the full SDLC — not autocomplete only — with codebase-wide reasoning, model choice, and runs that are faster and cheaper at comparable depth than narrow copilots.',
    competitiveFrame:
      'Contrast narrow copilots (line completion), chat-in-a-tab workflows, and agent hype without audit trails — vs. full-repo context, agentic tasks, and enterprise rollout reality.',
    newsLenses: [
      'Product launches, benchmarks, or enterprise wins for Cursor, Copilot, Windsurf, Devin, or Zed',
      'Developer trust, security review, or procurement friction for AI IDEs',
      'Agentic coding claims vs. what teams actually ship in production',
      'Model-neutral stacks and avoiding vendor lock-in on inference',
    ],
    hookDirections: [
      'Lead with a competitive gap the headlines surface: speed, context, or cost.',
      'Open on what changed in the last 7 days for teams evaluating AI IDEs.',
      'Frame as what PE and boards are asking versus what engineers actually use day to day.',
    ],
    avoid: ['Generic "AI will replace developers" fear posts', 'Unsourced win claims about any vendor'],
    platformLegendCells: ['SIGNAL', 'SCOPE', 'CONTEXT', 'RISK', 'BUILD', 'SHIP', 'PROOF', 'NEXT'],
    carouselTrio: {
      roadmap:
        'Roadmap: pick the next two quarters where repo-wide context changes planning, design review, and risk answers—not where you add another autocomplete.',
      ship:
        'Ship: multi-file edits, agents, and consistent patterns across services so merged means production-ready—not a side chat guessing file by file.',
      prove:
        'Prove: adoption, incidents avoided, cycle time, and stakeholder trust—not demo theater, cherry metrics, or vendor scorecards alone.',
    },
    carouselPillarCols: [
      'External reality: what the market sees in social, search, and forums before your changelog narrates the story.',
      'Entity-level exposure: brands, leaders, products, and launches each need one coherent message and one accountable owner.',
      'AI-native delivery: when agents touch code or customers, you need traceability security and procurement can sign.',
    ],
    carouselCtas: [
      'Which constraint would you lift first: model choice, audit trails, or rollout playbooks?',
      'If procurement ran the pilot, who owns the outcome when it hits production?',
      'What would make you standardize on one stack instead of best-of-breed chaos?',
      'Where is line-only copilot help still costing you rework this quarter?',
    ],
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
    platformLegendCells: DEFAULT_PLATFORM_LEGEND,
    carouselTrio: { ...DEFAULT_CAROUSEL_TRIO },
    carouselPillarCols: [...DEFAULT_PILLAR_COLS],
    carouselCtas: [],
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
      "Lead with a leadership dilemma surfaced in this week's news",
      'Open on a governance or security tension executives are misreading',
      'Frame as the meeting after the pilot succeeds — scale problems',
    ],
    avoid: ['Talking down to practitioners', 'Policy jargon without a concrete move'],
    platformLegendCells: DEFAULT_PLATFORM_LEGEND,
    carouselTrio: { ...DEFAULT_CAROUSEL_TRIO },
    carouselPillarCols: [...DEFAULT_PILLAR_COLS],
    carouselCtas: [],
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
    platformLegendCells: DEFAULT_PLATFORM_LEGEND,
    carouselTrio: { ...DEFAULT_CAROUSEL_TRIO },
    carouselPillarCols: [...DEFAULT_PILLAR_COLS],
    carouselCtas: [],
  },
}

export function getTopicNarrative(topicId) {
  return TOPIC_NARRATIVES[topicId] || TOPIC_NARRATIVES.cursor
}
