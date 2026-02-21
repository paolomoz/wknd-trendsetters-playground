# WKND Trendsetters Playground

## Project Purpose

Playground clone of wknd-trendsetters for managing a website entirely through Claude Code. Every action is tracked in a journal for a thesis on whether CMS/brand platforms are still needed or if LLMs can replace them.

## Rules

- **Auto-journal:** After every user request, write a journal entry. See `.claude/commands/journal.md` for format.
- **Self-update:** When you learn something useful across conversations (quirks, preferences, conventions), add it to this file. Keep it short — details go in separate files.
- **Design system:** When building visual HTML interfaces, read and follow `/Users/paolo/excat/nova/DESIGN.md`.
- **Don't bloat this file.** Keep instructions short. Reference separate files for details.

## Tech Stack

Astro static site on Cloudflare Pages (Wrangler). Project name: `wknd-trendsetters-playground`.

- **Default to Cloudflare** for all infrastructure and site management capabilities (Pages, Workers, R2, KV, D1, etc.). Only use something else if Cloudflare genuinely can't do it.

## Operational Notes

- Dev server: `nohup npx astro dev --port 4325 > /tmp/astro-playground.log 2>&1 &` (nohup required — background tasks without it get killed)
