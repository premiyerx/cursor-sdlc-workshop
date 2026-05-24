/**
 * "Rough edit" pass. After generation + humanizing, scan the body for sentences that
 * read like a conclusion, lesson, or moral and either strip them or rewrite the final
 * line as a forward-looking observation. This is what makes posts feel like a real
 * person thinking, not a consultant wrapping up a memo.
 *
 * Also enforces the bullets-cap rule: at most ~1 in 4 posts should use a numbered
 * list. We can't decide that per-post in isolation, so we rely on the structure
 * template's directive (only `before-after` permits a list; the other three forbid
 * lists). Here we collapse stray numbered lists into prose when the chosen structure
 * says "no list".
 */

const CONCLUSION_LINE_RES = [
  /^the (?:bottom )?lesson(?: here)? is\b/i,
  /^the moral (?:of (?:the|this) story )?is\b/i,
  /^the takeaway (?:here )?is\b/i,
  /^(?:so|in short|in the end|long story short)[,:]?\s/i,
  /^this is why\b.*\bmatters?\.?$/i,
  /^that(?:'s| is) why\b/i,
  /^remember(?:,|:|\s+this:)\s/i,
  /^bottom line[,:]?\s/i,
  /^the (?:key|core) (?:point|truth|insight)(?:\s+(?:here|is))?\b/i,
  /^and that(?:'s| is) the (?:point|whole point|truth|lesson)\b/i,
  /^pay attention\b/i,
  /^mark my words\b/i,
]

/**
 * Detect "concluding" lines in a single paragraph/line.
 * Returns true if the line reads like a moral/lesson/conclusion wrap-up.
 */
function looksLikeConclusion(line) {
  const t = String(line || '').trim()
  if (!t) return false
  if (/^\d+\.\s/.test(t)) return false
  return CONCLUSION_LINE_RES.some((re) => re.test(t))
}

/**
 * Rewrite or drop the final body block when it reads like a moral. We prefer to
 * REPLACE with a forward-looking observation/question so the post still lands; only
 * drop if rewriting would be lossy.
 */
function replaceConclusion(line) {
  const t = String(line || '').trim()
  if (!t) return ''
  // Strip the wrap-up preamble and keep whatever specific content remains.
  let stripped = t
    .replace(/^(?:the (?:bottom )?lesson(?: here)? is|the moral (?:of (?:the|this) story )?is|the takeaway (?:here )?is)[:,]?\s*/i, '')
    .replace(/^(?:so|in short|in the end|long story short)[,:]?\s*/i, '')
    .replace(/^this is why\s*/i, '')
    .replace(/^that(?:'s| is) why\s*/i, '')
    .replace(/^remember(?:,|:)?\s*/i, '')
    .replace(/^bottom line[,:]?\s*/i, '')
    .replace(/^the (?:key|core) (?:point|truth|insight)(?:\s+is|here is|here)?[:,]?\s*/i, '')
    .replace(/^and that(?:'s| is) the (?:point|whole point|truth|lesson)[.:,]?\s*/i, '')
    .replace(/^pay attention[,:]?\s*/i, '')
    .replace(/^mark my words[,:]?\s*/i, '')
    .trim()
  if (!stripped) return ''
  // If what remains is itself a generic sermon, drop it.
  if (/\bmatters?\.?$/i.test(stripped) && stripped.split(/\s+/).length < 6) return ''
  // Make it a forward-looking observation rather than a verdict.
  // Cap first letter and ensure it doesn't end with a period-only verdict tone.
  const lead = stripped.charAt(0).toUpperCase() + stripped.slice(1)
  return lead.replace(/[.!]+$/, '.')
}

/**
 * Apply the rough-edit pass to a body string.
 */
export function roughEditBody(body) {
  if (!body) return ''
  const lines = String(body).split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      out.push(line)
      continue
    }
    if (looksLikeConclusion(trimmed)) {
      const isLastSubstantive = lines.slice(i + 1).every((l) => !l.trim())
      if (isLastSubstantive) {
        const replaced = replaceConclusion(trimmed)
        if (replaced) out.push(replaced)
      } else {
        const replaced = replaceConclusion(trimmed)
        if (replaced) out.push(replaced)
      }
      continue
    }
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Drop standalone conclusion sentences inside the CTA too — the CTA must be a question,
 * not a sermon. If the CTA is multi-sentence, keep only the question line.
 */
export function roughEditCta(cta) {
  if (!cta) return ''
  const t = String(cta).trim()
  if (!t) return ''
  const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const question = [...sentences].reverse().find((s) => /\?\s*$/.test(s))
  if (question) return question
  return t
}

/**
 * Collapse stray numbered lists when the post structure forbids them. Keeps content,
 * drops the numbering, and rejoins with blank lines so the rhythm stays scannable.
 * @param {string} body
 * @param {boolean} allowList — when true, body is returned unchanged.
 */
export function enforceBulletDiscipline(body, allowList) {
  if (allowList) return body || ''
  if (!body) return ''
  const lines = String(body).split('\n')
  const out = []
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (/^\d+\.\s/.test(trimmed)) {
      out.push(trimmed.replace(/^\d+\.\s*/, ''))
    } else {
      out.push(raw)
    }
  }
  // Stitch single-line beats with blank lines for mobile scannability.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Full rough-edit pass applied at the very end of finalizePost.
 * @param {{ hook?: string, body?: string, cta?: string, hashtags?: string, firstComment?: string }} post
 * @param {{ allowList?: boolean }} options
 */
export function applyRoughEdit(post, options = {}) {
  if (!post) return post
  const allowList = Boolean(options.allowList)
  let body = roughEditBody(post.body || '')
  body = enforceBulletDiscipline(body, allowList)
  const cta = roughEditCta(post.cta || '')
  return { ...post, body, cta }
}

/** Penalty when body still contains conclusion/lesson/moral lines after parsing. */
export function scoreConclusionPenalty(text) {
  if (!text) return 0
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean)
  let penalty = 0
  for (const line of lines) {
    if (looksLikeConclusion(line)) penalty += 8
  }
  return Math.min(24, penalty)
}
