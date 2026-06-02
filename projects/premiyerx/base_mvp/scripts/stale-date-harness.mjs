/**
 * Regression harness for scrubStaleDateRefs in icpCritique.js.
 *
 * Anchored to a synthetic "now" of June 2, 2026 so cases stay deterministic
 * regardless of when the harness is run. Verifies:
 *   1. Old explicit-date references ("Apr 9 Hacker News post") get rewritten.
 *   2. Fresh dates (within the 14-day window) are preserved.
 *   3. Dates with no qualifier still get hedged.
 *   4. Sentences that don't contain calendar dates pass through untouched.
 */

const { scrubStaleDateRefs } = await import('../src/utils/icpCritique.js')

const now = new Date('2026-06-02T12:00:00Z')

const cases = [
  {
    name: 'Apr 9 Hacker News post is rewritten to recent reporting',
    input: 'I keep coming back to the Apr 9 Hacker News post on agent costs.',
    expectContains: 'recent reporting',
    expectMissing: /Apr\s*9/i,
  },
  {
    name: 'March 22 article is rewritten',
    input: 'There was a March 22 article that nailed it.',
    expectContains: 'recent reporting',
    expectMissing: /March\s*22/i,
  },
  {
    name: 'Apr 9 on its own becomes recently',
    input: 'Apr 9 is when this story broke for me.',
    expectContains: 'recently',
    expectMissing: /Apr\s*9/i,
  },
  {
    name: 'May 28 (fresh, within 14d of June 2) is preserved',
    input: 'The May 28 announcement still shapes how I see this.',
    expectContains: 'May 28',
  },
  {
    name: 'May 22 (~11 days back) is preserved',
    input: 'We discussed the May 22 thread in standup yesterday.',
    expectContains: 'May 22',
  },
  {
    name: 'May 1 (~32 days back) gets scrubbed',
    input: 'The May 1 piece on inference costs is the anchor.',
    expectContains: 'recent reporting',
    expectMissing: /May\s*1\b/i,
  },
  {
    name: 'no date phrase is untouched',
    input: 'A VP of Engineering told me this week the budget is locked.',
    expectContains: 'A VP of Engineering told me this week',
  },
  {
    name: 'explicit year is honored — Apr 9 2025 is stale',
    input: 'Way back in Apr 9, 2025 the framing was different.',
    expectMissing: /Apr\s*9,?\s*2025/i,
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const out = scrubStaleDateRefs(c.input, { now, staleDays: 14 })
  let ok = true
  let detail = ''
  if (c.expectContains && !out.includes(c.expectContains)) {
    ok = false
    detail += `\n    missing expected "${c.expectContains}"\n    got: ${JSON.stringify(out)}`
  }
  if (c.expectMissing && c.expectMissing.test(out)) {
    ok = false
    detail += `\n    still contains forbidden ${c.expectMissing}\n    got: ${JSON.stringify(out)}`
  }
  if (ok) {
    pass++
    console.log(`PASS  ${c.name}`)
  } else {
    fail++
    console.log(`FAIL  ${c.name}${detail}`)
  }
}

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
