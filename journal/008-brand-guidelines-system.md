# 008 — Brand Guidelines System

**Date:** 2026-02-21
**Commit:** e3250d5

---

## Intent

After the brand assessment (session 007) concluded that the brand identity was strong enough to formalize, the user gave the green light to build the full system.

## Prompt

> "yes, build it"

Two words. That was the entire brief.

## What Happened

Built a complete brand guidelines system in `brand/` — 7 files, 610 lines:

1. **`identity.md`** — Defined mission, values, positioning, target audience, and 8 personas. The mission and values were synthesized from content patterns (they didn't exist explicitly before).
2. **`voice.md`** — Codified 4 voice pillars (Fresh, Bold, Real, Playful), tone spectrum across 7 contexts, power vocabulary, headline formulas, and do/don't examples.
3. **`visual.md`** — Formalized the complete design token system: 11 colors, 2 fonts, 10-step spacing scale, 5 radius values, 4 shadow styles, motion rules, and section variants. All extracted from `global.css`.
4. **`logo.md`** — Documented the SVG icon, wordmark, lockup rules, color variants, clear space, and forbidden treatments.
5. **`photography.md`** — Created art direction guidelines: subject categories, style rules (do/don't), technical specs (AVIF format, aspect ratios, border radius), and sourcing notes.
6. **`content.md`** — Defined page structure conventions, blog post rules, CTA conventions, SEO patterns, and a content calendar with 6 categories.
7. **`social.md`** — Per-platform guidelines for Instagram, X, Facebook, YouTube, LinkedIn, plus branded hashtags and community engagement rules.

Updated `CLAUDE.md` with a one-line reference: "Follow brand guidelines in `brand/`."

## Outcome

The project now has a complete, enterprise-grade brand governance system. Every future conversation that creates or modifies content will read these files first. The brand is enforceable by AI.

## Reflections

- **"Yes, build it" — two words generated 610 lines.** The compression ratio between human intent and AI output is staggering. A branding agency would need weeks of workshops, stakeholder interviews, and design reviews to produce equivalent documentation. Here it took one prompt and the existing codebase as input.
- **The brand was already there, just undocumented.** This is a key finding for the thesis. The CSS variables *are* the visual spec. The site copy *is* the voice guide. The image filenames *are* the art direction. An LLM's job wasn't to create the brand — it was to recognize it and write it down. This recognition ability is what makes LLMs uniquely suited for this work.
- **The system is both human-readable and AI-readable.** A branding agency would produce a PDF. A CMS would store brand rules in a database. Here, the guidelines are plain markdown — a human can read them in any text editor, and an AI can parse them in any conversation. This dual-readability is a genuine advantage over traditional brand management tools.
- **What's missing: enforcement.** CMS brand centers can prevent off-brand content from being published (required fields, approved colors, template constraints). This system relies on Claude reading the files and following them. There's no structural enforcement — just behavioral compliance. The question for the thesis: is behavioral compliance good enough? In this experiment, it is. In a 50-person marketing team, maybe not.
- **The content calendar in `content.md` is forward-looking.** We haven't created content yet, but the system is ready to govern it. This is architectural thinking — the same kind that CMS implementations require. The user instinctively chose to establish the rules before creating the content. That's enterprise discipline, applied through an LLM.
