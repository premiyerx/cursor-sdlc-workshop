/**
 * Coherence harness for icpCritique.{dropFillerAndOrphanLines, scoreBodyCoherence}.
 *
 * Anchored to the real failure case the user reported:
 *
 *   HOOK: "A staff engineer deleted 4 AI editors in one sprint."
 *   BODY: "Two Fortune 500 calls, 48 hours apart.
 *          Two things can be true at once.
 *          Wild.
 *          Same complaint both times."
 *
 * The body is fragmentary one-liners with no connecting tissue. The
 * coherence pass should:
 *  - drop "Two things can be true at once." (AI cliché filler)
 *  - drop "Wild." (one-word AI tic)
 *  - drop "Same complaint both times." (orphan anaphora — no "complaint"
 *    was ever stated)
 *  - keep the concrete setup "Two Fortune 500 calls, 48 hours apart."
 *    (even though it's a fragment, it has a number + concrete subject)
 *
 * Verifies that:
 *  1. Standalone filler exclamations are removed.
 *  2. Orphan anaphora is removed when antecedent absent.
 *  3. Anaphora with proper antecedent is preserved.
 *  4. Lines containing the same word inside a longer sentence are kept.
 *  5. scoreBodyCoherence returns low for the broken case, high for clean.
 */

const {
  applyIcpCritique,
  dropFillerAndOrphanLines,
  scoreBodyCoherence,
  scoreCoherencePenalty,
} = await import('../src/utils/icpCritique.js')

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

// --- 1. The exact failure case the user reported ---
{
  const brokenBody =
    'Two Fortune 500 calls, 48 hours apart.\n\nTwo things can be true at once.\n\nWild.\n\nSame complaint both times.'
  const cleaned = dropFillerAndOrphanLines(brokenBody)
  check(
    'drops "Wild." one-liner',
    !/^Wild\.?$/m.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
  check(
    'drops "Two things can be true at once."',
    !/Two things can be true at once/i.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
  check(
    'drops orphan "Same complaint both times."',
    !/Same complaint both times/i.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
  check(
    'keeps concrete fragment "Two Fortune 500 calls"',
    /Two Fortune 500 calls/.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
}

// --- 2. Other AI-filler one-liners get stripped ---
{
  const samples = [
    'Brutal.',
    'Real.',
    'Truth.',
    'Make it make sense.',
    'Read that again.',
    'Let that sink in.',
    'Big if true.',
    'Same.',
    'Both.',
    'This.',
    'I\'ll wait.',
    'Tell me I\'m wrong.',
  ]
  for (const s of samples) {
    const body = `A CFO walked me through the budget review.\n\n${s}\n\nThe room paused before agreeing.`
    const cleaned = dropFillerAndOrphanLines(body)
    check(
      `drops standalone "${s}"`,
      !new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'mi').test(cleaned),
      `cleaned=${JSON.stringify(cleaned)}`,
    )
  }
}

// --- 3. Orphan anaphora WITH antecedent is preserved ---
{
  const body = 'I joined two Fortune 500 review calls this week. Each one raised the same renewal complaint.\n\nSame complaint both times.'
  const cleaned = dropFillerAndOrphanLines(body)
  check(
    'keeps "Same complaint both times" when "complaint" was mentioned above',
    /Same complaint both times/i.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
}

// --- 4. "Wild" inside a longer sentence is preserved ---
{
  const body = 'It was a wild ride for the team this quarter.\n\nThey rebuilt the stack twice.'
  const cleaned = dropFillerAndOrphanLines(body)
  check(
    'keeps "wild" inside a longer sentence',
    /wild ride/.test(cleaned),
    `cleaned=${JSON.stringify(cleaned)}`,
  )
}

// --- 5. Coherence score is LOW for the broken case ---
{
  const brokenBody =
    'Two Fortune 500 calls, 48 hours apart.\n\nTwo things can be true at once.\n\nWild.\n\nSame complaint both times.'
  const score = scoreBodyCoherence(brokenBody)
  check(
    'broken body scores < 60 coherence',
    score < 60,
    `score=${score}`,
  )
  const penalty = scoreCoherencePenalty(brokenBody)
  check(
    'broken body triggers coherence penalty > 5',
    penalty > 5,
    `penalty=${penalty}`,
  )
}

// --- 6. Coherence score is HIGH for a clean body ---
{
  const cleanBody =
    'I joined two Fortune 500 calls in 48 hours. Both teams asked the same renewal question, and neither was satisfied with the answer the vendor gave.\n\nThe sticking point was inference cost ownership across product lines. One CIO said she would not sign without a per-workload cap. The other wanted a hard ceiling tied to seat count.\n\nBoth ended the call asking for the same thing: a single line on the bill they could defend in front of finance.'
  const score = scoreBodyCoherence(cleanBody)
  check(
    'clean body scores >= 80 coherence',
    score >= 80,
    `score=${score}`,
  )
  const penalty = scoreCoherencePenalty(cleanBody)
  check(
    'clean body has zero coherence penalty',
    penalty === 0,
    `penalty=${penalty}`,
  )
}

// --- 7. applyIcpCritique repairs the full failing post end-to-end ---
{
  const post = {
    hook: 'A staff engineer deleted 4 AI editors in one sprint.',
    body: 'Two Fortune 500 calls, 48 hours apart.\n\nTwo things can be true at once.\n\nWild.\n\nSame complaint both times.',
    cta: 'What would you do here?',
    hashtags: '',
    firstComment: '',
  }
  const out = applyIcpCritique(post)
  check(
    'end-to-end: post body no longer contains "Wild."',
    !/^Wild\.?$/m.test(out.body || ''),
    `body=${JSON.stringify(out.body)}`,
  )
  check(
    'end-to-end: hook is preserved',
    out.hook === post.hook,
    `hook=${JSON.stringify(out.hook)}`,
  )
}

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
