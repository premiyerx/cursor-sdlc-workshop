/**
 * Smoke-test the three compare LLMs (OpenAI, Anthropic, Gemini) via generateRawCompletion.
 * In Node, Anthropic uses the direct API URL (see llmPostClient anthropicMessagesUrl).
 *
 * Usage (from projects/premiyerx/base_mvp):
 *   npm run test:llm-smoke
 *
 * Keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, and GEMINI_API_KEY (or GOOGLE_API_KEY / GOOGLE_AI_API_KEY)
 * in the environment or in .env.local at the project root.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TEXT_MODEL_PROFILES } from '../src/data/textModelProfiles.js'
import { generateRawCompletion } from '../src/utils/llmPostClient.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_AI_API_KEY',
]

function parseEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return {}
  const text = readFileSync(envPath, 'utf8')
  const out = {}
  for (const k of ENV_KEYS) {
    const m = text.match(new RegExp(`^${k}=(.+)$`, 'm'))
    if (m?.[1]) out[k] = m[1].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function loadKeys() {
  const fromFile = parseEnvLocal()
  const openai = process.env.OPENAI_API_KEY?.trim() || fromFile.OPENAI_API_KEY || ''
  const anthropic =
    process.env.ANTHROPIC_API_KEY?.trim() || fromFile.ANTHROPIC_API_KEY || ''
  const gemini =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    fromFile.GEMINI_API_KEY ||
    fromFile.GOOGLE_API_KEY ||
    fromFile.GOOGLE_AI_API_KEY ||
    ''
  return { openai, anthropic, gemini }
}

const systemPrompt =
  'You are a smoke-test assistant. Reply with a single short line only, no markdown.'
const userPrompt = 'Reply with the single word OK and nothing else.'

function keyForProfile(p, keys) {
  if (p.keyStorage === 'openai') return keys.openai
  if (p.keyStorage === 'anthropic') return keys.anthropic
  if (p.keyStorage === 'gemini') return keys.gemini
  return ''
}

async function main() {
  const keys = loadKeys()
  const ran = []
  let anyKey = false

  for (const profile of TEXT_MODEL_PROFILES) {
    const apiKey = keyForProfile(profile, keys)
    const label = `${profile.id} (${profile.apiModel})`
    if (!apiKey) {
      console.log(`SKIP ${label}: no API key in env or .env.local`)
      ran.push({ profile, skipped: true })
      continue
    }
    anyKey = true
    process.stdout.write(`${label} ... `)
    const started = Date.now()
    try {
      const text = await generateRawCompletion(profile, {
        systemPrompt,
        userPrompt,
        apiKey,
      })
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 120)
      console.log(`OK ${Date.now() - started}ms → ${preview}`)
      ran.push({ profile, skipped: false, ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`FAIL ${msg}`)
      ran.push({ profile, skipped: false, ok: false, msg })
    }
  }

  if (!anyKey) {
    console.error(
      '\nERROR: No LLM keys found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, and GEMINI_API_KEY (or Google variants) in env or .env.local.',
    )
    process.exit(1)
  }

  const failed = ran.filter((r) => !r.skipped && !r.ok)
  if (failed.length) {
    console.error('\nOne or more smoke tests failed. See messages above.')
    process.exit(1)
  }

  const skipped = ran.filter((r) => r.skipped).length
  if (skipped) {
    console.log(
      `\nAll configured providers passed. ${skipped} skipped (add keys to exercise all three).`,
    )
  } else {
    console.log('\nAll three model smoke tests passed.')
  }
  process.exit(0)
}

main()
