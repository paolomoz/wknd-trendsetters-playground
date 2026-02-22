# Journal 012 — Hub Split & Edge Animations

**Date:** 2026-02-22
**Session type:** UX improvement (navigation architecture + interaction design)

## What the User Wanted

The reports hub had timeline and mind map as tab views within a single `hub.html`. This broke browser back-button navigation: clicking a report card from either view, then pressing Back, always returned to the same page (defaulting to the timeline tab). The user wanted each view as a separate URL so Back returns to the correct view.

Three additional UX improvements were requested:
1. **Direction on "derived from" edges** — arrows needed more visibility to show derivation direction
2. **Remove hover overlay** — the detail popover repeated information already visible on node cards
3. **Animate relationships on hover** — connected edges should glow/pulse instead of only fading unrelated ones

## What Claude Code Did

### Artifacts Created or Modified

| File | Action | Purpose |
|---|---|---|
| `reports/hub.html` | Rewritten | Timeline-only page with `<a>` navigation links (no JS tabs) |
| `reports/mindmap.html` | Created | Mind map-only page with `<a>` navigation links, edge animations, no popover |

### Key Changes

**Navigation split:**
- Replaced `<button class="tab">` JS tabs with `<a>` navigation links between `hub.html` and `mindmap.html`
- Each page has `aria-current="page"` on its active nav link
- Back button now returns to the correct view since each is a distinct URL

**Mind map improvements:**
- Removed the `.map-detail` popover element and all related CSS/JS (`showDetail`, `hideDetail`, `badgeStyles`)
- Increased arrow marker size from 8×6 to 10×8 with higher opacity (0.5→0.7)
- Added `arrow-highlight` marker variant used during hover (12×9, full opacity)
- Connected edges glow on hover: derived edges pulse (`derivedPulse` keyframe — opacity + stroke-width breathing), related edges animate dashes (`dashFlow` keyframe — flowing `stroke-dashoffset`)
- Both animations use CSS `filter: drop-shadow()` for the glow effect
- All animations respect `prefers-reduced-motion`

### Process

1. Read the full 551-line `hub.html` to understand all CSS, HTML, and JS
2. Wrote `hub.html` as timeline-only with shared nav header
3. Wrote `mindmap.html` with all mind map code, removing popover, adding edge animations
4. Both pages share identical design tokens (self-contained HTML)

### What Worked

- **Clean separation** — each page is self-contained with no shared JS state, making the split straightforward.
- **CSS animations over JS** — the edge glow/pulse effects use pure CSS keyframes toggled by JS class names, keeping the interaction smooth and the code simple.
- **Progressive enhancement** — the arrows already existed; increasing their size and adding a highlight variant was a minimal change with big visual impact.

### What Could Be Better

- The design tokens are duplicated across both files. A shared CSS file or CSS custom properties import could reduce this, but for self-contained HTML reports the duplication is acceptable.
- The mind map entrance animation was simplified (removed the `animated` flag that prevented re-animation) since it now runs exactly once on page load.

## Thesis Reflections

This session touches a UX problem that CMS platforms solve with built-in URL routing and navigation state management. In a traditional CMS, each "view" would naturally be a separate page or route — the tab-within-a-page pattern was an LLM shortcut that traded proper navigation for implementation simplicity.

The interesting part: the user identified the broken back-button behavior — a classic usability issue — and the fix was a **structural change** (split one file into two) rather than a code patch (pushState hacks). An LLM can make this kind of architectural refactor in one shot, whereas in a CMS it might require reconfiguring templates, updating URL rules, and migrating content.

The edge animation work is pure interaction design — the kind of polish that makes a tool feel crafted rather than generated. A CMS would typically require a front-end developer for this. Here, the spec ("glow connected edges, flow dashes, pulse derived lines") translated directly into CSS keyframes and JS class toggling.

**Key insight:** LLMs can iterate on UX quality at the same speed as initial implementation. The split + animations took one conversation — no sprint planning, no design handoff, no front-end ticket. When the feedback loop is "describe what you want → see it built," UX polish stops being a luxury and becomes routine.
