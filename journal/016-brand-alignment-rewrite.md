# Journal 016 — Brand Alignment & AI Rewrite

**Date:** 2026-02-22
**Session type:** Content compliance + AI-driven content creation (assessment → rewrite → image generation → report)

## What the User Wanted

Test whether the system can function as a complete brand compliance pipeline: take raw, off-brand content from a user and transform it into a publish-ready blog post that scores high against the brand guidelines. The user's exact framing:

> "I want to see how the system can fix and improve copy and images to make them aligned with the brand guidelines, so user can dump an idea and the system makes it perfectly formatted for the site."

The test content was a ~900-word flip flops article written in a literary/magazine style with a DepositPhotos stock image (watermark visible).

## What Claude Code Did

### Phase 1: Brand Alignment Assessment

Read all 9 brand guideline files (`brand/identity.md`, `voice.md`, `visual.md`, `logo.md`, `photography.md`, `content.md`, `social.md`, `accessibility.md`, `iconography.md`) and scored the submitted content across 5 dimensions:

| Dimension | Score | Key Issues |
|-----------|-------|------------|
| Voice & Tone | 3/10 | Literary/essayistic, no power words, no persona references, passive voice |
| Structure | 5/10 | Title not formula, 5-6 sentence paragraphs, no blockquote, no CTA |
| Image | 2/10 | Stock photo with watermark, no people, arranged props, JPG not AVIF |
| SEO | 4/10 | Missing frontmatter, no meta description, no category tag |
| Brand Values | 3/10 | Historical focus (4000 BC), hedging, no community language |
| **Overall** | **3.4/10** | Major rework required across every dimension |

Generated a detailed HTML report (`reports/brand-alignment.html`) with before/after comparison boxes, score rings, checklists, and a 10-point remediation plan.

### Phase 2: Content Rewrite

User prompt: "rewrite the article, generate a new image with Gemini 3 pro (keys in .env) and create a new report about that"

**Article rewrite.** Created `src/content/blog/flip-flop-summer-style.md` following all brand guidelines:
- **Voice:** Short sentences, contractions, fragments, 15+ brand power words (vibe, serve, fresh, own, rock, energy, effortless)
- **Personas:** Taylor Kim (featured section + direct quote), Jordan Ellis (blockquote), Casey Drew (comfort quote)
- **Structure:** Headline formula title, 2-3 sentence paragraphs, action-oriented subheadings, bullet lists, community CTA ending
- **Frontmatter:** Complete with all 8 fields (title, description, author, date, readTime, category, image, imageAlt)
- **Word count:** ~650 words (within 600-1000 range)

**Image generation.** Called Gemini 3 Pro Image API (`gemini-3-pro-image-preview` model) to generate 2 images:
1. **Hero:** Young woman laughing on beach at golden hour, carrying platform flip flops, breezy linen outfit — candid, warm, Instagram-feel
2. **Inline:** Three diverse friends walking through surf at sunset in colorful flip flops — social scene, movement, diverse representation

Both converted to AVIF (800px, quality 50): hero 20 KB, inline 28 KB. Total 48 KB vs original stock photo at 1.2 MB.

### Phase 3: Rewrite Assessment Report

Created `reports/brand-alignment-rewrite.html` showing the before/after transformation:

| Dimension | Before | After | Delta |
|-----------|--------|-------|-------|
| Voice | 3 | 9 | +6 |
| Structure | 5 | 10 | +5 |
| Image | 2 | 10 | +8 |
| SEO | 4 | 10 | +6 |
| Brand Values | 3 | 9 | +6 |
| **Overall** | **3.4** | **9.6** | **+6.2** |

All 14 original issues resolved. Report includes side-by-side text comparisons, image galleries, process timeline, and a thesis insight section.

## The Prompts

Two prompts to go from raw content to publish-ready:

1. "assess brand alignment of this content and generate a report about it" → AI read 9 brand files, scored 3.4/10, built detailed HTML report
2. "rewrite the article, generate a new image with Gemini 3 pro and create a new report about that" → AI rewrote content, generated 2 images, built comparison report

## Artifacts Created

| File | Type | Description |
|------|------|-------------|
| `src/content/blog/flip-flop-summer-style.md` | Blog post | On-brand rewritten article with proper frontmatter |
| `public/images/flip-flop-beach-style.avif` | Image | Hero: Gemini 3 Pro generated, candid beach style, 20 KB |
| `public/images/flip-flop-sunset-walk.avif` | Image | Inline: Gemini 3 Pro generated, diverse group, 28 KB |
| `reports/brand-alignment.html` | Report | Original assessment: 3.4/10 |
| `reports/brand-alignment-rewrite.html` | Report | Rewrite comparison: 3.4→9.6/10 |

## Thesis Reflections

This session demonstrated the most complete CMS-replacement workflow yet. The traditional pipeline for this task involves:

1. **Brand team** reviews submitted content against guidelines (manual, hours/days)
2. **Copywriter** rewrites based on feedback (manual, hours)
3. **Art director** briefs a photographer or searches stock libraries (manual, hours)
4. **Image editor** processes photos in Photoshop (manual, minutes-hours)
5. **Web developer** creates the blog post with proper frontmatter/SEO (manual, minutes)
6. **QA/brand reviewer** checks the final output against guidelines (manual, hours)

The LLM did all six roles in two prompts. The brand guidelines acted as the system's "institutional knowledge" — 9 markdown files that the AI reads and applies with more consistency than a human reviewer could, because it checks every guideline every time.

The image generation is particularly striking. The user provided a stock photo with a watermark — a licensing violation and brand violation simultaneously. The AI identified both problems, generated replacement images that matched the photography guidelines (candid, natural light, diverse subjects, young energy, real settings), and compressed them to brand spec. No Photoshop, no stock photo subscription, no image licensing.

**What CMS platforms offer that this doesn't (yet):**
- Workflow approvals (this was a single-user flow)
- Version control UI for non-technical users (git handles this but isn't user-friendly)
- Asset management at scale (DAM systems)
- Multi-language content management
- Scheduled publishing

**What this does that CMS platforms don't:**
- Automated brand compliance scoring against written guidelines
- AI copywriting that follows specific brand voice rules
- Image generation that follows specific photography direction
- Instant before/after assessment with detailed remediation
- Single-prompt content transformation across voice, structure, imagery, and SEO

The "dump an idea and get back a perfectly formatted post" workflow is what every CMS promises but none actually delivers. The CMS gives you a form to fill out. The LLM fills out the form for you — and writes better copy while doing it.
