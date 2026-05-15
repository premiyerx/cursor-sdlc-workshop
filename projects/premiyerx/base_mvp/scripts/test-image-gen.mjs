/**
 * Stress-test LinkedIn infographic image generation 10 times.
 * Usage: OPENAI_API_KEY=sk-... node scripts/test-image-gen.mjs
 * Optional: API_BASE=https://basemvp.vercel.app (tests live proxy)
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RUNS = 10
const TOPICS = ['cursor', 'investment', 'cio', 'roi']

function loadEnvKey() {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim()
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return ''
  const text = readFileSync(envPath, 'utf8')
  const match = text.match(/^OPENAI_API_KEY=(.+)$/m)
  return match?.[1]?.trim() || ''
}

const LAYOUTS = [
  'hero stat blocks, donut charts, icon row',
  'split VS panels, circles with percentages',
  'stacked modules, mixed chart types',
  'icon grid, ring chart, chevron flow',
]

const PALETTES = [
  'black background, white type, green accents',
  'charcoal background, off-white type, green and gold accents',
  'navy background, white headlines, green and blue accents',
]

function buildPrompt(seed, topic) {
  const layout = LAYOUTS[seed % LAYOUTS.length]
  const palette = PALETTES[seed % PALETTES.length]
  return [
    `Create a premium LinkedIn landscape infographic, wide 16:9 format.`,
    `Layout: ${layout}. Colors: ${palette}.`,
    `Topic: ${topic}. Theme: AI software transformation leadership.`,
    `Use donut charts, icon rows, pictographs, modular sections.`,
    `No plain bar chart. Dark editorial design.`,
    `Footer: Prem Iyer · AI Software Transformation · variation v${seed.toString(16)}.`,
  ].join('\n')
}

function buildBody(model, prompt, size, quality, style) {
  if (model.startsWith('gpt-image')) {
    return {
      model,
      prompt,
      n: 1,
      size,
      quality: quality || 'medium',
      output_format: 'png',
      moderation: 'low',
    }
  }
  const body = {
    model: 'dall-e-3',
    prompt: prompt.slice(0, 4000),
    n: 1,
    size,
    quality: quality || 'standard',
    response_format: 'b64_json',
  }
  if (style) body.style = style
  return body
}

async function generateOnce({ apiKey, seed, topic, useProxy, apiBase }) {
  const prompt = buildPrompt(seed, topic)
  const attempts = [
    { model: 'gpt-image-1.5', size: '1536x1024', quality: 'medium' },
    { model: 'gpt-image-1', size: '1536x1024', quality: 'medium' },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', style: 'vivid' },
  ]

  const errors = []
  for (const cfg of attempts) {
    const started = Date.now()
    try {
      let b64 = null
      let usedModel = cfg.model
      let via = 'direct'

      if (useProxy) {
        const res = await fetch(`${apiBase}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, prompt, ...cfg }),
        })
        const data = await res.json().catch(() => ({}))
        if (data.ok && data.b64) {
          b64 = data.b64
          usedModel = data.model || cfg.model
          via = 'proxy'
        } else {
          errors.push(`[proxy ${cfg.model}] ${data.error || res.status}`)
          continue
        }
      } else {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(buildBody(cfg.model, prompt, cfg.size, cfg.quality, cfg.style)),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          errors.push(`[${cfg.model}] ${data.error?.message || res.status}`)
          continue
        }
        b64 = data.data?.[0]?.b64_json
        if (!b64) {
          errors.push(`[${cfg.model}] no b64 data`)
          continue
        }
      }

      const hash = createHash('sha256').update(b64).digest('hex').slice(0, 12)
      return {
        ok: true,
        seed,
        topic,
        model: usedModel,
        via,
        hash,
        bytes: b64.length,
        ms: Date.now() - started,
        errors,
      }
    } catch (err) {
      errors.push(`[${cfg.model}] ${err.message}`)
    }
  }

  return { ok: false, seed, topic, errors }
}

async function main() {
  const apiKey = loadEnvKey()
  const apiBase = (process.env.API_BASE || '').replace(/\/$/, '')
  const useProxy = !!apiBase

  if (!apiKey) {
    console.error('ERROR: Set OPENAI_API_KEY to run the 10x image stress test.')
    console.error('Example: OPENAI_API_KEY=sk-... node scripts/test-image-gen.mjs')
    process.exit(1)
  }

  console.log(`Running ${RUNS} image generations (${useProxy ? `proxy @ ${apiBase}` : 'direct OpenAI'})...\n`)

  const results = []
  const hashes = new Set()

  for (let i = 0; i < RUNS; i++) {
    const seed = (Date.now() + i * 9973) >>> 0
    const topic = TOPICS[i % TOPICS.length]
    process.stdout.write(`Run ${i + 1}/${RUNS} (${topic}, seed ${seed.toString(16)})... `)
    const result = await generateOnce({ apiKey, seed, topic, useProxy, apiBase })
    results.push(result)

    if (result.ok) {
      const dup = hashes.has(result.hash)
      hashes.add(result.hash)
      console.log(`OK  ${result.model} via ${result.via}  ${result.ms}ms  hash=${result.hash}${dup ? '  DUPLICATE!' : ''}`)
    } else {
      console.log('FAIL')
      for (const e of result.errors.slice(-3)) console.log(`       ${e}`)
    }

    if (i < RUNS - 1) await new Promise((r) => setTimeout(r, 1500))
  }

  const passed = results.filter((r) => r.ok).length
  const unique = hashes.size
  console.log(`\n--- Summary ---`)
  console.log(`Passed: ${passed}/${RUNS}`)
  console.log(`Unique images: ${unique}/${passed}`)
  console.log(passed === RUNS && unique === passed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED')
  process.exit(passed === RUNS ? 0 : 1)
}

main()
