/**
 * Regression harness for the meta-label scrubber.
 *
 * The phrase "composite scene" was bleeding into user-facing copy because the
 * reach-lift pipeline appended it as a literal hedge. Even with that path
 * fixed, we keep this harness so any future regression that re-introduces
 * meta-labels gets caught here.
 */

const { applyIcpCritique } = await import('../src/utils/icpCritique.js')

const cases = [
  {
    name: 'parenthetical at end',
    input: { hook: 'A VP of Eng ran 4 AI tools across 30 devs.', body: 'They flipped to one. (a VP of Engineering put it bluntly on Friday, composite scene.)', cta: 'What would you change?', hashtags: '' },
    expectBodyContains: 'a VP of Engineering put it bluntly on Friday',
    expectBodyMissing: 'composite',
  },
  {
    name: 'standalone composite scene',
    input: { hook: 'Hook', body: 'A VP told me this. (composite scene.)', cta: 'q?', hashtags: '' },
    expectBodyMissing: 'composite',
  },
  {
    name: 'em-dash with composite',
    input: { hook: 'Hook', body: 'A VP told me this. (composite scene — a VP Eng told me last week.)', cta: 'q?', hashtags: '' },
    expectBodyContains: 'a VP Eng told me last week',
    expectBodyMissing: 'composite',
  },
  {
    name: 'naked label leading sentence',
    input: { hook: 'Hook', body: 'Composite scene: A VP of Eng walked me through it.', cta: 'q?', hashtags: '' },
    expectBodyContains: 'A VP of Eng walked me through it',
    expectBodyMissing: 'Composite',
  },
  {
    name: 'anonymized label',
    input: { hook: 'Hook', body: 'They moved fast. (anonymized scene.)', cta: 'q?', hashtags: '' },
    expectBodyMissing: 'anonymized',
  },
  {
    name: 'no meta label, untouched',
    input: { hook: 'A real hook.', body: 'A CIO told me on Friday: they cut tools by half.', cta: 'q?', hashtags: '' },
    expectBodyContains: 'A CIO told me on Friday',
  },
  {
    name: 'leak in hook',
    input: { hook: 'A VP of Eng ran 4 AI tools (composite scene).', body: 'Body content.', cta: 'q?', hashtags: '' },
    expectHookMissing: 'composite',
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const out = applyIcpCritique(c.input)
  const body = out.body || ''
  const hook = out.hook || ''
  let ok = true
  let detail = ''
  if (c.expectBodyContains && !body.includes(c.expectBodyContains)) {
    ok = false
    detail += `\n    body missing expected fragment "${c.expectBodyContains}"\n    got: ${JSON.stringify(body)}`
  }
  if (c.expectBodyMissing && new RegExp(c.expectBodyMissing, 'i').test(body)) {
    ok = false
    detail += `\n    body still contains forbidden "${c.expectBodyMissing}"\n    got: ${JSON.stringify(body)}`
  }
  if (c.expectHookMissing && new RegExp(c.expectHookMissing, 'i').test(hook)) {
    ok = false
    detail += `\n    hook still contains forbidden "${c.expectHookMissing}"\n    got: ${JSON.stringify(hook)}`
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
