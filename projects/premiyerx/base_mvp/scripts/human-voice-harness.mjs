/**
 * Human-voice harness.
 *
 * Anchored to the real before/after the user gave us:
 *   - BAD  = emoji bullets + bold labels + numbered list + a rhetorical
 *            question after every point ("📊 Three insights… 1️⃣ **X** → But…?").
 *   - GOOD = a colleague's rewrite: concede-then-complicate, plain undecorated
 *            data lines, a personal reaction to one number, one reframe, and a
 *            single genuinely curious closing question.
 *
 * We can't unit-test "sounds human" directly, but we CAN lock the structural
 * incentives that were pushing the model toward the robotic shape:
 *   1. The scorer must NOT reward emojis over plain text.
 *   2. Clean plain data lines must score on visualStructure at parity with a
 *      numbered "1. 2. 3." framework (so the editor doesn't re-deck the post).
 *   3. The colleague-style post must score a healthy reach.
 *   4. The "honest-take" structure template must exist in rotation with the
 *      right anti-pattern guardrails.
 */

const { SCORING_RULES, scorePost } = await import('../src/data/algorithmRules.js')
const { STRUCTURE_TEMPLATES } = await import('../src/utils/postStructureTemplates.js')

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

const visualStructure = SCORING_RULES.find((r) => r.id === 'visualStructure')
const dwellTime = SCORING_RULES.find((r) => r.id === 'dwellTime')

// --- Fixtures -------------------------------------------------------------

// Plain data lines, no decoration (the human shape).
const cleanDataBody = `AI cutting dev cycle time by 40% sounds like a win. And in some ways it is.

But I keep hearing the same thing from teams actually using these tools.

A few numbers worth sitting with:

Time-to-ship is down 30-40% for teams using AI dev tools (DORA, 2025)

Cost savings run about $37K per developer seat annually (Forrester, 2025)

Payback on AI tooling is roughly 6 weeks

That last one surprised me. Six weeks is fast, almost too fast for most procurement cycles to keep up with.`

// Same proof, robotic shape: emojis + bold + numbered + rhetorical-Q per item.
const emojiNumberedBody = `📊 Three insights from the field this week:

1. **Time-to-ship** is reduced by 30-40% (DORA, 2025). But are teams ready?

2. **Cost savings** average $37K per seat (Forrester, 2025). Yet how many account for retraining?

3. A surprising 6-week payback period (Forrester, 2025). Does your process capture that?

💡 The numbers speak volumes.`

// --- 1. Emojis must not be rewarded over plain text ----------------------
{
  const cleanScore = visualStructure.evaluate(cleanDataBody)
  const emojiScore = visualStructure.evaluate(emojiNumberedBody)
  check(
    'visualStructure does NOT reward the emoji/numbered version over clean prose',
    cleanScore >= emojiScore,
    `clean=${cleanScore} emoji=${emojiScore}`,
  )
}

// --- 2. Plain data lines reach parity with a numbered framework ----------
{
  const numberedBody = `Here is what changed this quarter.

1. Time-to-ship dropped 35% (DORA, 2025).

2. Cost per seat fell $37K (Forrester, 2025).

3. Payback hit 6 weeks (Forrester, 2025).`

  const plainBody = `Here is what changed this quarter.

Time-to-ship dropped 35% (DORA, 2025).

Cost per seat fell $37K (Forrester, 2025).

Payback hit 6 weeks (Forrester, 2025).`

  const numberedScore = visualStructure.evaluate(numberedBody)
  const plainScore = visualStructure.evaluate(plainBody)
  check(
    'visualStructure scores clean plain data lines at parity with numbered list',
    plainScore >= numberedScore,
    `plain=${plainScore} numbered=${numberedScore}`,
  )

  const numberedDwell = dwellTime.evaluate(numberedBody)
  const plainDwell = dwellTime.evaluate(plainBody)
  check(
    'dwellTime does not punish clean prose vs a numbered framework',
    plainDwell >= numberedDwell - 4,
    `plainDwell=${plainDwell} numberedDwell=${numberedDwell}`,
  )
}

// --- 3. A zero-emoji body scores higher than the same body with emojis ----
{
  const zero = `Time-to-ship dropped 35% (DORA, 2025).

Cost per seat fell $37K (Forrester, 2025).

Payback hit 6 weeks.`
  const withEmoji = `📊 Time-to-ship dropped 35% (DORA, 2025). 💡

🚀 Cost per seat fell $37K (Forrester, 2025). 🔥

📈 Payback hit 6 weeks. ⚡`
  const zeroScore = visualStructure.evaluate(zero)
  const emojiScore = visualStructure.evaluate(withEmoji)
  check(
    'zero-emoji body scores strictly higher than the emoji-laden version',
    zeroScore > emojiScore,
    `zero=${zeroScore} emoji=${emojiScore}`,
  )
}

// --- 4. The colleague-style full post scores a healthy reach -------------
{
  const fullPost = `${cleanDataBody}

The harder question isn't whether AI speeds things up. It's whether your team is set up to handle shipping faster without quality quietly slipping.

Curious what's been true for your org. Did AI adoption come from the top down, or did engineers just start using it and force the conversation?

#SDLC #AIDevTools #SoftwareDevelopment`
  const { total } = scorePost(fullPost)
  check(
    'colleague-style post scores a healthy reach (>= 70)',
    total >= 70,
    `total=${total}`,
  )
}

// --- 5. honest-take template exists with the right guardrails ------------
{
  const honest = STRUCTURE_TEMPLATES.find((t) => t.id === 'honest-take')
  check('honest-take structure template exists', !!honest, 'not found')
  if (honest) {
    const avoid = (honest.avoid || []).join(' | ').toLowerCase()
    check(
      'honest-take avoids numbered lists',
      /numbered list/.test(avoid),
      `avoid=${avoid}`,
    )
    check(
      'honest-take avoids a rhetorical question after every data point',
      /rhetorical question after/.test(avoid),
      `avoid=${avoid}`,
    )
    const rules = (honest.rules || []).join(' ').toLowerCase()
    check(
      'honest-take rules teach concede-then-complicate',
      /concede|sounds like a win/.test(rules),
      'missing concession move',
    )
  }
}

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
