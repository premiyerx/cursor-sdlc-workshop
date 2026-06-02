/**
 * Quick sanity harness for draftHistory.scoreNovelty.
 *
 * Verifies:
 *  - Identical drafts score near 0 novelty (≥ 90% similar)
 *  - Same-topic paraphrase scores low novelty (≥ 60% similar)
 *  - Different-topic drafts score high novelty (≥ 80 fresh)
 *  - Empty history returns 100 novelty
 *
 * Run with: npm run test:novelty
 */
const mockStorage = new Map()
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) ?? null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
}

const { recordDraft, scoreNovelty, clearDraftHistory } = await import(
  '../src/utils/draftHistory.js'
)

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

// 1) empty history → 100 novelty
clearDraftHistory()
let s = scoreNovelty({ hook: 'New hook', body: 'New body content' })
check('empty-history returns 100', s.noveltyScore === 100, `got ${s.noveltyScore}`)

// 2) identical draft → very low novelty
clearDraftHistory()
recordDraft({
  topicId: 'cursor',
  modelId: 'gpt-5.5-medium',
  hook: 'I watched a 47-engineer team rip out Copilot in 11 days.',
  body:
    'They moved to Cursor not because it was hyped, but because it covered the full SDLC. Real codebase awareness, model choice, faster runs.',
})
s = scoreNovelty({
  hook: 'I watched a 47-engineer team rip out Copilot in 11 days.',
  body:
    'They moved to Cursor not because it was hyped, but because it covered the full SDLC. Real codebase awareness, model choice, faster runs.',
  topicId: 'cursor',
})
check('identical-draft novelty < 20', s.noveltyScore < 20, `got ${s.noveltyScore}`)

// 3) near-paraphrase, same topic → low novelty
s = scoreNovelty({
  hook: 'A 47-engineer team I work with ripped Copilot out in eleven days.',
  body:
    'They switched to Cursor because it covers the full SDLC — codebase-wide reasoning, model choice, and faster runs than narrow copilots.',
  topicId: 'cursor',
})
check('paraphrase novelty < 60', s.noveltyScore < 60, `got ${s.noveltyScore}`)

// 4) totally different topic + hook → high novelty
s = scoreNovelty({
  hook: 'The CFO asked me if shadow AI was a real budget line.',
  body:
    "Half our procurement was happening outside IT — engineers paying for tools on personal credit cards. The number was bigger than the official seat count.",
  topicId: 'enterprise',
})
check('different-topic novelty >= 75', s.noveltyScore >= 75, `got ${s.noveltyScore}`)

// 5) same hook, totally different body → mid-to-low novelty (hook is weighted)
s = scoreNovelty({
  hook: 'I watched a 47-engineer team rip out Copilot in 11 days.',
  body: "And I won't bore you with what came next. Three things to know first.",
  topicId: 'cursor',
})
check('same-hook diff-body novelty < 70', s.noveltyScore < 70, `got ${s.noveltyScore}`)

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
