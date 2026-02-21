# 004 — Design System & Tooling Refinement

**Date:** 2026-02-21
**Commit:** a217805

---

## Intent

The user wanted two things: (1) a `/journal` slash command that works automatically without requiring manual input, and (2) a design system reference so that any visual interfaces Claude builds on the fly follow a consistent, professional aesthetic.

## Prompts

> "can we add a slash command for journalling?"

> "I want /journal to look back at the conversation and process what happened capturing my casual notes about what worked and what didn't, I don't want to tell /journal what to track"

> "can you run /journal automatically at every prompt?"

> "but how can you remember to do it even in new conversations? where are you tracking this instruction?"

> "/Users/paolo/excat/nova/DESIGN.md when you build interfaces on the fly make them based on this design, remember it"

## What Happened

### Slash command iteration
The `/journal` command went through three revisions in rapid succession:
1. **v1:** Required the user to pass arguments describing what happened. User rejected this — "I don't want to tell /journal what to track."
2. **v2:** Rewrote to be conversation-aware — it reviews the full chat history and extracts everything automatically. Optional `$ARGUMENTS` for casual notes.
3. **v3 (behavioral):** User asked for it to run automatically. Hooks couldn't do this (they run shell commands, not prompts). Solution: added the auto-journaling rule to `CLAUDE.md` instead, making it a persistent behavioral instruction rather than a triggered command.

### Design system integration
- User pointed to an external design spec (`/Users/paolo/excat/nova/DESIGN.md`) — a comprehensive Adobe Spectrum 2 / Nova design system document.
- Read the full 584-line spec covering colors, typography, spacing, shape, elevation, layout modes, components, motion, icons, accessibility, and dark mode.
- Distilled the key tokens into a compact reference section in `CLAUDE.md` so future conversations have the design language at hand without re-reading the full file.
- Included a pointer to the full spec for when deeper reference is needed.

## Outcome

The project now has three layers of persistent intelligence:
1. **`CLAUDE.md`** — behavioral rules (auto-journal, self-update) + design system + operational knowledge
2. **`.claude/commands/journal.md`** — manual `/journal` command as a fallback
3. **`journal/`** — the growing thesis narrative

## Reflections

- **The three-iteration pattern on `/journal` is classic UX discovery.** The user started with a vague need ("track things"), rejected the first implementation ("too manual"), refined the requirement ("do it yourself"), then discovered the infrastructure gap ("how do you remember?"). This is exactly what product teams go through — but it happened in minutes, not sprint cycles.
- **Design system as persistent memory is interesting.** In a CMS world, design consistency comes from templates, themes, and component libraries enforced by the platform. Here, it's a text file that says "follow these rules." The enforcement is conversational, not structural. It works — but it's fragile. If a future Claude instance skips reading the file, consistency breaks. CMS platforms don't have that failure mode.
- **The user is assembling an AI-native "CMS" piece by piece** — without calling it that. So far they've built: project config (`CLAUDE.md`), content auditing (the gap report), persistent memory (self-updating rules), design governance (Spectrum 2 reference), and documentation automation (auto-journaling). These are all CMS features, just expressed as natural language instructions instead of database schemas and admin panels.
- **Key thesis question emerging:** Is the fragility of text-file governance acceptable? A CMS enforces rules structurally (you can't publish without filling required fields). An LLM follows rules conversationally (it might forget). Where does this matter, and where doesn't it?
