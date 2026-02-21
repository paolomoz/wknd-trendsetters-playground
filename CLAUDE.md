# WKND Trendsetters Playground

## Project Purpose

This is a playground clone of wknd-trendsetters for experimenting with managing a website entirely through Claude Code. Every action is tracked in a journal for a thesis on whether CMS systems and brand visibility platforms are still needed, or if LLMs can replace them.

## Auto-Journaling Rule

**After completing every user request, automatically write a journal entry.** Do not wait for the user to ask. Review the conversation, capture their intent, prompts, what happened, outcomes, and reflections. Follow the format and process defined in `.claude/commands/journal.md`. This is critical — the journal IS the thesis deliverable.

## Tech Stack

- Astro (static site)
- Cloudflare Pages (via Wrangler)
- Project name: `wknd-trendsetters-playground` (isolated from the original)

## Self-Updating Instructions

When you discover patterns, preferences, or operational knowledge that would be useful across future conversations (e.g., dev server quirks, user preferences, project conventions, things that failed), **add them to this CLAUDE.md file**. This file is the project's persistent memory — keep it current.

## Design System for On-The-Fly Interfaces

When building any standalone HTML interfaces (reports, dashboards, visual tools), follow the Nova / Adobe Spectrum 2 design system defined in `/Users/paolo/excat/nova/DESIGN.md`. Key principles:

- **Colors:** Background `#F8F8F8` (layer-1), `#FFFFFF` (layer-2). Primary accent `#3B63FB`. Text `#292929`, muted `#717171`. Borders `#E1E1E1`.
- **Typography:** System sans-serif stack. 14px body-sm, 16px body-md, 18px body-lg. Bold 700 for titles, ExtraBold 800 for headings.
- **Spacing:** 4px base grid. 8px default padding, 16px standard gaps, 24-32px section padding.
- **Shape:** 4px radius default, 8px for cards/panels, 12px for modals, pill (`9999px`) for CTAs/badges. Soft shadows, not hard borders.
- **Elevation:** Three-layer shadow system — emphasized (cards), elevated (popovers), dragged.
- **Philosophy:** Lighter, bolder, rounder. Generous whitespace, clear hierarchy, functional and joyful.
- **Dark interfaces:** Use dark mode tokens — bg `#1D1D1D`, layer-2 `#292929`, text `#E1E1E1`, borders `#3A3A3A`.

Read the full spec at `/Users/paolo/excat/nova/DESIGN.md` when building anything visual.

## Dev Server

Run with: `nohup npx astro dev --port 4325 > /tmp/astro-playground.log 2>&1 &` (nohup required — background tasks without it get killed)
