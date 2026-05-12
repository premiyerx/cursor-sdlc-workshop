# Product Requirements Document (PRD)

---

## Project Overview

**Project Name:** LinkedInfluence

**One-line Description:** A single-page web app that generates LinkedIn posts optimized for viral reach across AI software transformation topics, complete with accompanying visuals.

**Type:** Web App (Vite + React)

---

## Topic Categories

The app covers four content pillars, ranked by priority:

1. **Cursor & AI Dev Tooling** (primary) — How Cursor outperforms competitors in the AI software transformation space; product differentiation, workflow wins, real-world impact stories
2. **VC/PE Investment in AI & SDLC Transformation** — Market trends, funding rounds, analyst takes on the software development transformation wave
3. **CIO/VP Engineering Pain Points** — Top-of-mind concerns for CIOs, VP Engineering, VP DevOps, VP DevSecOps and how AI dev tools address them (security, velocity, talent, tech debt)
4. **AI Dev Transformation ROI** — How tools like Cursor increase revenue, reduce cost, and future-proof organizations for the next AI era

---

## Base MVP

> Build the minimal working version first. Target: ~10 minutes.

**What the MVP includes:**
- Single-page app with a clean, modern UI
- Topic category picker (the 4 pillars above) displayed as clickable cards
- "Generate Post" button that produces a LinkedIn post draft from a curated library of templates per category
- Each template is pre-written with LinkedIn algorithm best practices baked in (hook line, short paragraphs, strategic line breaks, CTA, hashtags)
- One-click "Copy to Clipboard" button for the generated post text
- A bundled topic-relevant graphic displayed alongside each generated post (static images shipped with the app, one per category minimum)
- Character count display (LinkedIn truncates at ~210 chars before "see more")

**What it does NOT include (stretch goals):**
- AI-generated posts via LLM API
- Voice/tone matching from real LinkedIn activity
- Live image search or AI image generation
- Daily scheduling or automation
- Mobile-native build

---

## Features

> Each feature adds depth after the MVP is working. Each lives in its own component file.

### Feature 1: LinkedIn Algorithm Optimizer
- **Description:** A real-time coaching panel that scores the generated post against known LinkedIn algorithm signals and suggests improvements. Includes: hook strength rating (does the first line compel a "see more" click?), optimal post length indicator, hashtag suggestions (3-5 relevant tags per topic), best time-to-post recommendation, engagement prompt suggestions (questions, polls, CTAs), and an "algorithm score" gauge (0-100) that grades the draft on all factors combined.
- **Files to create:**
  - `src/components/AlgorithmScorer.jsx` — scoring logic and gauge UI
  - `src/data/hashtagSuggestions.js` — curated hashtag lists per topic category
  - `src/data/postingTips.js` — algorithm tips and best-time data

### Feature 2: Post Preview & Formatting Toolbar
- **Description:** A live preview panel that renders the post exactly as it would appear in the LinkedIn feed (profile photo placeholder, name, headline, post body with "...see more" truncation). Includes a formatting toolbar with: emoji insertion (relevant professional emojis), line break / whitespace controls, bold text simulation (Unicode bold characters that work in LinkedIn), and a "before/after" toggle to compare raw text vs. formatted preview.
- **Files to create:**
  - `src/components/PostPreview.jsx` — LinkedIn-feed-style preview card
  - `src/components/FormattingToolbar.jsx` — emoji, spacing, bold controls
  - `src/utils/unicodeFormatter.js` — Unicode bold/italic character conversion

### Feature 3: Topic-Matched Image Selector
- **Description:** A visual companion panel that displays a curated gallery of graphics matched to the selected topic and generated post. Ships with a library of bundled infographics, charts, and data visualizations covering each topic pillar (market maps, ROI frameworks, SDLC diagrams, competitive landscapes). User can click to select an image, which is displayed at LinkedIn's recommended image dimensions (1200x627). Includes a download button so the image is ready to upload alongside the post.
- **Files to create:**
  - `src/components/ImageSelector.jsx` — gallery grid with selection state
  - `src/components/ImagePreview.jsx` — full-size preview with download button
  - `src/data/imageLibrary.js` — metadata mapping images to topics
  - `public/images/` — bundled topic graphics (PNG/JPG assets)

---

## Stretch Goals (Post-Workshop)

These represent the full product vision beyond the workshop scope:

- **AI-Powered Generation** — Integrate an LLM API (e.g., OpenAI) to generate original posts instead of using templates; fine-tune on voice/tone data
- **LinkedIn Voice Matching** — Scrape or import past LinkedIn posts, comments, and articles to build a writing style profile; use it to guide AI generation so every post sounds authentically like the author
- **Live Image Search & AI Graphics** — Search the web for relevant infographics/charts in real-time, or generate custom data visualizations and graphics via AI image generation APIs
- **Daily Automation & Scheduling** — Scheduled daily content generation with push notifications; optional direct-to-LinkedIn publishing via LinkedIn API
- **Mobile-Native App** — React Native or PWA wrapper for on-the-go morning publishing workflow
- **Analytics Dashboard** — Track which topics, formats, and posting times drive the most engagement over time

---

## Success Criteria

- [ ] MVP runs locally with `npm run dev`
- [ ] All 4 topic categories generate distinct, high-quality post drafts
- [ ] Each generated post includes a relevant accompanying graphic
- [ ] Copy-to-clipboard works reliably
- [ ] At least one PR merged to the original repo
- [ ] Features work without breaking the base app
