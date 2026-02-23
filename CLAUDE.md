# WKND Trendsetters Playground

## Project Purpose

Playground clone of wknd-trendsetters for managing a website entirely through Claude Code. Every action is tracked in a journal for a thesis on whether CMS/brand platforms are still needed or if LLMs can replace them.

## Rules

- **Auto-journal:** After every user request, write a journal entry. See `.claude/commands/journal.md` for format.
- **Self-update:** When you learn something useful across conversations (quirks, preferences, conventions), add it to this file. Keep it short — details go in separate files.
- **Design system:** When building visual HTML interfaces, read and follow `/Users/paolo/excat/nova/DESIGN.md`.
- **Brand guidelines:** All content, design, and communication must follow the brand system in `brand/`. Read the relevant file before creating or modifying content.
- **Visual UIs:** Every relevant artifact gets a visual HTML interface for business users. See `reports/README.md` for the system — includes a hub with chronological and mind map navigation. UIs must be updated when context changes.
- **Keep context in sync:** After any change that affects multiple artifacts, run the update process (see `.claude/commands/update.md`). Reports, hub, journal, brand files, and CLAUDE.md must stay consistent. Use `/update` for a full sweep.
- **External validation ("don't trust ourselves"):** Every validatable output must be cross-checked externally before being declared complete. Send content to GPT-4o (`OPENAI_API_KEY` in `.env`), run quantitative analysis, or compare against existing baselines. Claude must not grade its own work — use a different model, a script, or a published framework. This applies to: brand alignment scores, content quality, report accuracy, performance claims, and any other output where an independent check is feasible.
- **Don't bloat this file.** Keep instructions short. Reference separate files for details.

## Tech Stack

Astro static site on Cloudflare Pages (Wrangler). Project name: `wknd-trendsetters-playground`.

- **Default to Cloudflare** for all infrastructure and site management capabilities (Pages, Workers, R2, KV, D1, etc.). Only use something else if Cloudflare genuinely can't do it.

## Operational Notes

- Dev server: `nohup npx astro dev --port 4325 > /tmp/astro-playground.log 2>&1 &` (nohup required — background tasks without it get killed)
- **Accessibility & icons:** When modifying components, reference `brand/accessibility.md` and `brand/iconography.md`. Run `npm run validate` before committing component changes.
- **Live domain:** `wknd-trendsetters.pages.dev` (not `-playground` — the CF Pages project is `wknd-trendsetters`)
- **PSI API key:** `GOOGLE_PSI_API_KEY` in `.env`. Required for PageSpeed Insights — anonymous quota is unreliable.
- **Report HTML polish:** Reports must match hub/mindmap patterns: Source Sans Pro font via Google Fonts, CSS custom properties (design tokens), `:focus-visible`, `prefers-reduced-motion`, `shadow-emphasized` on cards.
- **Astro config:** `trailingSlash: 'never'` + `build: { format: 'file' }` — generates flat HTML files (`page.html` not `page/index.html`), avoids Cloudflare 308 redirects. Both settings required in Astro 5.x.
- **Fonts are self-hosted:** woff2 files in `public/fonts/`, `@font-face` inlined in `BaseLayout.astro`. Do NOT re-add Google Fonts external links.
- **Images:** All .avif at 800px max width, quality 50. Use `sharp` for resizing/compression.
- **Color contrast:** `--color-gray-500` is `#666666` globally but overridden to `#999999` inside `.inverse-footer` for WCAG AA on black backgrounds. Don't use a single gray for both light and dark contexts.
- **PageSpeed status:** All 16 pages score 100/100/100/100 (Perf/A11y/BP/SEO). Run `node scripts/pagespeed-collect.mjs --force` after any change that could affect scores. New pages must be added to the `PAGES` list in `scripts/pagespeed-collect.mjs`.
- **Content graph:** Run `npm run content-graph` after adding/changing content to rebuild the semantic graph and report. Uses Voyage AI embeddings (`VOYAGE_API_KEY` in `.env`).
- **Content generation targets:** When writing blog posts, hit these quantitative baselines (learned from cross-validation against existing on-brand posts):
  - Word count: 600–1000
  - Avg sentence length: 13–17 words (not too choppy, not too long)
  - Contraction density: 1.5–2.5 per 100 words (keep contractions in persona quotes, use sparingly in body copy)
  - Power word density: >3.0 per 100 words (brand/voice.md power words list)
  - Max paragraph length: 4 sentences
  - Personas: >=2 named references with direct quotes
  - Inline body images: >=2 (hero in frontmatter does not count)
  - Required structural elements: subheadings every 2-3 paragraphs, >=1 blockquote, community CTA ending
- **Image generation:** Use Gemini 3 Pro Image (`gemini-3-pro-image-preview` model, `GOOGLE_API_KEY` in `.env`). Convert outputs to AVIF via `sharp` (800px, quality 50). Follow `brand/photography.md`: candid, natural light, diverse subjects, young energy, real settings.
