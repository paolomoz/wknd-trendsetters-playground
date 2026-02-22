# Visual UI System

## Purpose

Every relevant artifact in this project gets a visual HTML interface designed for business users — not developers, not terminal users. These are standalone HTML files that open in a browser.

## Rules

- **Build a visual UI** for any artifact a business stakeholder would care about (reports, audits, brand guidelines, dashboards, validation results).
- **Follow the design system** at `/Users/paolo/excat/nova/DESIGN.md` for all visual UIs.
- **Register every UI** in the manifest below so the hub can find it.
- **Update existing UIs** when their underlying context changes — don't leave stale reports.
- **Hub navigation** (`hub.html`) provides two views:
  - **Chronological** — timeline of all UIs in creation order
  - **Mind map** — conceptual relationships between artifacts (brand → validation, content gaps → content expansion, etc.)

## Manifest

Each entry: `id`, `file`, `title`, `date`, `category`, `related` (IDs of connected artifacts).

```json
[
  {
    "id": "content-gaps",
    "file": "content-gaps.html",
    "title": "Content Gap Assessment",
    "date": "2026-02-21",
    "category": "audit",
    "summary": "Navigation link audit: 9 missing pages, 15 dead links, 3 orphan pages",
    "related": []
  },
  {
    "id": "brand-assessment",
    "file": "brand-assessment.html",
    "title": "Brand Assessment",
    "date": "2026-02-21",
    "category": "brand",
    "summary": "Brand identity coverage analysis: voice, visual, gaps, and proposal",
    "related": ["content-gaps"]
  },
  {
    "id": "brand-validation",
    "file": "brand-validation.html",
    "title": "Brand Guidelines Validation",
    "date": "2026-02-21",
    "category": "validation",
    "summary": "External validation: enterprise benchmark (7.5/10), GPT-4o review (8.5/10), industry maturity Level 3/5",
    "related": ["brand-assessment"]
  },
  {
    "id": "accessibility-iconography",
    "file": "accessibility-iconography.html",
    "title": "Accessibility & Iconography Compliance",
    "date": "2026-02-22",
    "category": "validation",
    "summary": "WCAG 2.1 AA compliance: accessibility 2→8, iconography 0→7. CSS enforcement, ARIA fixes, validation scripts.",
    "related": ["brand-validation", "brand-assessment"]
  },
  {
    "id": "pagespeed",
    "file": "pagespeed.html",
    "title": "PageSpeed Insights Assessment",
    "date": "2026-02-22",
    "category": "audit",
    "summary": "Google Lighthouse analysis across 15 pages (mobile): Perf 100, A11y 96, Best Practices 100, SEO 98",
    "related": ["content-gaps", "accessibility-iconography"]
  }
]
```

## Categories

- `audit` — Site assessments, gap analyses, compliance checks
- `brand` — Brand guidelines, validation, identity artifacts
- `content` — Content planning, calendars, editorial artifacts
- `infrastructure` — Deployment, hosting, technical reports
- `validation` — External reviews, scoring, benchmarks

## File Conventions

- Files live in `reports/` directory
- Filename: `{id}.html` (matches manifest ID)
- Each file is fully self-contained (inline CSS, no external dependencies except Google Fonts)
- Open directly in a browser — no build step, no server required
