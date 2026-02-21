# WKND Trendsetters Playground

## Project Purpose

This is a playground clone of wknd-trendsetters for experimenting with managing a website entirely through Claude Code. Every action is tracked in a journal for a thesis on whether CMS systems and brand visibility platforms are still needed, or if LLMs can replace them.

## Auto-Journaling Rule

**After completing every user request, automatically write a journal entry.** Do not wait for the user to ask. Review the conversation, capture their intent, prompts, what happened, outcomes, and reflections. Follow the format and process defined in `.claude/commands/journal.md`. This is critical — the journal IS the thesis deliverable.

## Tech Stack

- Astro (static site)
- Cloudflare Pages (via Wrangler)
- Project name: `wknd-trendsetters-playground` (isolated from the original)

## Dev Server

Run with: `npx astro dev`
