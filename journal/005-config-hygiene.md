# 005 — Config Hygiene

**Date:** 2026-02-21
**Commit:** 348aca1

---

## Intent

The user noticed that CLAUDE.md was getting bloated with inlined content (the full design system summary) and corrected course: keep CLAUDE.md lean with short instructions that reference separate files for details.

## Prompts

> "don't bloat CLAUDE with massive content, keep the content well organised in separate files and just keep short instructions in CLAUDE referencing the actual files where all the details are kept"

> "add this note to CLAUDE obviously"

## What Happened

- Rewrote CLAUDE.md from 37 lines to 17 lines
- Removed the inlined Spectrum 2 design summary (colors, typography, spacing, etc.)
- Replaced with a one-line reference: "read and follow `/Users/paolo/excat/nova/DESIGN.md`"
- Added "Don't bloat this file" as a persistent rule so future conversations don't repeat the mistake
- The rule itself is self-referential: CLAUDE.md now governs its own growth

## Outcome

CLAUDE.md is clean and scannable. It contains only: purpose, rules (4 bullet points), tech stack (1 line), and operational notes (1 line). All detail lives in dedicated files.

## Reflections

- **The user is instinctively applying information architecture.** Without being asked, they separated concerns: config (CLAUDE.md) vs. spec (DESIGN.md) vs. process (journal.md). This is what CMS architects do — define where different types of content live. The difference: no schema, no content model, just common sense expressed as a correction.
- **"Add this note to CLAUDE obviously" is a telling moment.** The user now treats CLAUDE.md as the project's brain and expects it to self-govern. They didn't say "add a rule" or "update the config" — they said "obviously." It's become intuitive.
- **Configuration sprawl is a real risk in LLM-managed projects.** Without the user catching this, CLAUDE.md would have grown into an unmanageable blob — just like CMS configurations do. The discipline has to come from the human. The AI doesn't naturally resist bloat; it tends toward inclusion. This is a governance gap.
