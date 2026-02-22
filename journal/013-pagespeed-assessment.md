# Journal 013 — PageSpeed Insights Assessment

**Date:** 2026-02-22
**Session type:** Performance audit (automated data collection + visual report)

## What the User Wanted

A full Google PageSpeed Insights assessment across every page on the WKND Trendsetters site — all 15 pages (10 static + 5 blog posts). Real Lighthouse performance data with the 4 categories (Performance, Accessibility, Best Practices, SEO) and Core Web Vitals, plus actionable improvement recommendations. The output: a visual HTML report following the existing report patterns, integrated into the hub and mind map.

## What Claude Code Did

### Artifacts Created or Modified

| File | Action | Purpose |
|---|---|---|
| `scripts/pagespeed-collect.mjs` | Created | Zero-dependency Node.js script: calls PSI API for all 15 pages, saves raw JSON, builds summary, generates HTML report |
| `reports/pagespeed.html` | Created | Visual assessment report with score rings, per-page table, CWV bar charts, opportunities, collapsible details |
| `reports/hub.html` | Modified | Added timeline entry for PageSpeed assessment |
| `reports/mindmap.html` | Modified | Added `pagespeed` node + edges to hub, a11y-icons (derived), content-gaps (related). Replaced placeholder infrastructure node |
| `reports/README.md` | Modified | Added manifest entry with category `audit` |
| `package.json` | Modified | Added `pagespeed` and `pagespeed:report` npm scripts |
| `.gitignore` | Modified | Added `data/` for raw API JSON files |
| `data/pagespeed/*.json` | Created (gitignored) | Raw PSI API responses for all 15 pages |
| `data/pagespeed/summary.json` | Created (gitignored) | Extracted metrics summary |

### Key Results

**Site-wide averages (mobile, 15-page):**
- Performance: **90**
- Accessibility: **95**
- Best Practices: **100**
- SEO: **97**

Homepage scored highest at 94 Performance / 95 A11y / 100 BP / 100 SEO. The weakest performer was `/fashion-insights` at 78 Performance — the only page below the "good" (90+) threshold.

All 15 pages scored **100 on Best Practices** and **92-100 on SEO**. Accessibility was consistently 93-95 across all pages.

### Process

1. Built `scripts/pagespeed-collect.mjs` following the `validate-a11y.mjs` pattern: zero dependencies, ESM, Node 18+ `fetch()`
2. First run hit 429 rate limiting — the PSI API's shared anonymous daily quota was exhausted globally
3. Added support for `GOOGLE_PSI_API_KEY` from `.env` (manual parse, no dotenv dependency)
4. Second run hit FAILED_DOCUMENT_REQUEST — the base URL was wrong (`wknd-trendsetters-playground.pages.dev` vs the actual `wknd-trendsetters.pages.dev`)
5. Fixed the domain, third run collected 14/15 pages (one transient 500 error from Lighthouse)
6. Fourth run (cache-aware) collected the last page — 15/15 complete
7. Script generated the HTML report from summary data
8. Updated hub, mind map, manifest, and package.json

### What Worked

- **Resumable collection** — the script skips cached files by default, so retrying after errors only re-fetches failures. This turned a potential 8-minute retry into a 12-second one.
- **Self-contained report generation** — the script both collects data and generates the HTML report, so `npm run pagespeed:report` can regenerate the report from cached data without re-calling the API.
- **All-in-one API call** — PSI API accepts multiple `category` params in a single request, so 15 API calls (not 60) covered all 4 Lighthouse categories.

### What Didn't Work

- **Anonymous PSI API quota** — without an API key, the global daily quota was already exhausted. This is a shared resource across all unauthenticated users worldwide. An API key was required.
- **Wrong domain** — the plan assumed `wknd-trendsetters-playground.pages.dev` but the actual Cloudflare Pages domain is `wknd-trendsetters.pages.dev`. The script needed a domain fix after DNS resolution failed.
- **Transient Lighthouse failures** — one page returned a 500 "Something went wrong" on first attempt but succeeded on retry. PSI API reliability is imperfect.

## Thesis Reflections

This session demonstrates an LLM performing a task that traditionally requires either a DevOps engineer setting up Lighthouse CI, or a marketing team manually running PageSpeed Insights page by page. The entire workflow — write the collection script, handle API authentication, collect data, generate a professional visual report, and integrate it into the reporting system — happened in a single conversation.

**What a CMS/platform would do:** A traditional approach would involve installing a Lighthouse CI action in GitHub, configuring it per-page, running it on a schedule, and building a dashboard (often with a paid tool like SpeedCurve, Calibre, or DebugBear). The report would live in a separate tool, disconnected from brand and content dashboards.

**What the LLM did instead:** Built a bespoke script that produces exactly the report format the project uses, integrated directly into the existing hub and mind map. The data collection, report design, and system integration were a single atomic unit of work — no tool silos, no dashboard switching.

**Key insight:** The resilience pattern matters. When the API rate-limited, then returned wrong-domain errors, then had a transient 500, the LLM diagnosed each issue and adapted: added API key support, fixed the domain, retried with cache awareness. This iterative debugging loop — the same thing a developer would do — happened naturally in conversation. A CI pipeline would have just failed with an opaque error.

**Performance story:** The site scores remarkably well — 90 avg Performance, 95 A11y, 100 BP, 97 SEO on mobile. This is notable because the entire site was built and managed through Claude Code conversations. LLM-generated code isn't just functional; it produces Lighthouse-green pages by default because the underlying framework (Astro) and the design decisions (minimal JS, semantic HTML) align with web performance best practices.

---

## Polish Pass

After the initial build, a systematic `/impeccable:polish` pass was applied to the report. 13 issues were identified and fixed:

### Design System Alignment
- **Font stack:** Added Source Sans Pro via Google Fonts to match hub and mindmap reports
- **CSS custom properties:** Replaced all hardcoded colors with design tokens (`--bg`, `--fg-heading`, `--primary`, `--border`, `--score-good`, etc.)
- **Shadow elevation:** Added `shadow-emphasized` to score blocks and detail cards (was missing)
- **Score value colors:** Ring numbers now match their ring color for visual reinforcement

### Accessibility
- **`:focus-visible`:** Added keyboard focus indicators on all interactive elements (back-link, details/summary)
- **`prefers-reduced-motion`:** Added media query to disable transitions for motion-sensitive users

### Data Visualization Fixes
- **CLS bar chart:** Changed scale from max-value-based (0.028 = 100%) to threshold-based (0.25 = 100%), making bars 10% width instead of invisible 2%
- **TBT all-zero:** Replaced 15 empty green bars with a compact "All 15 pages: 0 ms (Good)" note
- **Bar labels:** Changed from raw slugs (`fashion-trends-young-adults-casual-sport`) to title-cased readable names (`Fashion Trends Young Adults Casual Sport`)

### Code Quality
- **Inline styles eliminated:** Moved all `font-size`, `text-align`, `font-weight` inline styles to CSS classes (`page-name`, `metric-cell`, `group-header`, `th-right`, `td-savings`, etc.)
- **Detail body padding:** Added `padding-top: 16px` so content doesn't touch the border
- **Transitions:** Added hover transition on back-link, box-shadow transition on detail cards
- **Detail scores alignment:** Pushed badge scores to the right with `margin-left: auto`

### CLAUDE.md Updates
- Added live domain (`wknd-trendsetters.pages.dev`, not `-playground`)
- Added PSI API key reference
- Added report HTML polish conventions for future reports

---

## Deploy & Rerun

After the polish pass, the user requested a deploy + fresh PageSpeed rerun to get post-deploy scores.

### Process
1. `npx astro build` — 15 pages built in 1.01s
2. `npx wrangler pages deploy dist --project-name wknd-trendsetters` — uploaded 16 new files (80 cached)
3. Waited for propagation, verified 200 on production
4. `node scripts/pagespeed-collect.mjs --force` — all 15 pages collected successfully

### Post-Deploy Results

| Category | Pre-Deploy | Post-Deploy | Delta |
|---|---|---|---|
| Performance | 90 | 90 | — |
| Accessibility | 95 | 96 | +1 |
| Best Practices | 100 | 100 | — |
| SEO | 98 | 98 | — |

Scores are essentially identical — the +1 A11y is within normal Lighthouse variability. This confirms the site's performance characteristics are stable and not an artifact of caching or CDN warming.

### Thesis Note

The deploy-test cycle — build, deploy to edge CDN, run external performance audit, review results — took under 4 minutes end-to-end. In a traditional workflow this would be: merge PR, wait for CI build, wait for deploy pipeline, manually trigger Lighthouse CI or wait for scheduled run, check a separate dashboard. The LLM collapsed five handoffs into a single conversation turn.
