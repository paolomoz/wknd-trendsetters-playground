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
