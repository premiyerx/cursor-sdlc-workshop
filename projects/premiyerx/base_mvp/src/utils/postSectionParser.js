/**
 * Pure parsing + sanitization helpers for raw model output → {hook, body, cta, hashtags, firstComment}.
 *
 * Extracted from aiPostGenerator.js so the generator file stays focused on orchestration
 * (prompt building, model calls, reach pipeline). Everything here is a pure string/object
 * function with no dependency on the generator, so there is no circular import.
 */

/** Lines models echo from system rubrics — not reader-facing LinkedIn copy. */
export function stripPromptInstructionEcho(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const L = line.trim()
      if (!L) return true
      if (/^CAPITAL_PILLAR_FOCUS\b/i.test(L)) return false
      if (/^-?\s*lead with cross-portfolio themes\b/i.test(L)) return false
      if (/^lead with\b/i.test(L) && L.length < 160) return false
      if (/^open on\b/i.test(L) && L.length < 140) return false
      if (/^frame as\b/i.test(L) && L.length < 140) return false
      if (/^contrast what\b/i.test(L) && L.length < 160) return false
      if (/^name the second-order\b/i.test(L)) return false
      if (/^do not make speculative\b/i.test(L)) return false
      if (/^if a blockbuster headline\b/i.test(L)) return false
      if (/unless CONTEXT has\b/i.test(L)) return false
      if (/unless the author explicitly wants\b/i.test(L)) return false
      return true
    })
    .join('\n')
}

/** Carousel exporter adds deck count; strip wrong “N-slide” claims from prose. */
export function stripDeckSlideCountClaims(s) {
  if (!s) return ''
  return s.replace(
    /\b\d{1,2}\s*[-–]\s*slide\s+(visual guide|walkthrough|carousel|deck|breakdown)\b/gi,
    'a visual guide',
  )
}

/** Remove internal drafting markers models sometimes leak into prose. */
export function sanitizeExternalCopy(s) {
  if (!s) return ''
  let t = String(s)
  const markers =
    /\b(?:RE[-_\s]?HOOK|RE[-_\s]?BODY|RE[-_\s]?LINE|ALT[-_\s]?HOOK|INTERNAL\s*DRAFT|DRAFT\s*ONLY|META[-_\s]?NOTE|NOTE\s*TO\s*SELF)\s*:?\s*/gi
  t = t.replace(markers, '')
  t = t.replace(/\(\s*Internal:[^)]*\)/gi, '')
  t = stripPromptInstructionEcho(t)
  t = stripDeckSlideCountClaims(t)
  t = t.replace(/[^\S\n]+/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Strip common assistant wrappers so section headers parse cleanly. */
export function stripAssistantPreamble(text) {
  let t = text.trim()
  const introPatterns = [
    /^Sure[!,.]?\s*\n+/i,
    /^Certainly[!,.]?\s*\n+/i,
    /^Here(?:'s| is) (?:your|the) (?:LinkedIn )?post[^\n]*\n+/i,
    /^Below (?:is|you(?:'|')ll find)[^\n]*\n+/i,
  ]
  for (const re of introPatterns) {
    t = t.replace(re, '')
  }
  return t.trim()
}

export function stripCodeFence(text) {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json|text)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  }
  return t.trim()
}

export function normalizeSectionLabel(label) {
  const u = label.replace(/\*+/g, '').replace(/\s+/g, '_').toUpperCase()
  if (u === 'HOOK' || u === 'OPENING' || u === 'HEADLINE' || u === 'OPENER') return 'hook'
  if (u === 'BODY' || u === 'CONTENT' || u === 'MAIN') return 'body'
  if (u === 'CTA' || u === 'CALL_TO_ACTION') return 'cta'
  if (u === 'HASHTAGS' || u === 'HASHTAG' || u === 'TAGS') return 'hashtags'
  if (u === 'FIRST_COMMENT' || u === 'FIRSTCOMMENT') return 'firstComment'
  return null
}

/** Remove standalone section labels the model sometimes leaves inside prose. */
export function stripStraySectionLabels(s) {
  if (!s) return ''
  return s
    .split('\n')
    .filter(
      (line) =>
        !/^\s*#*\s*(?:\*\*)?\s*(HOOK|BODY|CTA|HASHTAGS|CONTENT|OPENING|HEADLINE|MAIN|TAGS)\s*(?:\*\*)?\s*:?\s*$/i.test(
          line,
        ) &&
        !/^\s*#*\s*(?:\*\*)?\s*RE[-_\s]?HOOK\s*:?\s*$/i.test(line) &&
        !/^\s*#*\s*(?:\*\*)?\s*ALT[-_\s]?HOOK\s*:?\s*$/i.test(line) &&
        !/^\s*#*\s*(?:\*\*)?\s*INTERNAL\s*:?\s*$/i.test(line),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function tryParseJsonPost(text) {
  const tryObj = (o) => {
    if (!o || typeof o !== 'object') return null
    const hook = String(o.hook ?? o.opening ?? o.headline ?? '').trim()
    const body = String(o.body ?? o.content ?? o.main ?? o.text ?? '').trim()
    const cta = String(o.cta ?? o.callToAction ?? '').trim()
    const hashtags = String(o.hashtags ?? o.tags ?? '').trim()
    const firstComment = String(o.firstComment ?? o.first_comment ?? '').trim()
    if (hook || body) return { hook, body, cta, hashtags, firstComment }
    return null
  }
  try {
    const o = JSON.parse(text)
    const got = tryObj(o)
    if (got) return got
  } catch {
    /* continue */
  }
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) {
    try {
      const o = JSON.parse(brace[0])
      return tryObj(o)
    } catch {
      return null
    }
  }
  return null
}

/** Match section headers at line starts (markdown / bold / blockquote ok). */
export function parseHeaderSections(text) {
  const re =
    /(?:^|\n)(\s*(?:>\s*)?#*\s*(?:\*\*)?\s*)(HOOK|HEADLINE|OPENING|BODY|CONTENT|MAIN|CTA|HASHTAGS|TAGS|FIRST[\s_]?COMMENT)(?:\*\*)?\s*:\s*/gi
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return null

  const chunks = { hook: '', body: '', cta: '', hashtags: '', firstComment: '' }
  const firstMatch = matches[0]
  const lead = text.slice(0, firstMatch.index).trim()

  for (let i = 0; i < matches.length; i++) {
    const key = normalizeSectionLabel(matches[i][2])
    if (!key) continue
    const start = matches[i].index + matches[i][0].length
    const end = matches[i + 1]?.index ?? text.length
    const chunk = text.slice(start, end).trim()
    if (!chunk) continue
    chunks[key] = chunks[key] ? `${chunks[key]}\n\n${chunk}` : chunk
  }

  let { hook, body, cta, hashtags, firstComment } = chunks
  const firstKey = normalizeSectionLabel(matches[0][2])

  if (lead) {
    if (firstKey === 'hook') hook = hook ? `${lead}\n\n${hook}` : lead
    else if (!hook) hook = lead
    else body = body ? `${lead}\n\n${body}` : `${lead}\n\n${body}`
  }

  if (!hook && body) {
    const lines = body.split('\n').filter(Boolean)
    hook = lines[0] || ''
    body = lines.slice(1).join('\n').trim() || body
  }

  if (hook || body || cta || hashtags) {
    return { hook, body, cta, hashtags, firstComment }
  }
  return null
}

/** Original strict newline format: HOOK:\n...\nBODY: */
export function parseLegacyNewlineSections(text) {
  const hookMatch = text.match(/HOOK:\s*\n([\s\S]*?)(?=\nBODY:)/i)
  const bodyMatch = text.match(/BODY:\s*\n([\s\S]*?)(?=\nCTA:)/i)
  const ctaMatch = text.match(/CTA:\s*\n([\s\S]*?)(?=\nHASHTAGS:)/i)
  const hashMatch = text.match(/HASHTAGS:\s*\n([\s\S]*?)(?=\nFIRST_COMMENT:|$)/i)
  const commentMatch = text.match(/FIRST_COMMENT:\s*\n([\s\S]*?)$/i)
  if (!hookMatch && !bodyMatch) return null
  return {
    hook: hookMatch ? hookMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
    cta: ctaMatch ? ctaMatch[1].trim() : '',
    hashtags: hashMatch ? hashMatch[1].trim() : '',
    firstComment: commentMatch ? commentMatch[1].trim() : '',
  }
}

/** Same-line HOOK: text (no required newline after colon). */
export function parseLegacyFlexibleColon(text) {
  const hookMatch = text.match(/HOOK:\s*\n?([\s\S]*?)(?=BODY:)/i)
  const bodyMatch = text.match(/BODY:\s*\n?([\s\S]*?)(?=CTA:)/i)
  const ctaMatch = text.match(/CTA:\s*\n?([\s\S]*?)(?=HASHTAGS:)/i)
  const hashMatch = text.match(/HASHTAGS:\s*\n?([\s\S]*?)(?=FIRST_COMMENT:|$)/i)
  const commentMatch = text.match(/FIRST_COMMENT:\s*\n?([\s\S]*?)$/i)
  if (!hookMatch && !bodyMatch) return null
  return {
    hook: hookMatch ? hookMatch[1].trim() : '',
    body: bodyMatch ? bodyMatch[1].trim() : '',
    cta: ctaMatch ? ctaMatch[1].trim() : '',
    hashtags: hashMatch ? hashMatch[1].trim() : '',
    firstComment: commentMatch ? commentMatch[1].trim() : '',
  }
}
