/**
 * 2026 LinkedIn feed heuristics for *writing prompts* (not official LinkedIn docs).
 * Synthesizes product research + public operator guides (e.g. dwell-first ranking, comment depth).
 */

/** Full block for LLM system/user prompts (posts, captions). */
export function buildLinkedInAlgorithmBlock() {
  return `
LINKEDIN DISTRIBUTION (2026 HEURISTICS — shape every post this way):
• Ranking favors dwell time (time on post) and topic authority over empty reach. Write so a serious reader stays 60+ seconds: tension, sourced stats, and clear beats—not filler or throat-clearing.
• Comments rank far above passive likes; short threads beat one-line praise. End with a specific "you/your" question that invites experience, tradeoffs, or counterexamples—not "Agree?", "Thoughts?", polls-as-gags, or "Comment YES" bait.
• Document / carousel PDFs often earn stronger engagement depth because swiping counts as active reading. When the user attaches a deck, the caption must still carry hook, proof previews, and the question (the feed reads the caption, not the file).
• Golden hour: the first ~60 minutes disproportionately shape reach—FIRST_COMMENT should add net-new insight plus a follow-up question so you can reply with substance quickly after posting.
• Authenticity: avoid engagement-bait patterns and naked external URLs in the main post body (reporting consistently shows reach hits for link-stuffing and bait). If a link is essential, prefer the first comment or name the source without a raw URL.
• Topic DNA: stay inside the assigned pillar—consistent themes help distribution beyond immediate connections.
• Cadence: one sharp thesis per post; do not write copy that assumes three unrelated posts ship the same day.
• Voice: first-person operator (Prem) outperforms corporate-page tone for organic reach—specific, peer-level, never generic "LinkedIn AI" cadence.`.trim()
}

/** One line appended to image-model prompts. */
export function buildNewsroomAlgorithmLine() {
  return 'Feed context (2026): optimize for mobile dwell—one primary visual story, bold hierarchy, verified numbers only, minimal micro-text; scannable at a glance in the feed.'
}

/** Short UI copy for carousel / document tips. */
export const CAROUSEL_ALGORITHM_TIP =
  'Documents reward dwell time in 2026—one insight per slide. The caption carries ranking signals; attach the PDF after posting.'
