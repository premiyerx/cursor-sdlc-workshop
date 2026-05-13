/** When adding a topic, add matching research queries in `src/data/topicIntel.js`. */
const TOPICS = [
  {
    id: 'cursor',
    label: 'Cursor: wins across the stack',
    icon: '⚡',
    color: '#3EDC81',
    description:
      'Beats narrow copilots with real SDLC coverage, a faster harness, model neutrality (no lock-in), and native runs that are cheaper and faster for comparable work.',
    templates: [
      {
        hook: "73% of dev teams fail with AI coding tools. Here's why.",
        body: `(And the $2B lesson most companies are missing)

I've spent 29 years in enterprise tech.

Here's what I keep seeing:

Most teams stop at autocomplete.
That's like buying a Tesla and never turning on Autopilot.

The real difference between tools:

→ Copilot: 10% speed boost — line-by-line suggestions
→ ChatGPT: copy-paste workflows — 2x leverage at best
→ Cursor: full codebase reasoning — 10x leverage

📊 What happened when 200 engineers switched:

→ PR cycle time dropped 40% (DORA, 2025)
→ Code reviews went from mechanical to strategic
→ Junior devs shipped at mid-level velocity
→ $4.2M in annual savings (Forrester TEI, 2025)

The unlock isn't typing faster.

It's thinking differently.

When your AI reads your entire architecture — tests, dependencies, build system — it stops being a tool.

It becomes a teammate.

The companies that get this will define the next era.

The ones that don't will wonder why competitors ship 5x faster.`,
        cta: "What's your team using — autocomplete or full codebase AI?",
        hashtags: '#Cursor #AIDevTools #SoftwareDevelopment #EngineeringLeadership #DevProductivity',
        firstComment: `P.S. The 73% failure rate isn't about the tools — it's about adoption.

The pattern I see:

→ Top-down mandates = 20% adoption
→ Developer choice = 85%+ in 30 days

The delta? Trust and autonomy.

Has anyone here seen a top-down AI tool rollout actually succeed? I'd love the counterexample.`,
      },
      {
        hook: "87% of engineering leaders evaluate AI tools wrong.",
        body: `(This mistake costs teams $1.8M+ per year)

They treat AI coding tools like IDE plugins.

They're not.

They're workforce multipliers.

Here's what the math looks like:

💡 The ROI per seat:
→ $150K developer saving 2 hours/day = $37K annual ROI
→ 50-person team = $1.8M recovered capacity
→ Payback period: 6 weeks — not months (Forrester, 2025)

🔑 The 4 questions that actually matter:

1. Can it reason across 500+ files?
2. Can it plan, execute, and iterate autonomously?
3. Does it understand your build pipeline?
4. SOC2, SSO, audit logs, privacy controls?

Cursor checks every box.

But here's what nobody talks about:

→ They ship new capabilities weekly
→ Developers who try it can't go back
→ Organic pull from engineers is the strongest signal in enterprise software

That's not marketing.

That's product-market fit at scale.`,
        cta: "How does your team evaluate AI dev tools — features list or actual developer leverage?",
        hashtags: '#Cursor #AIEngineering #DevTools #EnterpriseAI #CTO',
        firstComment: `P.S. One CTO told me they tried pausing Cursor licenses for a cost review.

→ 14 engineers threatened to buy personal licenses
→ The review lasted 48 hours
→ They expanded to the full org instead

That's the kind of signal PE firms circle for. What "can't go back" moments have you seen?`,
      },
      {
        hook: "200 engineers switched to Cursor. The numbers stopped me cold.",
        body: `(A VP of Engineering shared this last week)

The headline metrics:

→ 40% reduction in PR cycle time
→ 25% fewer production bugs
→ 50% less boilerplate time
→ Junior devs shipping at 2x previous velocity

But here's what nobody expected:

💡 Senior engineers shifted from writing code to architecting systems.

The team's definition of "productivity" changed.

Code review became strategic, not mechanical.

Technical debt started shrinking for the first time in 3 years.

📊 The real unlock wasn't speed — it was leverage.

When AI handles the mechanical work, your $200K+ humans focus on creative, high-value decisions.

That's not a productivity story.

That's a business model transformation.

Every CTO I talk to asks: "How do I do more with the team I have?"

The answer is already on their developers' screens.`,
        cta: "How are you measuring AI tool impact — velocity, quality, or something else entirely?",
        hashtags: '#Cursor #EngineeringLeadership #AITransformation #DevProductivity #SoftwareDevelopment',
        firstComment: `P.S. The metric that surprised me most: technical debt shrinking.

Here's why it matters more than speed:

→ Most teams add debt 3x faster than they pay it down
→ AI-assisted refactoring makes cleanup 50% cheaper
→ Engineers actually WANT to clean up old code now

That compounding effect — faster features AND less debt — turns a tool into a strategic advantage.`,
      },
    ],
  },
  {
    id: 'investment',
    label: 'Capital & the AI SDLC',
    icon: '📈',
    color: '#3EDC81',
    description:
      'Funding, valuations, and M&A as AI reshapes delivery—what investors are underwriting vs. what engineering orgs actually feel on the ground.',
    templates: [
      {
        hook: "AI dev tool funding hit $4.2B this year. Here's what the money sees.",
        body: `(The smart money moved — and it's not going back)

The numbers are staggering:

→ $4.2B deployed in 12 months — 3x YoY (PitchBook, Q4 2025)
→ 73% of Fortune 500 have active pilots (Gartner, 2025)
→ Average deal size grew 180%
→ Time-to-close: 60% faster than traditional DevOps

But the real story is HOW these deals happen:

🔑 4 signals PE firms can't ignore:

1. 140%+ net revenue retention (Bessemer Cloud Index)
2. Bottom-up PLG making enterprise sales obsolete
3. Developers choose the tool before procurement knows
4. The TAM isn't "dev tools" — it's every developer on earth

This follows the exact cloud pattern from 2012:

→ Early adopters proved ROI
→ Fast followers created urgency
→ Laggards faced existential pressure

We're at that inflection point right now.

As an investor in OpenAI and Groq, I see the infrastructure solidifying.

The application layer — AI-native dev platforms — is where the next $100B company gets built.`,
        cta: "Where do you see the biggest opportunity — infrastructure, platform, or application layer?",
        hashtags: '#VentureCapital #AIInvestment #SDLC #PrivateEquity #EnterpriseAI',
        firstComment: `P.S. One data point still developing:

Secondary market for AI dev tool equity is heating up fast.

→ Top AI dev tool companies' implied valuations jumped 4x in secondaries
→ Some LPs asking for concentrated AI dev tool exposure

Reminds me exactly of Snowflake secondaries in 2019. What signals are you watching?`,
      },
      {
        hook: "PE firms are obsessing over AI dev tools. The unit economics explain why.",
        body: `(I track this market obsessively — here's the data)

The headline numbers:

→ $4.2B deployed this year (PitchBook, 2025)
→ Net revenue retention averaging 140%+
→ 87% of deals close bottom-up from developers
→ Average contract expansion: 3x within 12 months

💡 Why PE specifically?

The unit economics are extraordinary:

1. Near-zero marginal cost per seat
2. Switching costs that compound monthly
3. Usage-based pricing with natural expansion
4. Enterprise cycles shrinking from 9 months to 6 weeks

📊 The most telling metric:

Developer satisfaction scores hit all-time highs.

Happy users = low churn = predictable revenue = PE paradise.

As an LP at Stage 2 Capital and MVP Ventures, I've seen this pattern before.

Cloud. SaaS. PLG.

→ Every time, skeptics called it a bubble
→ Every time, early movers built category-defining companies

This time is no different.

The window is open. It won't stay long.`,
        cta: "Are you seeing the same bottom-up adoption in your portfolio — or is this overhyped?",
        hashtags: '#PrivateEquity #AIInvestment #SaaS #DevTools #VentureCapital',
        firstComment: `P.S. From the LP side — something underappreciated:

AI dev tools don't need 500-person sales teams.

→ Developers adopt, expand, and advocate without being asked
→ CAC is plummeting while LTV climbs
→ 3 PE term sheets last quarter with >15x revenue multiples for pre-profit companies

That tells you everything about conviction levels.`,
      },
    ],
  },
  {
    id: 'cio',
    label: 'CIO & VP Eng stakes',
    icon: '🎯',
    color: '#3EDC81',
    description:
      'Talent, governance, security, and speed at scale—what breaks when AI touches the whole SDLC, and what “good” looks like for skeptical leadership.',
    templates: [
      {
        hook: "I talked to 30 CIOs last quarter. They all admitted the same 3 fears.",
        body: `(And only one group is solving all three at once)

Every conversation surfaced the same truth:

🔴 Fear #1: "We can't hire fast enough"
→ 87% cite talent shortage as top concern
→ Senior engineers: $200K+ and 6 months to ramp

🔴 Fear #2: "Our tech debt is a business risk"
→ 79% say it now threatens revenue (Stripe, 2024)
→ Refactoring budgets get cut every quarter

🔴 Fear #3: "We'll fall behind on AI and never catch up"
→ 73% believe the readiness gap is widening (Gartner, 2025)
→ Boards asking questions CIOs can't answer

Here's what I tell every one of them:

💡 AI dev tools solve all 3 simultaneously:

1. Multiply existing team output → Fear #1 solved
2. Make refactoring 50% cheaper → Fear #2 solved
3. Build institutional AI muscle TODAY → Fear #3 solved

The CIOs who act now aren't just solving problems.

They're building a 2-3 year competitive moat that compounds.`,
        cta: "Which of these fears hits closest to home for your org?",
        hashtags: '#CIO #EngineeringLeadership #DevOps #DevSecOps #AITransformation',
        firstComment: `P.S. The fear that surprised me most? #3.

Not because CIOs don't believe in AI. Because they do — and they're terrified their orgs can't execute.

→ 68% said boards ask about AI strategy quarterly (Deloitte, 2025)
→ 45% don't have a clear answer yet

Fastest fix? Put AI tools directly in developer hands. Ship something this quarter.`,
      },
      {
        hook: "The AI mandate is landing on every VP of Engineering's desk. Here's how the best ones respond.",
        body: `(Board wants AI. Team wants stability. Budget wants miracles.)

I see this tension in every conversation.

Here's how the best leaders thread the needle:

🔑 4 principles that work:

1. Start with developer experience, not executive mandates
→ Let teams choose. Measure adoption, not compliance.

2. Define success metrics BEFORE rollout
→ PR cycle time. Deployment frequency. Dev satisfaction.
→ NOT "lines of code."

3. Make security non-negotiable from day 1
→ SOC2, data privacy, code provenance
→ VP DevSecOps at the table immediately

4. Frame it as capability investment, not cost
→ A tool that 2x your team = highest-ROI spend in your budget

📊 The numbers back this up:

→ 40% faster time-to-ship (DORA, 2025)
→ 25% fewer production bugs
→ $37K annual savings per developer seat (Forrester, 2025)
→ 6-week payback period

The leaders who get this right have a 2-3 year head start.

Everyone else is playing catch-up.`,
        cta: "How are you balancing the AI mandate with your team's stability — top-down or bottom-up?",
        hashtags: '#VPEngineering #DevSecOps #AITransformation #EngineeringLeadership #CIO',
        firstComment: `P.S. The #1 mistake I see: measuring "lines of code generated."

Why that's wrong:

→ More code isn't better — less code that does more is
→ AI tools reduce code volume while increasing capability
→ The real metric: business outcomes shipped per sprint

One VP told me LOC dropped 15% — while feature output doubled. That's the metric.`,
      },
    ],
  },
  {
    id: 'roi',
    label: 'ROI on an AI-led SDLC',
    icon: '💰',
    color: '#3EDC81',
    description:
      'Productivity, revenue pull-through, and cost takeout when you change how software is built—numbers execs can defend, not slideware ROI.',
    templates: [
      {
        hook: "\"Show me the ROI.\" Every CFO asks. Here's the answer from 50+ deployments.",
        body: `(The payback period will surprise you)

📊 COST REDUCTION:
→ 30-40% faster time-to-ship
→ 25% fewer production bugs caught in dev
→ 50% less boilerplate and repetitive code

📈 REVENUE IMPACT:
→ 2x faster time-to-market for new products
→ Engineering capacity freed for revenue features
→ Competitive differentiation through shipping velocity

🔮 FUTURE-PROOFING:
→ AI tool proficiency = recruiting advantage
→ Technical debt reduction compounds quarterly
→ Institutional AI knowledge builds org muscle

💡 The math that closes the deal:

1. $150K fully-loaded developer cost
2. Tool saves 2 hours/day = $37K annual ROI per seat
3. 100-person team = $3.7M recovered capacity
4. Payback: 6 weeks (Forrester TEI Study, 2025)

The tool pays for itself before the first invoice is due.

The question isn't "can we afford AI dev tools?"

It's "can we afford NOT to?"`,
        cta: "What ROI metric does your leadership care about most — cost, revenue, or talent retention?",
        hashtags: '#ROI #AITransformation #DevProductivity #EnterpriseAI #CostReduction',
        firstComment: `P.S. The metric that closes deals fastest isn't the $37K per seat.

It's opportunity cost:

→ Competitor ships a feature 3 months before you = lost revenue forever
→ 40% speed increase = 5 extra features per year per team
→ At $500K/feature, that's $2.5M on the table

When I frame it as "revenue you're LOSING," the conversation shifts from cost center to growth lever.`,
      },
      {
        hook: "Companies without AI dev tools by 2026 face something nobody wants to discuss.",
        body: `(An existential talent crisis — and the data proves it)

Top-tier developers now choose employers based on AI tooling.

I've heard this from 3 engineering directors this month:

→ "Best candidates ask about AI tools in the first interview"
→ "Without Cursor or equivalent, they walk"
→ "We lost 4 senior engineers to AI-forward competitors last quarter"

📊 This creates a flywheel nobody can stop:

1. Companies WITH AI tools attract 40% more applicants (LinkedIn, 2025)
2. Better talent ships better products 2x faster
3. Better products drive more revenue
4. More revenue funds more innovation

Meanwhile, companies WITHOUT:

→ Lose candidates to AI-forward competitors
→ Remaining team burns out on manual work
→ Velocity drops 30%, morale drops further
→ More attrition. More open reqs. More cost.

This isn't speculation.

It's happening right now across the Fortune 500.

The AI dev tools investment isn't a technology decision.

It's a talent strategy.
A revenue strategy.
A survival strategy.`,
        cta: "Are your engineering candidates asking about your AI tooling stack yet?",
        hashtags: '#TalentStrategy #AIDevTools #FutureOfWork #EngineeringHiring #DevExperience',
        firstComment: `P.S. A recruiter shared something eye-opening:

→ "AI tooling stack" is now a top 5 question from senior candidates
→ It wasn't on the list 18 months ago
→ One company added "We use Cursor" to job postings — applications jumped 35% in 2 weeks

Has anyone else weaponized their AI tooling as a recruiting advantage?`,
      },
    ],
  },
]

export default TOPICS
