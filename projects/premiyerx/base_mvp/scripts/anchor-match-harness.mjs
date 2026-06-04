import { anchorIsReflected, anchorReflection } from '../src/utils/personalAnchorMatch.js'

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass += 1
    console.log(`PASS  ${name}`)
  } else {
    fail += 1
    console.log(`FAIL  ${name}`)
  }
}

const anchor =
  'Global Head of AI of Fortune 250 company focused the entire conversation around tool sprawl and the need for consolidation, cost cutting due to having so many tools, and how she could reduce costs and increase productivity by bringing all her SDLC components together under Cursor.'

// The three real drafts from the screenshot — none reference the anchor.
const draftReopenedTickets =
  'A COO showed me 47 reopened tickets last week. Hours saved looks clean in a QBR. It is also the easiest number to fake. Turns out the deck does not say the part that actually matters. He asked why a successful AI pilot still felt soft. We threw out hours saved and looked at what finance actually rewards. Cycle time held up. PR-to-prod compression shows revenue earlier, not faster typing.'
const draftMergeFreq =
  'A VP of Engineering saw merge frequency jump 42 percent. More code hitting legacy infrastructure meant a wider blast radius. The CFO marked the page during the Q2 review. The board deck showed green while the team burned out. We paused their rollout to audit the actual revert rate.'
const draftSeats =
  '350 seats renewed. The CFO still circled one line. He did not dislike AI dev tools. He disliked orphan metrics. Faster sounded good. Did happier engineers. When your CFO reviews engineering spend, which earns trust faster: cycle time improvement or production releases by product line?'

// A draft that DID weave the anchor in.
const draftWithAnchor =
  'A Global Head of AI at a Fortune 250 told me her real problem was not model choice. It was tool sprawl. Eleven overlapping tools, and the consolidation case wrote itself: cut cost, lift productivity by bringing the SDLC under one roof.'

check('extracts keywords from rich anchor', anchorReflection(anchor, '').total >= 5)
check('flags reopened-tickets draft as NOT reflecting anchor', !anchorIsReflected(anchor, draftReopenedTickets))
check('flags merge-frequency draft as NOT reflecting anchor', !anchorIsReflected(anchor, draftMergeFreq))
check('flags seats draft as NOT reflecting anchor', !anchorIsReflected(anchor, draftSeats))
check('accepts a draft that wove the anchor in', anchorIsReflected(anchor, draftWithAnchor))
check('empty anchor is always considered reflected', anchorIsReflected('', draftSeats))

const shortAnchor = 'We expanded one pilot from 30 to 400 seats in six weeks.'
check('short anchor: matching draft reflects', anchorIsReflected(shortAnchor, 'We took one pilot to 400 seats fast.'))
check(
  'short anchor: unrelated draft does not reflect',
  !anchorIsReflected(shortAnchor, 'A CISO worried about SOC2 evidence on Thursday.'),
)

console.log(`\nPassed ${pass} / ${pass + fail}`)
process.exit(fail === 0 ? 0 : 1)
