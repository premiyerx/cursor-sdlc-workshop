#!/usr/bin/env node
/**
 * Reach harness: 20 deterministic fixtures simulate realistic raw-model output across
 * archetypes, lengths, and quality. We run each one through the same parse + finalize +
 * deterministic editor stack the app uses on real drafts, then score net reach against the
 * REACH_PUBLISH_MIN bar.
 *
 * The harness exercises ONLY the deterministic path (no LLM round-trips), so the result is
 * a lower bound on real-world pass rate (the live app additionally runs Editor 2 / Editor 3
 * LLM rounds, which lift weak drafts further).
 *
 * Run: `node scripts/reach-harness.mjs` (from base_mvp).
 */

import { parseGeneratedPost } from '../src/utils/aiPostGenerator.js'
import {
  applyDeterministicReachFixes,
  applyAggressiveDeterministicReachFixes,
} from '../src/utils/reachScoreOptimizer.js'
import { breakdownReachScore, REACH_PUBLISH_MIN } from '../src/utils/draftRecommendation.js'

// Realistic raw outputs: a spread of archetypes, lengths, and common AI pathologies.
const FIXTURES = [
  {
    id: '01_stat_clean',
    desc: 'Stat hook, clean structure',
    raw: `HOOK:
73% of engineering teams cut review cycles in half this quarter, but their incident rate climbed.

BODY:
A VP Engineering at a Fortune 500 walked me through her dashboard yesterday.
Speed went up. Quality went sideways. Two CISOs on the same call called it the new tax on AI velocity.
What changed: pull requests merge faster, but rollback frequency doubled in 60 days.

CTA:
What is your team using as the early-warning metric for this drift on your roadmap?

HASHTAGS:
#SoftwareDelivery #AI #CIO

FIRST_COMMENT:
The teams getting this right share one habit. They added a 24-hour smoke metric before any prod release. Saved them three rollbacks last month. What does your team measure in the first day?`,
  },
  {
    id: '02_story_hook',
    desc: 'First-person story hook',
    raw: `HOOK:
I watched a CFO kill a $4M AI deal in eight minutes on Friday.

BODY:
She asked one question. The vendor could not answer it.
Three CIOs at the table nodded. The deal was dead before lunch.
Across mid-market enterprise teams, the pattern is consistent.

CTA:
What is the one question that would kill the deal on your team this quarter?

HASHTAGS:
#AI #ProcurementReality #CFO`,
  },
  {
    id: '03_contrarian',
    desc: 'Contrarian hook with specific counter',
    raw: `HOOK:
Most VPs of Engineering think AI is a productivity story. The CFOs running the math disagree.

BODY:
A CFO at a $2B enterprise pulled the numbers last week.
Token spend tripled in 90 days. Cycle time improved 11%. The ratio is what woke up the board.

Two things can be true at once.

The teams winning this measure cost per shipped change, not raw productivity.

CTA:
What is the cost-per-change number you are tracking on your team?

HASHTAGS:
#AI #FinOps #Engineering`,
  },
  {
    id: '04_imperative_dead',
    desc: 'Dead imperative hook (should be rescued)',
    raw: `HOOK:
Stop using AI tools without governance.

BODY:
Most teams skip the review step. The audit comes anyway.
A CISO told me three breaches in 30 days traced to ungated AI agents.
Your auditor will find this. Better to find it first.

CTA:
What is your audit gate for AI agents this quarter?

HASHTAGS:
#CISO #AIGovernance`,
  },
  {
    id: '05_overlong_ramble',
    desc: 'Over-length post that needs compression',
    raw: `HOOK:
In today's fast-paced world of AI, every CIO is racing to deploy, but few are measuring the right things — and that is the real story behind the boardroom anxiety we have been seeing for the last 18 months.

BODY:
At the end of the day, the bottom line is that most teams are leveraging generative AI to streamline workflows, but the reality is that they are not measuring the impact in a way that resonates with the CFO. I have talked to dozens of CIOs and the same pattern emerges every time. They double-click on productivity metrics. The CFO double-clicks on cost. Nobody is double-clicking on the right thing, which is the ratio of shipped value to token spend, and that is the metric that will define the next 24 months of enterprise AI adoption across the Fortune 1000. The truth is that the teams who get this right will dominate, and the teams who do not will spend the next budget cycle explaining why their AI program failed to deliver against the original business case. It is no secret that this is a complex landscape, but the ever-evolving nature of the technology demands that we navigate it with clear eyes.

CTA:
Thoughts?

HASHTAGS:
#AI #CIO #Enterprise`,
  },
  {
    id: '06_short_thin',
    desc: 'Too short, thin content (needs lift)',
    raw: `HOOK:
AI is changing software delivery.

BODY:
Teams are shipping faster.

The work is real.

CTA:
What are you seeing?

HASHTAGS:
#AI`,
  },
  {
    id: '07_em_dash_spam',
    desc: 'Em-dash spam everywhere',
    raw: `HOOK:
A CIO told me — quietly — that AI governance is broken — and her CISO agrees.

BODY:
The pattern is everywhere — every Fortune 500 board — every quarterly review — same conversation.

A VP DevOps put it bluntly — "we are building the plane while flying it."

The honest answer — track three metrics — incident rate — rollback frequency — token spend per shipped change.

CTA:
What is your team tracking — and what is missing?

HASHTAGS:
#AI #CISO #Governance`,
  },
  {
    id: '08_emoji_overload',
    desc: 'Emoji overload',
    raw: `HOOK:
🚀 AI is the future of software! 🔥

BODY:
✅ Faster cycles
✅ Lower cost
✅ Better quality

A CIO told me last week 💪 that her team shipped 3x more this quarter 📈.

CTA:
Are you on board? 👇

HASHTAGS:
#AI #LinkedIn`,
  },
  {
    id: '09_list_promise_kept',
    desc: 'List-promise hook delivered correctly',
    raw: `HOOK:
3 things every CISO should ban from their AI rollout this quarter.

BODY:
1. Ungated agents with write access to production data.
2. Pilots without a documented kill switch and owner.
3. Vendor demos that skip the audit trail conversation.

A CISO at a Fortune 100 added a fourth last week. Composite scene from a recent call.

CTA:
Which one would you ban first on your team?

HASHTAGS:
#CISO #AISecurity #Governance`,
  },
  {
    id: '10_list_promise_broken',
    desc: 'List-promise hook NOT delivered (penalty)',
    raw: `HOOK:
Three reasons enterprise AI pilots stall in 2026.

BODY:
The honest reason is that nobody owns the rollback plan. A VP Engineering admitted as much on a recent call.

Teams keep treating pilots like demos.

CTA:
What is the rollback owner on your pilot?

HASHTAGS:
#AI #Enterprise`,
  },
  {
    id: '11_question_with_number',
    desc: 'Question hook with a number (legit)',
    raw: `HOOK:
What does a 40% token-cost overrun actually look like on a Fortune 500 P&L?

BODY:
A CFO showed me the line item last quarter. It was not the AI program. It was the retry loop.
Composite scene from a Friday call.

The teams winning this added one circuit breaker per agent. Cost came down 31% in 60 days.

CTA:
What is your circuit-breaker policy for agent retries on your stack?

HASHTAGS:
#AI #FinOps #CFO`,
  },
  {
    id: '12_full_circle',
    desc: 'Full-circle reflection skeleton',
    raw: `HOOK:
Six months ago I told a CIO her AI strategy would fail. She proved me wrong this week.

BODY:
The first version was a vendor demo with no owner. I said it would stall in 90 days.
She added two things. A budget gate at every quarter. A named human accountable per agent.

This week, her board approved the next phase. Same vendor. Different governance.
Two things changed the curve, owner clarity and quarterly gates.

CTA:
What changed the curve for you, the tooling or the governance?

HASHTAGS:
#AI #CIO #Governance`,
  },
  {
    id: '13_pattern_interrupt',
    desc: 'Hook + pattern-interrupt body',
    raw: `HOOK:
The AI bill arrived. Three Fortune 500 CFOs called the same vendor by Wednesday.

BODY:
Wild.

A CFO told me the ratio was the issue. Token spend up 4x. Cycle time down 12%.
Across mid-market teams the pattern is consistent.

CTA:
What is your token-spend-to-cycle-time ratio looking like this quarter on your team?

HASHTAGS:
#AI #FinOps #CFO`,
  },
  {
    id: '14_thoughts_cta',
    desc: 'Weak "thoughts?" CTA',
    raw: `HOOK:
A VP DevOps at a Fortune 100 told me her rollback rate doubled in 60 days after the AI rollout.

BODY:
She found the cause in two weeks. The agents had write access to environments that lacked smoke tests.
Three engineers fixed it on a Friday. Rollback rate dropped 47% the next sprint.

CTA:
Thoughts?

HASHTAGS:
#AI #DevOps`,
  },
  {
    id: '15_jargon_heavy',
    desc: 'Heavy corporate jargon (banned vocab)',
    raw: `HOOK:
Best-in-class enterprises are leveraging AI to unlock unprecedented value.

BODY:
We are seeing world-class teams utilize cutting-edge tools to streamline workflows and accelerate outcomes.
This is mission-critical. The paradigm shift is here.

A holistic approach to next-gen AI is table stakes for any organization navigating this complex landscape.

CTA:
How is your team navigating the ever-evolving AI landscape?

HASHTAGS:
#AI #Innovation`,
  },
  {
    id: '16_specific_minimal',
    desc: 'Specific hook, minimal body',
    raw: `HOOK:
A CIO at a $4B retailer killed her AI pilot 30 days early. She saved $2M.

BODY:
The pilot had no rollback owner. She made that the first rule of the new program.

CTA:
What is the first rule of your next AI pilot on your team?

HASHTAGS:
#AI #CIO #Retail`,
  },
  {
    id: '17_dialogue_hook',
    desc: 'Dialogue-style hook',
    raw: `HOOK:
"We do not have time for governance." That is what a VP Engineering told her CISO. Then the audit came.

BODY:
The audit found 14 ungated AI agents in 6 days. Three had write access to production billing.
She told me on a Friday call she now treats every agent like a junior employee, badge in, badge out.

Across Fortune 500 teams the pattern is consistent.

CTA:
What is your badge-in policy for AI agents in production on your team?

HASHTAGS:
#CISO #AIGovernance`,
  },
  {
    id: '18_messy_format',
    desc: 'Raw, no section headers, no JSON',
    raw: `A VP DevSecOps at a Fortune 200 fixed her AI compliance gap in 11 days. Composite scene.

She did three things her peers had not.

She made every agent register with the SOC before deploy. She forced a 24-hour shadow period in staging. She killed any agent that wrote to billing systems without a human approval.

The result was a 38% drop in audit findings the next quarter.

What is one of those three you have not yet tried on your team?

#CISO #AISecurity #SOC`,
  },
  {
    id: '19_breaking_buckle',
    desc: 'Toxic openers + filler',
    raw: `HOOK:
Buckle up. The AI landscape is shifting.

BODY:
Here's the thing — the truth is, most teams are not ready. Let me be clear: this is a game-changer.
At the end of the day, the bottom line is that the ever-evolving nature of AI demands a holistic approach.

A CIO told me last week that her team is leveraging cutting-edge tools to unlock the power of AI.

CTA:
Are you ready?

HASHTAGS:
#AI #Innovation`,
  },
  {
    id: '20_solid_baseline',
    desc: 'Solid baseline post, should pass already',
    raw: `HOOK:
A CIO at a Fortune 100 told me her AI program saved $4.6M in 90 days. The reason surprised me.

BODY:
It was not the model. It was the kill switch.
Her team built one rule. Any agent that ran two retries without resolution paused for human review.

That single change cut token spend 31% and dropped incidents 22% in one quarter. Three other CIOs on the same call ran the same playbook within a month.

CTA:
What is the one rule that would change your AI economics on your team this quarter?

HASHTAGS:
#AI #FinOps #CIO

FIRST_COMMENT:
The deeper insight: the teams that wrote the rule did it before the auditor asked. What does your team measure before audit week?`,
  },
]

function runOneFixture(fx) {
  let parsed
  try {
    parsed = parseGeneratedPost(fx.raw, { allowList: false, rhythmSeed: 7 })
  } catch (e) {
    return { id: fx.id, desc: fx.desc, error: e.message, passed: false, finalScore: 0 }
  }

  const initialBreakdown = breakdownReachScore(parsed)

  // Pass 1: deterministic reach fixes (mirrors what the editor pipeline does between LLM rounds).
  let after1 = applyDeterministicReachFixes(parsed, {
    allowList: false,
    rhythmSeed: 7,
    penaltyHints: initialBreakdown.penalties,
  })
  let breakdown1 = breakdownReachScore(after1)

  // Pass 2 (only if still under bar): aggressive deterministic fixes.
  let finalPost = after1
  let finalBreakdown = breakdown1
  if (breakdown1.reachScore < REACH_PUBLISH_MIN) {
    finalPost = applyAggressiveDeterministicReachFixes(after1, {
      allowList: false,
      rhythmSeed: 13,
      penaltyHints: breakdown1.penalties,
    })
    finalBreakdown = breakdownReachScore(finalPost)
  }

  const topPenalties = (finalBreakdown.penalties || [])
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((p) => `${p.id}:${p.points}`)
    .join(', ')

  return {
    id: fx.id,
    desc: fx.desc,
    initialScore: initialBreakdown.reachScore,
    afterReachFixes: breakdown1.reachScore,
    finalScore: finalBreakdown.reachScore,
    passed: finalBreakdown.reachScore >= REACH_PUBLISH_MIN,
    topPenalties,
  }
}

function main() {
  const results = FIXTURES.map(runOneFixture)
  const passCount = results.filter((r) => r.passed).length
  const passRate = (passCount / results.length) * 100

  console.log('Reach Harness Results')
  console.log('=====================')
  console.log(`Bar: net reach >= ${REACH_PUBLISH_MIN}`)
  console.log('')
  console.log('ID                    | initial | after-det | final | pass | top-penalties')
  console.log('----------------------+---------+-----------+-------+------+------------------')
  for (const r of results) {
    const id = r.id.padEnd(21)
    const init = String(r.initialScore ?? '-').padStart(7)
    const det = String(r.afterReachFixes ?? '-').padStart(9)
    const fin = String(r.finalScore ?? '-').padStart(5)
    const pass = (r.passed ? 'YES' : ' no').padStart(4)
    const pen = r.topPenalties || (r.error ? `ERR ${r.error}` : '')
    console.log(`${id} | ${init} | ${det} | ${fin} | ${pass} | ${pen}`)
  }
  console.log('')
  console.log(`Passed ${passCount} / ${results.length} (${passRate.toFixed(1)}%)`)
  console.log(`Target: 85.0% (i.e., 17 / 20)`)
  if (passRate >= 85) {
    console.log('STATUS: PASS')
    process.exit(0)
  } else {
    console.log('STATUS: FAIL')
    process.exit(1)
  }
}

main()
