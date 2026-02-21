# Visual Identity

## Aesthetic Direction

**Bold, contemporary, high-contrast.** Black-and-white foundation with neon yellow energy. The look is editorial fashion magazine meets Gen-Z streetwear blog. Generous whitespace, uppercase headings, and playful shadow interactions.

## Color Palette

### Primary

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| Black | `#000000` | `--color-black` | Text, buttons, borders, inverse backgrounds |
| White | `#FFFFFF` | `--color-white` | Backgrounds, inverse text |
| Neon Yellow | `#F4FE8B` | `--color-yellow` | Accent highlights, tags, accent sections |

### Secondary

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| Lavender | `#CBD4FF` | `--color-lavender` | Soft accents, decorative elements |
| Purple | `#F4E5FC` | `--color-purple` | Soft accents, decorative elements |

### Neutrals

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| Gray 100 | `#F5F5F5` | `--color-gray-100` | Secondary section backgrounds |
| Gray 200 | `#E8E8E8` | `--color-gray-200` | Borders, dividers |
| Gray 300 | `#D4D4D4` | `--color-gray-300` | Muted borders |
| Gray 500 | `#737373` | `--color-gray-500` | Secondary text |
| Gray 700 | `#404040` | `--color-gray-700` | Dark UI elements |
| Gray 900 | `#171717` | `--color-gray-900` | Deep text |

### Color Rules
- **Never** use neon yellow for body text (contrast fail)
- **Always** pair neon yellow with black for legibility
- **Default** to black/white for primary content; color is for accent only
- Lavender and purple are subtle — use sparingly for visual variety, not emphasis

## Typography

### Fonts

| Role | Font | Source | Weights |
|---|---|---|---|
| Headings | **Syncopate** | Google Fonts | 400, 700 |
| Body | **Instrument Sans** | Google Fonts | 400, 500, 600, 700 |

### Type Scale

| Token | Size | Usage |
|---|---|---|
| `--text-xs` | 0.75rem (12px) | Tags, labels |
| `--text-sm` | 0.875rem (14px) | Nav links, buttons, captions |
| `--text-base` | 1rem (16px) | Body text |
| `--text-lg` | 1.125rem (18px) | Subheadings, emphasized body |
| `--text-xl` | 1.25rem (20px) | Large body, paragraph-xl |
| `--text-2xl` | 1.5rem (24px) | H4 |
| `--text-3xl` | 2rem (32px) | H3 |
| `--text-4xl` | 2.5rem (40px) | H2 |
| `--text-5xl` | 3.5rem (56px) | H1 (hero) |

### Typography Rules
- **All headings are uppercase.** This is non-negotiable — it's a core brand signature.
- H1 gets `-0.02em` letter-spacing for tightness
- H6 gets `0.05em` letter-spacing for openness
- Body line-height: 1.6. Heading line-height: 1.1.
- Font weight hierarchy: 400 (body) → 500 (nav/labels) → 600 (buttons) → 700 (titles/headings)

## Spacing

Based on a rem scale. All spacing is defined as CSS custom properties.

| Token | Value | Usage |
|---|---|---|
| `--space-xxs` | 0.25rem | Micro spacing |
| `--space-xs` | 0.5rem | Tight gaps |
| `--space-sm` | 0.75rem | Small gaps |
| `--space-md` | 1rem | Default spacing |
| `--space-lg` | 1.5rem | Comfortable gaps |
| `--space-xl` | 2rem | Section internals |
| `--space-2xl` | 3rem | Large gaps |
| `--space-3xl` | 4rem | Section breaks |
| `--space-4xl` | 5rem | Major sections |
| `--space-5xl` | 8rem | Hero padding |

## Shape

| Context | Radius | Token |
|---|---|---|
| Small elements | 0.375rem | `--radius-sm` |
| Default (inputs) | 0.5rem | `--radius-md` |
| Panels, containers | 1rem | `--radius-lg` |
| Cards | 1.25rem | `--radius-card` |
| Buttons, tags, pills | 9999px | `--radius-full` |

## Shadows

| Element | Shadow | Character |
|---|---|---|
| Buttons | `4px 4px 0 0 black` | Hard, mechanical, print-inspired |
| Cards | `0 2px 8px rgba(0,0,0,0.08)` | Subtle, soft |
| Dropdowns | `0 8px 24px rgba(0,0,0,0.1)` | Elevated |
| Mega menus | `0 16px 48px rgba(0,0,0,0.12)` | Deep floating |

The button shadow is a **core brand signature**. It lifts on hover (-2px translate, shadow grows to 6px) and presses in on click (2px). This playful, mechanical interaction must be preserved.

## Motion

| Interaction | Duration | Easing |
|---|---|---|
| Small elements (links, icons) | 150ms | ease |
| Cards, menus, panels | 300ms | ease |
| Button hover | translate -2px, -2px | shadow growth |
| Card hover | translateY -4px | shadow appearance |
| Text button hover | gap expansion xs→sm | "reach" effect |

### Motion Rules
- Keep all transitions under 300ms — anything longer feels sluggish
- Hover effects should feel physical (lift, press, reach)
- No bounce or elastic effects — they conflict with the editorial tone
- Respect `prefers-reduced-motion`

## Section Variants

| Variant | Background | Text | Usage |
|---|---|---|---|
| Default | White | Black | Standard content |
| Secondary | Gray 100 (`#F5F5F5`) | Black | Alternating sections, subtle contrast |
| Inverse | Black | White | Bold statements, CTAs, footer |
| Accent | Neon Yellow (`#F4FE8B`) | Black | High-energy callouts (use sparingly) |

## Layout

- Container max width: **1200px**
- Container padding: **1.5rem** (1rem on mobile)
- Grid: 2-column default, with 1/3/4-column variants
- Breakpoints: 991px (tablet), 767px (mobile), 479px (small mobile)
