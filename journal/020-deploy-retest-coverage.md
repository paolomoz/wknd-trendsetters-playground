# Journal 020 — Deploy, Retest & Coverage Fix

**Date:** 2026-02-23
**Session type:** Context recovery + deploy verification + test coverage gap

## What the User Wanted

Three terse commands spanning two minutes:

1. "push it"
2. "deploy and retest"
3. "journal and report results, and track relevant references in CLAUDE.md"

The intent: ship the journal 019 commit, confirm the site still holds 100/100/100/100, and document it.

## What Claude Code Did

### Phase 1: Push + Build + Deploy

Pushed `f325109` (journal 019) to origin/main. Built Astro (16 pages), deployed to Cloudflare Pages via Wrangler. Zero issues — the deploy path is now muscle memory for both human and AI.

### Phase 2: PageSpeed Retest — and a Coverage Gap

Ran `node scripts/pagespeed-collect.mjs --force`. All 15 tested pages returned 100/100/100/100. But the report said "15/15 pages collected" while Astro built 16 pages. The flip-flop blog post (`/blog/flip-flop-summer-style`) — written in journal 016 and deployed in journal 019 — was never added to the PSI test list.

**The page list in `scripts/pagespeed-collect.mjs` is hardcoded.** When a new blog post was created, the PSI script wasn't updated. This means the previous session's "100/100/100/100 zero regressions" claim (journal 019) was technically correct but incomplete — it tested 15 of 16 live pages.

**Fix:** Added the flip-flop blog post to the `PAGES.blog` array. Reran PSI across all 16 pages.

**Result: 16/16 pages at 100/100/100/100.** The new blog post with its 2 Gemini-generated AVIF images (48 KB total) scores perfect across all four Lighthouse categories.

### Phase 3: CLAUDE.md Updates

Two changes:
1. Updated PageSpeed status from "15 pages" to "16 pages"
2. Added note that new pages must be added to the `PAGES` list in `scripts/pagespeed-collect.mjs` — preventing this coverage gap from recurring

## The Prompts

Three prompts:
1. "push it"
2. "deploy and retest"
3. "journal and report results, and track relevant references in CLAUDE.md"

## Artifacts Modified

| File | Change |
|------|--------|
| `scripts/pagespeed-collect.mjs` | Added `blog-flip-flop-summer-style` to PAGES list |
| `data/pagespeed/summary.json` | Regenerated with 16 pages |
| `reports/pagespeed.html` | Regenerated with 16-page data |
| `CLAUDE.md` | Updated page count 15→16, added note about adding new pages to PSI script |

## Thesis Reflections

This session surfaced a **process gap that no CMS would have** — but also one that an LLM can self-diagnose and fix.

The problem: when Claude wrote a new blog post (journal 016), it didn't update the PageSpeed test suite to include it. The post was deployed, live, and serving visitors, but invisible to the quality assurance pipeline. In a CMS, new pages are automatically included in site-wide audits because the CMS knows about all content. In this LLM-managed setup, the test configuration is a separate artifact that must be manually kept in sync.

**But here's the thing:** Claude caught the gap in this session by noticing Astro built 16 pages while PSI only tested 15. A CMS audit would have caught it too — but silently, without explaining why. Claude caught it, explained the gap, fixed the script, reran the test, and codified a rule in CLAUDE.md to prevent it from happening again. The fix was structural, not just tactical.

**The CLAUDE.md note — "New pages must be added to the PAGES list" — is a micro-process improvement.** It's the kind of thing that accumulates in a CMS as buried configuration, but here it's a plain-English rule that the AI reads before every session. The governance system gets smarter with each session, and the rules are transparent and auditable.

**For the thesis:** This is an honest example of both the weakness and the strength of LLM-managed sites. The weakness: no automatic content registry means test coverage can drift. The strength: the LLM can reason about the gap, fix it, and prevent recurrence — all in the same session, with full audit trail. A CMS prevents the gap by design; an LLM prevents it by learning. The question is which approach scales better as the site grows.
