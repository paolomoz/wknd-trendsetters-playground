# Journal 015 — Content Neural Network

**Date:** 2026-02-22
**Session type:** Content analysis tooling (script creation + API integration + interactive visualization)

## What the User Wanted

Build a semantic content graph showing how the site's ~112 individual content pieces relate to each other across pages. The site has trend cards, articles, testimonials, personas, FAQ items, blog posts, and more spread across 16 pages — but no way to see connections between them. For example, a summer t-shirt card on the catalog page and a fashion trend article about summer t-shirts are semantically linked but structurally separate. The user wanted an interactive force-directed visualization to explore, search, and discover these cross-page relationships.

## What Claude Code Did

### Architecture

Followed the existing `pagespeed-collect.mjs → data/pagespeed/ → reports/pagespeed.html` pipeline pattern:

```
scripts/content-neural-network.mjs → data/content-graph/*.json → reports/content-neural-network.html
```

### Step 1: Content Extraction (108 nodes)

Built a zero-dependency extraction engine that parses `.astro` frontmatter and template HTML plus `.md` blog posts. The script uses regex to extract JS arrays (articles, categories, tabs, testimonials, FAQ items, lookbook items, etc.) and component props (Hero, CTA). Each extracted piece becomes a node with type, title, text, page, and optional metadata (category, persona, href).

Node count by type:
- feature: 23, trend: 16, article: 12, cta: 10, hero: 8, persona: 8, faq: 8, testimonial: 8, gallery: 7, blog: 5, lookbook: 3

### Step 2: Voyage AI Embeddings

Called `voyage-3-lite` model (512 dimensions) to embed all 108 texts in a single batch. Each text = `title + ". " + text`, truncated to 2000 chars. Implemented MD5-based cache so re-runs only re-embed changed content.

### Step 3: Similarity + Graph Assembly

**Semantic edges:** Computed cosine similarity for all 5,778 pairs (108 * 107 / 2). At threshold >= 0.45, found 4,643 semantic connections. The high count reflects that this is a single-topic fashion site — content is naturally similar across pages. Set the display default to 0.55 for manageable initial render (~1,800 visible edges), with slider for adjustment.

**Structural edges** (197 total):
- `same-page`: 156 edges connecting hero/CTA anchors to content on their page
- `same-persona`: 8 edges linking people like Alex Rivera across home tabs, case study tabs, and testimonials
- `same-category`: 21 edges connecting content with matching category tags across pages
- `linked`: 12 edges connecting ArticleCard href attributes to their target blog posts

### Step 4: Interactive Report (D3 v7)

Generated a self-contained HTML file with:
- Force-directed graph with colored nodes (by content type) and sized by connection count
- Semantic edges as solid lines with opacity mapped to similarity weight
- Structural edges as dashed lines color-coded by relationship type
- Control bar: search (300ms debounce), type filter pills, edge-type checkboxes, similarity threshold slider
- Detail panel sliding in from right showing node content + all connections sorted by weight
- Hover: highlights connected nodes/edges, fades everything else to 10%
- Drag with fix-on-release, double-click to release
- Zoom/pan via D3 zoom behavior + reset button
- Keyboard: Escape closes detail panel

### Step 5: Integration

Updated all touchpoints:
- `package.json`: added `content-graph` and `content-graph:report` scripts
- `reports/README.md`: registered in manifest (category: content, related: content-gaps, brand-assessment)
- `reports/hub.html`: added timeline entry with content badge
- `reports/mindmap.html`: added node with edges to hub, content-gaps, and brand-assessment
- `CLAUDE.md`: added operational note about running after content changes

### Artifacts Created or Modified

| File | Action | Purpose |
|---|---|---|
| `scripts/content-neural-network.mjs` | Created | Full pipeline: extract + embed + compute + report |
| `data/content-graph/nodes.json` | Created | 108 extracted content nodes |
| `data/content-graph/embeddings.json` | Created | Voyage AI vector embeddings (512d) |
| `data/content-graph/graph.json` | Created | Assembled graph with nodes + edges + stats |
| `reports/content-neural-network.html` | Created | Interactive force-directed visualization |
| `package.json` | Modified | Added npm scripts |
| `reports/README.md` | Modified | Registered in manifest |
| `reports/hub.html` | Modified | Timeline entry + content badge style |
| `reports/mindmap.html` | Modified | New node + 3 edges + content legend |
| `CLAUDE.md` | Modified | Added content-graph operational note |

## Thesis Reflections

This session demonstrates a capability that traditional CMS platforms simply don't have: **automated semantic analysis of content relationships**. No CMS will extract all your content, embed it with a neural model, compute cross-page similarity, and generate an interactive graph visualization — certainly not from a single prompt.

The Content Neural Network reveals something interesting about this site's content: with an average semantic similarity of 0.585 across all pairs, the content is highly cohesive but also potentially repetitive. The same themes (tennis style, beach vibes, party nights) echo across heroes, trend cards, articles, and blog posts. A content strategist would need hours of manual review to discover this — the LLM pipeline surfaces it in seconds.

The structural edges add another dimension CMS can't easily provide: cross-referencing content by persona identity, category tags, and hyperlink targets. The fact that Alex Rivera appears in home tabs, case study tabs, and testimonials — and the graph shows these connections visually — is the kind of content intelligence that would require custom development in a traditional CMS.

This is no longer just "an LLM editing files." It's building analytical tooling that would normally require a dedicated content intelligence platform — Siteimprove, ContentKing, or similar SaaS products costing thousands per year. The LLM built a comparable capability (tailored to this specific site) in a single session.
