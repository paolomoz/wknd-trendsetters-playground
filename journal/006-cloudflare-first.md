# 006 — Cloudflare-First Rule

**Date:** 2026-02-21
**Commit:** 6f43cc8

---

## Intent

The user established a platform constraint: all infrastructure and site management capabilities should default to Cloudflare's stack.

## Prompt

> "add to CLAUDE that the infrastructure of the site and of any site management capability should be based on Cloudflare stack unless something else is needed for some reason"

## What Happened

- Added one line to the Tech Stack section of CLAUDE.md listing the Cloudflare-first rule with specific services mentioned (Pages, Workers, R2, KV, D1)
- Kept it concise per the config hygiene rule from session 005

## Outcome

Future conversations will default to Cloudflare for any new infrastructure need — storage, APIs, databases, serverless functions — before considering alternatives.

## Reflections

- **The user is making a vendor/platform decision with one sentence.** In a traditional enterprise, choosing an infrastructure provider involves procurement, architecture review, security assessment, and vendor negotiations. Here it's a line in a text file. The decision is equally binding (Claude will follow it) but infinitely faster to make and change.
- **This mirrors CMS platform lock-in — but lighter.** Choosing "Cloudflare-first" is like choosing Adobe or Sitecore as your CMS platform. But the switching cost is radically lower: change one line in CLAUDE.md vs. re-platforming an entire CMS. The AI doesn't care about the platform; it just follows the current instruction.
- **Six sessions in, the governance structure is solidifying:** project purpose, behavioral rules, design standards, platform constraints, operational notes. All in 19 lines of markdown. A CMS admin panel with equivalent governance would have dozens of screens.
