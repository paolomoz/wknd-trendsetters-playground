# Journal 014 — Performance Optimization

**Date:** 2026-02-22
**Session type:** Performance optimization (code changes + deploy + verification)

## What the User Wanted

Push the site's PageSpeed Performance score toward 100. Journal 013 revealed the site averaged 90 Performance across 15 pages, with `/fashion-insights` dragging at 78 — the only page below the "good" threshold. The user wanted the three identified bottlenecks fixed: trailing-slash redirects, lazy-loaded hero images killing LCP, and render-blocking Google Fonts.

## What Claude Code Did

### Artifacts Created or Modified

| File | Action | Purpose |
|---|---|---|
| `astro.config.mjs` | Modified | Added `trailingSlash: 'never'`, `build: { format: 'file' }`, fixed `site` URL |
| `src/components/Hero.astro` | Modified | Removed `loading="lazy"`, added `fetchpriority="high"` + `height="180"` on hero images |
| `src/layouts/BlogPostLayout.astro` | Modified | Removed `loading="lazy"`, added `fetchpriority="high"` on blog hero images |
| `src/layouts/BaseLayout.astro` | Modified | Replaced synchronous Google Fonts `<link>` with `media="print"` async swap pattern |
| `reports/pagespeed.html` | Regenerated | Fresh report with post-optimization scores |

### Three Fixes Applied

**1. Trailing-slash redirects eliminated**

All 15 pages were generating as `dist/page-name/index.html`, causing Cloudflare Pages to 308-redirect `/page-name` → `/page-name/` before serving. Added `trailingSlash: 'never'` and `build: { format: 'file' }` to produce flat files (`dist/page-name.html`) that Cloudflare serves directly — no redirect overhead.

Note: the plan assumed `trailingSlash: 'never'` alone would produce flat files, but Astro 5.17.3 still generates directory-style output without explicit `build.format: 'file'`. Caught this during build verification and added the missing config.

**2. Hero image LCP fix**

`Hero.astro` applied `loading="lazy"` to all images including the above-fold hero — the Largest Contentful Paint element. Replaced with `fetchpriority="high"` and added explicit `height="180"` to prevent CLS. Same fix applied to `BlogPostLayout.astro` blog post hero images.

**3. Async Google Fonts**

Replaced the synchronous `<link rel="stylesheet">` for Google Fonts with the `media="print"` swap pattern:
- `<link rel="preload" ... as="style">` — starts download early
- `<link ... media="print" onload="this.media='all'">` — non-render-blocking, swaps on load
- `<noscript>` fallback for no-JS environments

### Key Results

**Site-wide averages (mobile, 15-page):**

| Category | Before | After | Delta |
|---|---|---|---|
| Performance | **90** | **93** | **+3** |
| Accessibility | 96 | 96 | — |
| Best Practices | 100 | 100 | — |
| SEO | 98 | 98 | — |

**Biggest improvement:** `/fashion-insights` jumped from **78 → 91** (+13 points), escaping the "needs improvement" range entirely.

**No page below 90** — the weakest performer is now `/fashion-trends-of-the-season` at 90, up from the previous floor of 78.

All 5 blog posts score 94-95, up from the low 90s. The `fetchpriority="high"` on blog hero images had measurable impact.

### What Worked

- **Flat file generation** — changing `build.format: 'file'` instantly eliminated 308 redirects for 14/15 pages (homepage was already `/index.html`)
- **LCP image priority** — removing `loading="lazy"` and adding `fetchpriority="high"` gave the browser the right signal to prioritize the hero image
- **Async fonts** — the `media="print"` pattern is a well-known technique that works without any runtime JS framework

### What Didn't Work (Initially)

- **`trailingSlash: 'never'` alone** — the plan expected this to produce flat HTML files, but Astro 5.17.3 requires explicit `build: { format: 'file' }`. The build output still showed `index.html` files until the format was added. This was caught by verifying the build output before deploying.

## Thesis Reflections

This session shows the LLM operating as a **performance engineer** — analyzing Lighthouse data, identifying root causes, implementing targeted fixes across multiple files, deploying, and verifying with real measurements. The full cycle (analysis → code → deploy → measure) completed in a single conversation.

**What a CMS/platform would do:** Performance optimization typically involves: a frontend developer reading Lighthouse reports, filing tickets, making changes across multiple templates, testing locally, opening a PR, getting it reviewed, merging, deploying, and then re-running Lighthouse to verify. Often the analysis and fix happen in different tools (PageSpeed Insights, IDE, CI pipeline, monitoring dashboard). Multiple handoffs, multiple days.

**What the LLM did instead:** Read the previous session's data, proposed a plan, implemented four file edits, caught a config issue during build verification, deployed, and re-measured — all in one conversation. The verification loop (build → check output → fix → rebuild) happened naturally.

**Key insight: the LLM self-corrected.** The plan assumed `trailingSlash: 'never'` would generate flat files. The build output showed otherwise. Rather than deploying and hoping, Claude Code verified the output, diagnosed the gap, added the missing `build.format` config, and rebuilt. This mirrors what a developer would do — the plan isn't sacred, the outcome is.

**Performance ceiling question:** The site now averages 93 Performance on mobile. Getting to 100 would likely require image optimization (WebP/AVIF, responsive `srcset`), edge caching headers, and potentially inlining critical CSS — diminishing returns territory. The jump from 78→91 on the worst page and 90→93 average with three targeted fixes shows the highest-leverage optimizations are identifiable and implementable through conversation.

---

## Round 2: Self-Hosted Fonts + Image Compression → Performance 100

The user said "it is not 100 yet, lots of CLS, some high LCPs fix it for good" — pushing for the perfect score. Claude Code analyzed the raw Lighthouse data and identified two remaining bottlenecks:

1. **External Google Fonts chain** — DNS lookup + TLS + CSS download + font file discovery + font download = ~1,500ms of network chain on simulated mobile. This was the dominant cause of the ~2.4s FCP.
2. **Oversized images** — 76 .avif files totaling 6.9MB, many at original resolution (800-1200px wide) when mobile viewport only needs ~400px (800px at 2x retina).

### Fixes Applied

**Self-hosted fonts:**
- Downloaded 3 woff2 files (Instrument Sans variable, Syncopate 400, Syncopate 700) — 49KB total
- Inlined `@font-face` declarations directly in `<head>` via `<style>` block
- Added `<link rel="preload">` for the font files — browser fetches them immediately from same origin
- Removed all Google Fonts external links (preconnect, preload, stylesheet)
- Result: fonts now load from the same CDN as the HTML, no cross-origin chains

**Image compression:**
- Resized all 76 .avif images to max 800px width (retina-ready for mobile viewport)
- Re-encoded at AVIF quality 50 (perceptually transparent for web content)
- Total payload: **6.9MB → 1.9MB** (73% reduction)

### Results

| Metric | Round 1 (prev) | Round 2 (now) |
|---|---|---|
| **Performance** | 93 | **100** |
| FCP | ~2,400ms | **~900ms** |
| LCP | ~2,800ms avg | **~1,300ms avg** |
| CLS | 0.025 | 0.025 (unchanged, under threshold) |

**All 15 pages score Performance 100.**

The FCP improvement (2,400ms → 900ms) was entirely from self-hosting fonts. Eliminating the external font chain removed ~1,500ms of serialized network requests on simulated mobile. The image compression reduced total transfer size by 5MB, directly improving LCP for image-heavy pages.

### What Worked

- **Self-hosting > CDN for fonts** — Google Fonts is fast on desktop broadband, but on Lighthouse's mobile simulation (1.6 Mbps, 150ms RTT), the multi-hop chain (HTML → CSS → font file, across two domains) adds massive latency. Self-hosting collapses this to a single same-origin preloaded request.
- **Aggressive AVIF compression** — Quality 50 with 800px max width is visually acceptable for a fashion/lifestyle site and dramatically reduces payload.
- **Iterative fix-deploy-measure loop** — The user pushed for 100 after the first round hit 93. The second round of analysis identified the exact bottlenecks (font chain + image size) rather than guessing.

### Thesis Reflections

This is the session's strongest evidence for the thesis. The user gave a simple instruction — "it is not 100 yet [...] fix it for good, make the fix, deploy, test and refactor again in loop if needed" — and Claude Code executed a complete performance engineering sprint:

1. Analyzed raw Lighthouse JSON to identify font chain and image sizing as bottlenecks
2. Downloaded and self-hosted Google Fonts (3 woff2 files)
3. Rewrote the font loading strategy (inline @font-face + preload)
4. Compressed 76 images with sharp (6.9MB → 1.9MB)
5. Built, deployed, measured — hit 100 on first attempt

**A traditional workflow would require:** A performance engineer reading Lighthouse reports, a frontend developer refactoring font loading, a build pipeline with image optimization plugins (like astro-imagetools or Next.js Image), QA testing for visual regressions, and multiple deploy-measure cycles across days or weeks.

**The LLM did it in one conversation turn.** The key capability isn't just code generation — it's the closed-loop optimization cycle: analyze → hypothesize → implement → measure → verify. This is exactly what makes performance engineering expensive in traditional teams (requires both deep knowledge and iterative experimentation), and exactly where LLMs collapse the cost to near-zero.

---

## Round 3: Accessibility 100 + SEO 100

The user then pushed further: "now make also accessibility and SEO all 100." Performance was 100 but A11y averaged 96 and SEO averaged 98. Claude Code analyzed every failing Lighthouse audit across all 15 pages and found three issues.

### Issues Found

1. **Color contrast** (all 15 pages, A11y) — `utility-text-secondary` used `--color-gray-500: #737373` which gave only 4.34:1 contrast on `#f5f5f5` backgrounds (needs 4.5:1). Darkened to `#666666` (5.27:1 on light backgrounds).

2. **Footer contrast** (all 15 pages, A11y) — The fix above broke the inverse footer (black background) where `#666666` on `#000000` only gives 3.65:1. Added a CSS custom property scope override: `.inverse-footer { --color-gray-500: #999999; }` which gives 7.36:1 on black. This is the elegant power of CSS custom properties — different values in different contexts without touching any component markup.

3. **Heading order** (fashion-trends-young-adults, A11y) — Three `<h3>` elements appeared before any `<h2>`, skipping a heading level. Changed to `<h2 class="h3-heading">` — semantic fix, visual style preserved.

4. **Generic "Read more" link text** (4 pages, SEO) — Lighthouse SEO audit flags non-descriptive link text. Replaced with specific labels: "Explore the blog", "Read the full article", "Explore young adult trends".

### Fix-Deploy-Test Loop

- **Round 3a:** Applied color-contrast fix (#737373→#666666), heading order, and link text fixes. Deployed. Result: SEO 100 on all pages, but A11y still 96 — the inverse footer was now failing.
- **Round 3b:** Added `.inverse-footer { --color-gray-500: #999999; }` scoped override. Deployed. Result: **100/100/100/100 on all 15 pages.**

### Final Results

| Category | Baseline | After Perf Fixes | After A11y/SEO Fixes |
|---|---|---|---|
| Performance | 90 | 100 | **100** |
| Accessibility | 96 | 96 | **100** |
| Best Practices | 100 | 100 | **100** |
| SEO | 98 | 98 | **100** |

Every page, every category, perfect score.

### Thesis Reflections

The accessibility and SEO sprint demonstrates the LLM's ability to perform **forensic analysis at scale**. Rather than running Lighthouse on one page and guessing at fixes, Claude Code:

1. Parsed raw JSON from 15 Lighthouse runs to extract every failing audit
2. Identified the exact CSS color value, background color, contrast ratio, and failing elements
3. Calculated that `#666666` passes AA on `#f5f5f5` (5.27:1) but fails on `#000000` (3.65:1)
4. Used CSS custom property scoping to solve the dual-context contrast problem without duplicating selectors
5. Fixed semantic HTML (heading order) and SEO copy (link text) across 4 pages
6. Self-corrected after the first deploy when the footer contrast appeared as a new failure

**The dual-context contrast problem is notable.** A single gray that passes WCAG AA on both white and black backgrounds is mathematically impossible (the ranges don't overlap). The LLM recognized this and applied the correct architectural solution — CSS custom property scoping — rather than trying to find a "magic gray."

**What a CMS would need:** Custom color contrast checking plugins, accessibility auditing integrations, SEO analysis tools, and likely multiple rounds of QA review. Each fix would be a separate ticket in separate workflows.

**What the LLM did:** A single conversation with iterative fix-measure loops. The entire journey from Perf 90, A11y 96, SEO 98 to **100/100/100/100** took three rounds of edits across ~10 files, with real Lighthouse verification after each round.
