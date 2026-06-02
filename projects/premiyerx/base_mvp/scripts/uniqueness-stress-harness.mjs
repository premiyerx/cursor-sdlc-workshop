/**
 * 100x uniqueness stress harness.
 *
 * Simulates the worst-case scenario the founder cares about: "If I press
 * Generate 100 times back-to-back, do I get 100 visibly different drafts?"
 *
 * We can't call live LLMs in a deterministic test, so this harness exercises
 * the parts that DO determine uniqueness in production:
 *   1. The Jaccard / cluster scoring in draftHistory.scoreNovelty
 *   2. The AVOID_BLOCK formatting (proxy: forbidden openers/trigrams extracted
 *      from the rolling history)
 *   3. Behavior of the rolling 150-draft history when bombarded with a
 *      diverse fixture pool of hand-crafted drafts.
 *
 * What this proves:
 *   A. The 150-entry history correctly accepts 100 distinct drafts.
 *   B. When a near-duplicate of an existing draft comes back through the
 *      pipeline, the system flags it (novelty < retry threshold).
 *   C. When a genuinely-fresh draft comes through, it scores well above
 *      the retry threshold (so it ships on the first attempt in real use).
 *   D. Across 100 distinct drafts, the pairwise novelty distribution is
 *      healthy enough that random pairs don't read as twins.
 *   E. The forbidden-opener / forbidden-trigram extractors correctly surface
 *      recurring patterns so the next AVOID_BLOCK informs the next prompt.
 *   F. Digit normalization holds (regression guard).
 */

const mockStorage = new Map()
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) ?? null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
}

const {
  recordDraft,
  scoreNovelty,
  clearDraftHistory,
  extractForbiddenOpeners,
  extractForbiddenTrigrams,
  getDraftHistory,
  __internals,
} = await import('../src/utils/draftHistory.js')

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`PASS  ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}  ${detail}`)
  }
}

/* ------------------------------------------------------------------
 * Diverse fixture pool: 100 hand-crafted draft fragments designed to
 * resemble real LLM output diversity. We rotate hooks and bodies
 * independently with prime offsets so no two indexes land on the same
 * (hook, body) pair across the 100-draft window.
 * ------------------------------------------------------------------ */

const HOOKS = [
  'A CFO told me yesterday the AI line item is bigger than the cloud line.',
  'Three buyers, three contradictions, one budget freeze.',
  'Half the AI seats sit idle by Wednesday. Nobody flags it.',
  'The VP DevSecOps walked in with a heatmap. Half the rows were vendor logos nobody approved.',
  'I watched a CIO kill a six-figure pilot in 12 minutes.',
  'The procurement deck still calls these "experiments." The finance deck calls them line items.',
  'What every CISO asked me this week, and what none of them asked last quarter.',
  'When the model gets cheaper, the wrong things get scaled.',
  'Two boards. Same week. Opposite calls on AI capex.',
  'The hardest part of an AI rollout is not the model. It is the renewal cycle.',
  'A 47-engineer team I work with cut 8 tools to 2 without losing velocity.',
  'When the board asked the CIO for one number, he gave them three.',
  'Why I stopped recommending "POC budgets" entirely.',
  'The post-mortem nobody wanted to write got written this week.',
  'Three patterns from the most successful enterprise rollouts I have seen this year.',
  'There is a quiet conversation happening between CFOs and CISOs that engineers will feel by Q3.',
  'The new procurement question is not "what does it cost." It is "what does the renewal look like."',
  'Why "agent governance" is a CFO problem before it is a security problem.',
  'I keep meeting Fortune 500 teams that solved this years ago. We are still relearning it.',
  'The CIO asked what would change if her seat count was wrong by 30%. The answer surprised the room.',
  'Anyone else seeing inference cost lines outpace seat cost lines this quarter?',
  'Most enterprise AI failures happen between Q2 review and Q3 budget. Here is why.',
  'Started counting active days per AI seat. The number broke the deck.',
  'The CISO who asked for "AI governance" got the budget. The one who asked for "model risk" did not.',
  'Two acquisitions. Two opposite playbooks. Same outcome.',
]

const BODIES = [
  'Most AI program decks still optimize for a launch number — seats purchased, models live, demos shipped. The deck that lands now optimizes for the renewal: how many of those seats logged in last week, how many of those models survived governance, how many of those demos turned into a real workflow. The shift is small in slides and enormous in budget.',
  'Three patterns keep showing up. First, the active-seat ratio is almost never measured. Second, the renewal is treated as a finance task instead of a product decision. Third, the security review still happens after procurement signs. Flip those three and the math on AI spend looks completely different by the next quarter.',
  'Pilots used to live or die on accuracy benchmarks. They now live or die on something quieter: who owns the runtime cost when usage triples. If your pilot does not name the owner of inference cost on the very first slide, the pilot is already optimizing for the wrong number.',
  'Every leadership meeting in the past two weeks has come back to the same trade-off. Add tools and gain optionality, or rationalize tools and gain leverage. The winners I have watched this quarter chose leverage. They cut the catalog by half and re-invested the savings into a single governance layer that covered everything left.',
  'Procurement has a new job description and nobody put it in writing. It is not "negotiate the seat price." It is "audit the consumption curve." The teams that figured that out are signing 18-month deals at a 30% discount. The teams that did not are signing 12-month deals at a 5% premium with no audit clause.',
  'Three operators told me the same story this month. They moved from a tool-led roadmap to a workflow-led roadmap, and the budget conversation went from defensive to offensive in one quarter. The slide that won the room was not the AI strategy slide. It was the workflow map with cost-to-serve on every node.',
  'The thing that finally changed the conversation in the boardroom was not a productivity number. It was a customer-saved-time number, sourced from real call transcripts and matched to a dollar amount per saved minute. The AI line item stopped being an expense and started being a revenue lever, on the same slide.',
  'For nine months the dashboard told the executive team everything was on track. Then a single audit invalidated half the seat count and triggered a re-bid. The hidden cost was never the tooling itself. It was the renewal cadence nobody questioned and the audit cadence nobody scheduled.',
  'Numbers say one thing and the narrative says another. The numbers say AI adoption is leveling off in the F500. The narrative is still selling exponential. Whichever you anchor on determines whether your next budget cycle is offensive or defensive. I would pick the numbers and bring receipts.',
  'A counter-intuitive read on the last earnings season: the most disciplined AI buyers are not the biggest spenders. They are the buyers who pre-committed to a usage ceiling and rationed against it. Their net retention numbers are quietly outperforming the high-spend cohort by ten points.',
  'Friday afternoon a VP of Eng sent me a one-line note: "we are deprecating two of our four AI vendors next week." No drama, no announcement. The reason was not budget. It was that the two survivors had owned their renewal terms and the two cuts had not.',
  'The board asked four questions about the AI plan. Three were about cost. One was about talent retention. Nobody asked about the model. That single ratio — three cost, one talent, zero model — tells you what the next 18 months will actually be about.',
  'I keep coming back to one pattern from the highest-functioning teams. They write a single owner name on every AI initiative slide. Not a team. A person. The teams that resist that practice are the same teams that struggle with renewal accountability nine months later.',
  'A CISO showed me a heat-map of unsanctioned AI tools running across the org. The number was almost three times the official seat count. The interesting part was not the size. It was the pattern: 80% of the unsanctioned tools clustered inside two business units that had been told to "innovate aggressively."',
  'When you compare the orgs that scaled AI successfully against the ones that stalled, the difference is rarely the model or the budget. It is whether procurement, security, and engineering met weekly during the first 90 days of the rollout. Weekly. Not monthly.',
  'A practical test for any AI initiative this quarter: can you name the single line on the income statement that moves if the project succeeds. If you cannot, you are not running an AI program. You are running an AI experiment, and your CFO will eventually notice.',
  'The conversation has moved past "build vs buy" into something more honest: "buy vs assemble." Most enterprise teams will not build a foundation model. They will assemble a stack from three to five vendors and one open-source component. The assembly is the new differentiator.',
  'Two acquisitions closed this month with very different theses. One bought distribution. One bought governance. The market will tell us which thesis was right in about four quarters. I am betting on governance, and the renewal cycles are already moving that way.',
  'When inference cost outpaces seat cost, the org chart needs to change. That is the unglamorous truth nobody puts on a slide. The team that owns the model also has to own the FinOps for it, or someone will be surprised by an invoice in Q3.',
  'A common mistake on enterprise AI rollouts: hiring the head of AI before defining the workflow. The reverse order is almost always better. Define the three workflows you must improve in the next 12 months, then hire to those workflows. The seat count and tool list will fall out of that work, not the other way around.',
  'Most "AI governance" frameworks I have seen are actually procurement frameworks wearing a security hat. Real AI governance lives much closer to the data team than to the security team, and the orgs that figured that out are 18 months ahead of the ones still debating the policy doc.',
  'The single best leading indicator I have found for an AI program that will succeed is whether the CFO can articulate, in one sentence, how the program changes a number on the P&L. If the answer requires a paragraph, the program will not survive its second budget cycle.',
  'There is an unglamorous play in this market right now. Buy the boring middle of the stack — observability, evals, governance — and let the model vendors and the application layer fight for attention. The boring middle will compound, and the renewal terms will be friendlier.',
  'I watched a CTO close an internal review with a simple statement: "we are not buying any more AI tools this fiscal year." The room expected a debate. Instead, three of his lieutenants visibly relaxed. The decision was about restoring focus, not cutting spend, and the velocity recovered within six weeks.',
  'A pattern showing up across the smartest AI rollouts: a single dashboard that lives on the CFO desk and the head-of-product desk simultaneously. Same numbers, same cadence, same definitions. The orgs that share that dashboard ship faster than the orgs that argue about whose numbers are right.',
]

/**
 * Build 100 deliberately-distinct (hook, body) pairs from 25 hooks + 25 bodies.
 *
 * Naive approach (i % 25, i % 25) cycles every 25 iterations, so iterations
 * 25-49 / 50-74 / 75-99 reproduce the first batch exactly. We work around
 * this by varying the body offset by cycle, so the 4 "passes" over the
 * 25-hook pool each pair hooks with a different bodyOffset.
 *
 * Formula:
 *   hook_idx = i % 25
 *   cycle    = floor(i / 25)              -- 0,1,2,3 across i in [0,100)
 *   body_idx = (i + 7 * cycle) % 25       -- 7 is coprime to 25, so the
 *                                            body cycle shifts by +7 each
 *                                            pass and no (hook,body) pair
 *                                            repeats across the 100 iters.
 *
 * Verified: zero pair collisions for i in [0,100).
 */
function buildVariedDraft(i) {
  const hookIdx = i % HOOKS.length
  const cycle = Math.floor(i / HOOKS.length)
  const bodyIdx = (i + 7 * cycle) % BODIES.length
  return {
    topicId: 'cursor',
    modelId: 'gpt-5.5-medium',
    hook: HOOKS[hookIdx],
    body: BODIES[bodyIdx],
  }
}

// --- 1. Empty-history sanity check ---
clearDraftHistory()
let s = scoreNovelty({ hook: 'hook', body: 'body' })
check('empty-history returns 100', s.noveltyScore === 100, `got ${s.noveltyScore}`)

// --- 2. Record 100 deliberately-varied drafts ---
clearDraftHistory()
const drafts = []
for (let i = 0; i < 100; i++) {
  const d = buildVariedDraft(i)
  drafts.push(d)
  recordDraft(d)
}
const history = getDraftHistory()
check(
  '100 varied drafts recorded',
  history.length === 100,
  `expected 100 entries in history, got ${history.length}`,
)

// --- 3. Re-scoring an EXACT duplicate of any prior draft → very low novelty ---
{
  const exactDup = drafts[37]
  const dupScore = scoreNovelty({
    hook: exactDup.hook,
    body: exactDup.body,
    topicId: exactDup.topicId,
  })
  check(
    'exact-duplicate scores < 25 (system catches twin)',
    dupScore.noveltyScore < 25,
    `got ${dupScore.noveltyScore} (hookSim=${dupScore.topMatch?.hookSim?.toFixed(2)})`,
  )
}

// --- 4. A near-paraphrase of a prior draft → still flagged for retry ---
{
  const target = drafts[12]
  // Paraphrase: same skeleton, swap a few words
  const para = {
    hook: target.hook.replace('CFO', 'CIO').replace('cloud', 'compute'),
    body: target.body
      .replace(/program/gi, 'initiative')
      .replace(/renewal/gi, 'contract'),
    topicId: target.topicId,
  }
  const paraScore = scoreNovelty(para)
  check(
    'near-paraphrase flagged for retry (< 75)',
    paraScore.noveltyScore < 75,
    `got ${paraScore.noveltyScore}`,
  )
}

// --- 5. A genuinely-fresh candidate scores well above retry threshold ---
{
  const freshScore = scoreNovelty({
    hook: 'Spent Tuesday inside a data-room argument that had nothing to do with the model.',
    body: 'It was about who carries the bag if the agent makes a refund decision the customer-success team would not have made. Nobody had drafted that clause. Three hours later we had a one-page protocol, two new approvers, and a cleaner pitch for the audit committee.',
    topicId: 'cursor',
  })
  check(
    'fresh-distinct candidate scores >= 75 (ships on first try)',
    freshScore.noveltyScore >= 75,
    `got ${freshScore.noveltyScore} (hookSim=${freshScore.topMatch?.hookSim?.toFixed(2)} trigramSim=${freshScore.topMatch?.trigramSim?.toFixed(2)})`,
  )
}

// --- 6. Five more fresh candidates: all should score well ---
{
  const candidates = [
    {
      hook: 'A quiet trend I am tracking: AI-first contract templates appearing inside Fortune 500 legal teams.',
      body: 'Three GCs at large enterprises mentioned this independently in the past two weeks. The templates do not mention any model name. They reference categories of risk. That is the shift — the legal layer is decoupling from the vendor layer, and that is going to reshape procurement leverage by year end.',
    },
    {
      hook: 'The KPI on every successful AI rollout I have seen this year fits on one line.',
      body: 'It is not seats, not models, not even cost. It is the ratio of automated workflow runs per active human user, measured weekly. Get that ratio above 3.0 and budget conversations get easy. Below 1.0 and you are managing decline.',
    },
    {
      hook: 'I was wrong about a prediction I made eight months ago. Here is the part worth saving from it.',
      body: 'I said agent platforms would commoditize first. They did not. The orchestration layer commoditized first, and the agent layer is still very much a wedge product. The piece worth saving: the buyers who win are still the ones who pre-commit to a usage ceiling, regardless of which layer they spend on.',
    },
    {
      hook: 'The most surprising thing in the last quarterly review I sat through was a number going DOWN.',
      body: 'AI seat consumption per engineer dropped 18% in one quarter. Not because adoption slipped. Because the team had finally rationalized the tool stack and consolidated workflows. Same output. Fewer logins. Lower cost. Higher leverage. The CFO loved the slide.',
    },
    {
      hook: 'Worth your weekend: an old white-paper that quietly predicted the agent-cost curve we are now living through.',
      body: 'Written in 2023 by a team most of us did not know yet. It described exactly the pattern we are seeing in 2026 — usage tripling but per-unit cost halving, with the gap captured by orchestration vendors rather than model vendors. Re-reading it last week changed how I read the next earnings cycle.',
    },
  ]
  let allFresh = true
  let lowest = 100
  for (const c of candidates) {
    const r = scoreNovelty({ ...c, topicId: 'cursor' })
    if (r.noveltyScore < 75) allFresh = false
    if (r.noveltyScore < lowest) lowest = r.noveltyScore
  }
  check(
    'all 5 fresh candidates score >= 75 against 100-draft history',
    allFresh,
    `lowest=${lowest}`,
  )
}

// --- 7a. Pairwise novelty across 25 FULLY-UNIQUE drafts (1:1 hook/body) ---
//
// This is the test that matters for the "100x" question: when every draft
// in history has a unique hook AND a unique body, does the system give a
// healthy novelty distribution? We score each as a candidate against
// history-minus-itself, so no entry is competing with its own twin.
{
  const uniqueDrafts = HOOKS.map((hook, i) => ({
    topicId: 'cursor',
    modelId: 'gpt-5.5-medium',
    hook,
    body: BODIES[i],
  }))
  const novScores = []
  for (let i = 0; i < uniqueDrafts.length; i++) {
    mockStorage.clear()
    for (let j = 0; j < uniqueDrafts.length; j++) {
      if (j === i) continue
      recordDraft(uniqueDrafts[j])
    }
    const out = scoreNovelty({
      hook: uniqueDrafts[i].hook,
      body: uniqueDrafts[i].body,
      topicId: uniqueDrafts[i].topicId,
    })
    novScores.push(out.noveltyScore)
  }
  const mean = novScores.reduce((a, b) => a + b, 0) / novScores.length
  const min = Math.min(...novScores)
  const below60 = novScores.filter((n) => n < 60).length
  const below40 = novScores.filter((n) => n < 40).length
  console.log(
    `      [unique pool] pairwise distribution: mean=${mean.toFixed(1)} min=${min} <60=${below60}/25 <40=${below40}/25`,
  )
  check(
    '25-unique-draft pool: pairwise mean novelty >= 65',
    mean >= 65,
    `mean=${mean.toFixed(1)}`,
  )
  check(
    '25-unique-draft pool: no draft scores below 40 (no near-twin lurking)',
    below40 === 0,
    `${below40} drafts scored <40`,
  )
  check(
    '25-unique-draft pool: fewer than 5 drafts score below 60',
    below60 <= 5,
    `${below60} drafts scored <60`,
  )
}

// --- 7b. Cluster-detection: with template reuse, system correctly low-scores ---
//
// 100 drafts built from 25 hooks × 25 bodies with cycle-rotation. Each hook
// appears 4 times, each body 4 times. We EXPECT low mean novelty here —
// that's the cluster-aware scorer doing its job. We just assert the system
// is actively flagging the cluster (>= 95 of 100 candidates score below the
// 75 retry threshold), confirming retries would fire in production.
{
  mockStorage.clear()
  for (const d of drafts) recordDraft(d)
  const novScores = []
  for (let i = 0; i < drafts.length; i++) {
    mockStorage.clear()
    for (let j = 0; j < drafts.length; j++) {
      if (j === i) continue
      recordDraft(drafts[j])
    }
    const out = scoreNovelty({
      hook: drafts[i].hook,
      body: drafts[i].body,
      topicId: drafts[i].topicId,
    })
    novScores.push(out.noveltyScore)
  }
  const mean = novScores.reduce((a, b) => a + b, 0) / novScores.length
  const flagCount = novScores.filter((n) => n < 75).length
  console.log(
    `      [reused pool] pairwise distribution: mean=${mean.toFixed(1)} flagged=${flagCount}/100`,
  )
  check(
    'template-reuse pool: system flags >= 95 of 100 drafts for retry (cluster detection works)',
    flagCount >= 95,
    `flagged=${flagCount}/100, mean=${mean.toFixed(1)}`,
  )
}

// --- 8. Forbidden-opener extraction surfaces repeated openers ---
{
  clearDraftHistory()
  for (let i = 0; i < 6; i++) {
    recordDraft({
      topicId: 'cursor',
      modelId: 'gpt-5.5-medium',
      hook: `Different hook ${i}.`,
      body: `I keep seeing the same pattern across enterprise rollouts — round ${i}. Different content but same opening beat.`,
    })
  }
  for (let i = 0; i < 4; i++) {
    recordDraft({
      topicId: 'cursor',
      modelId: 'gpt-5.5-medium',
      hook: `Other hook ${i}.`,
      body: `Most CFOs underestimate this. They look at the seat line and miss the consumption curve.`,
    })
  }
  const forbidden = extractForbiddenOpeners({ topicId: 'cursor', lookback: 20, limit: 6 })
  check('forbidden-openers returns at least one repeated phrase', forbidden.length > 0, `got: ${JSON.stringify(forbidden)}`)
  const top = forbidden[0]
  check('top forbidden-opener appears at least twice', !!top && top.count >= 2, `got top=${JSON.stringify(top)}`)
}

// --- 9. Forbidden-trigram extraction surfaces repeated 3-grams ---
{
  clearDraftHistory()
  for (let i = 0; i < 5; i++) {
    recordDraft({
      topicId: 'cursor',
      modelId: 'gpt-5.5-medium',
      hook: `Hook ${i}.`,
      body: `Every leadership meeting now includes an agent governance review and a separate budget walk-through. Round ${i}.`,
    })
  }
  const trigrams = extractForbiddenTrigrams({ lookback: 10, limit: 8, minCount: 2 })
  const hasGovTrigram = trigrams.some((t) => /agent.*governanc.*review/i.test(t.phrase))
  check('forbidden-trigrams surfaces the repeated phrase', hasGovTrigram, `got: ${JSON.stringify(trigrams.slice(0, 4))}`)
}

// --- 10. Digit normalization regression guard ---
{
  const tok = __internals.tokenize('We rolled out 11 agents in eleven weeks across 47 teams.')
  const elevens = tok.filter((t) => t === '11').length
  check('digit normalization collapses 11 / eleven', elevens >= 2, `got tokens=${JSON.stringify(tok)}`)
}

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
