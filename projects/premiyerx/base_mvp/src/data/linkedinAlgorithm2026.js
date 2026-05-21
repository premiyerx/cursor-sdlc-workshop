/**
 * 2026 LinkedIn feed heuristics for *writing prompts* (not official LinkedIn docs).
 * Synthesizes product research + public operator guides (e.g. dwell-first ranking, comment depth).
 *
 * Mobile: most members access LinkedIn on phones; feed scroll and document swipes are phone-first
 * even when desktop share of *sessions* stays high for hiring/recruiting workflows.
 */

/** Research-backed one-liner for UI + prompts. */
export const LINKEDIN_MOBILE_CONTEXT =
  'Design and write for the phone feed first (~390px wide, thumb swipe, 2-second hook). Desktop preview is secondary.'

/** Oktopost / LinkedIn document guidance mirrored in-app. */
export const DOCUMENT_POST_SPEC = {
  width: 1080,
  height: 1350,
  aspect: '4:5 portrait',
  safeMarginPx: 50,
  recommendedSlidesMin: 6,
  recommendedSlidesMax: 8,
  maxWordsPerSlide: 58,
  minBodyFontPx: 28,
}

/** Full block for LLM system/user prompts (posts, captions). */
import { buildGoldenHourBlock, buildPremStrategyBlock } from './contentStrategy'

export function buildLinkedInAlgorithmBlock() {
  return `
LINKEDIN DISTRIBUTION (2026 HEURISTICS — shape every post this way):
• PRIMARY SURFACE: Phone feed first. Most members consume LinkedIn on mobile; document carousels and infographics must read clearly at ~390px effective width without zoom. Short lines, large hierarchy, one idea per beat.
• Ranking favors dwell time (time on post) and topic authority over empty reach. Write so a serious reader stays 60+ seconds: tension, sourced stats, and clear beats—not filler or throat-clearing.
• Comments rank far above passive likes; short threads beat one-line praise. End with a specific "you/your" question that invites experience, tradeoffs, or counterexamples—not "Agree?", "Thoughts?", polls-as-gags, or "Comment YES" bait.
• Document / carousel PDFs often earn stronger engagement depth because swiping counts as active reading. Portrait 1080×1350 PDFs; caption still carries hook, proof previews, and the question (the feed reads the caption, not the file).
• Golden hour: the first ~60 minutes disproportionately shape reach—FIRST_COMMENT should add net-new insight plus a follow-up question so you can reply with substance quickly after posting.
• Authenticity: avoid engagement-bait patterns and naked external URLs in the main post body (reporting consistently shows reach hits for link-stuffing and bait). If a link is essential, prefer the first comment or name the source without a raw URL.
• Topic DNA: stay inside the assigned pillar—consistent themes help distribution beyond immediate connections.
• Cadence: one sharp thesis per post; do not write copy that assumes three unrelated posts ship the same day.
• Voice: first-person operator (Prem) outperforms corporate-page tone for organic reach—specific, peer-level, never generic "LinkedIn AI" cadence.

${buildPremStrategyBlock()}

${buildGoldenHourBlock()}`.trim()
}

/** One line appended to image-model prompts. */
export function buildNewsroomAlgorithmLine() {
  return (
    'Feed context (2026, MOBILE-FIRST): assume the image is seen on a phone at ~390px width in the LinkedIn feed. ' +
    'One focal story, very large headline type, body labels ≥24pt equivalent, no micro-text, max 5–7 words per label; ' +
    'verified numbers only; scannable in under 2 seconds before the user taps.'
  )
}

/** Carousel / document companion caption hints. */
export function buildCarouselCaptionMobileBlock() {
  return `
CAPTION (mobile feed):
• First 2 lines must work before "see more" — hook + one proof tease.
• Keep paragraphs 1–2 sentences; blank line between beats.
• End with a you/your question; do not repeat the carousel’s final slide word-for-word.`.trim()
}

/** Short UI copy for carousel / document tips. */
export const CAROUSEL_ALGORITHM_TIP =
  'Mobile-first document (1080×1350): one insight per slide, large type, ≤58 words/slide. Caption carries ranking signals—attach PDF after posting.'
