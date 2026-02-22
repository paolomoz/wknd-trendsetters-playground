# Accessibility

## Philosophy

Accessibility is a direct expression of our brand value **Inclusivity** — "Everyone's welcome. No rules, no dress code for entry." If someone can't navigate our site, read our content, or interact with our components, we've failed that promise. WKND Trendsetters is for everyone: every device, every ability, every context.

We target **WCAG 2.1 AA** compliance as a minimum.

## Color & Contrast

### Contrast Requirements

| Text Type | Minimum Ratio | Standard |
|---|---|---|
| Body text (< 24px / < 18.66px bold) | 4.5:1 | WCAG AA |
| Large text (>= 24px / >= 18.66px bold) | 3:1 | WCAG AA |
| UI components & graphical objects | 3:1 | WCAG AA |

### Color Pairing Matrix

| Foreground | Background | Ratio | Result |
|---|---|---|---|
| `--color-black` (#000) | `--color-white` (#FFF) | 21:1 | Pass |
| `--color-black` (#000) | `--color-yellow` (#F4FE8B) | 14.7:1 | Pass |
| `--color-black` (#000) | `--color-lavender` (#CBD4FF) | 10.5:1 | Pass |
| `--color-black` (#000) | `--color-purple` (#F4E5FC) | 13.2:1 | Pass |
| `--color-black` (#000) | `--color-gray-100` (#F5F5F5) | 17.9:1 | Pass |
| `--color-white` (#FFF) | `--color-black` (#000) | 21:1 | Pass |
| `--color-white` (#FFF) | `--color-gray-700` (#404040) | 9.7:1 | Pass |
| `--color-gray-500` (#737373) | `--color-white` (#FFF) | 4.6:1 | Pass (body) |
| `--color-gray-500` (#737373) | `--color-black` (#000) | 4.6:1 | Pass (body) |
| `--color-gray-500` (#737373) | `--color-gray-100` (#F5F5F5) | 3.9:1 | Pass (large only) |

### Rules

- Never place `--color-gray-500` text on colored backgrounds (yellow, lavender, purple) without checking ratio.
- White text on `--color-gray-700` backgrounds is safe. White on `--color-gray-500` is not (3.4:1 — fails).
- All text on images must use an overlay gradient with minimum 60% opacity to ensure contrast.

## Focus Indicators

### Default Focus Ring

```css
:focus-visible {
  outline: 2px solid var(--color-black);
  outline-offset: 2px;
}
```

- Applied globally to all interactive elements: links, buttons, inputs, tabs, accordions.
- Uses `:focus-visible` (not `:focus`) to avoid showing rings on mouse clicks.
- Ring must not be clipped by `overflow: hidden` on parent containers.

### Inverse Sections

In `.inverse-section`, `.inverse-footer`, or any dark background context:

```css
.inverse-section :focus-visible,
.inverse-footer :focus-visible {
  outline-color: var(--color-white);
}
```

### Do / Don't

| Do | Don't |
|---|---|
| Use `:focus-visible` for keyboard-only rings | Remove outlines with `outline: none` |
| Keep 2px offset so ring doesn't touch element | Set outline-offset to 0 (looks cramped) |
| Use white ring on dark backgrounds | Use colored rings that clash with section backgrounds |

## Keyboard Navigation

### Global Patterns

| Pattern | Behavior |
|---|---|
| **Tab** | Move focus to next interactive element |
| **Shift + Tab** | Move focus to previous interactive element |
| **Enter / Space** | Activate focused element |
| **Escape** | Close open menus, modals, or overlays |

### Component-Specific

| Component | Keys | Behavior |
|---|---|---|
| **Navbar dropdown** | Enter/Space to open, Escape to close, Tab through items | Focus trapped within open dropdown |
| **Mobile menu** | Enter/Space to toggle, Escape to close | Focus returned to toggle button on close |
| **Tab section** | Arrow Left/Right to switch tabs | Focus moves with selection, panels update |
| **FAQ accordion** | Enter/Space to toggle | Native `<details>` handles this |
| **Footer links** | Tab through all links | Standard tab order |
| **Skip link** | Tab (first element) | Jump to main content |

## Semantic HTML

### Landmarks

Every page must include these landmarks:

| Landmark | Element | Notes |
|---|---|---|
| Banner | `<header>` or `role="banner"` | Navbar region |
| Navigation | `<nav aria-label="...">` | Each nav needs a unique label |
| Main | `<main id="main-content">` | One per page, skip-link target |
| Contentinfo | `<footer>` or `role="contentinfo"` | Footer region |

### Heading Hierarchy

- Every page starts with one `<h1>`.
- Headings never skip levels: h1 -> h2 -> h3, not h1 -> h3.
- Section headings within components use the correct level for their context.
- Visually styled headings (`.h3-heading` on an `<h2>`) use CSS classes for visual sizing — the HTML tag sets the document hierarchy.

### ARIA Requirements

| Context | Requirement |
|---|---|
| Decorative SVGs/icons | `aria-hidden="true"` |
| Icon-only buttons | `aria-label="descriptive action"` |
| Navigation regions | `<nav aria-label="unique name">` |
| Tab interfaces | `role="tablist"`, `role="tab"`, `role="tabpanel"` with `aria-selected`, `aria-controls`, `aria-labelledby` |
| Expandable content | `aria-expanded="true/false"` on trigger |
| Live content updates | `aria-live="polite"` for non-urgent, `aria-live="assertive"` for critical |

## Skip-to-Content Link

Every page includes a skip link as the first focusable element in `<body>`:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

- Visually hidden until focused (positioned off-screen, slides in on `:focus`).
- Targets `<main id="main-content">`.
- Styled prominently when focused: black background, white text, high z-index.

## Motion & Reduced Motion

### Default Motion

- Transitions limited to 300ms max for UI interactions.
- No autoplaying animations that can't be paused.
- Parallax effects use subtle values (< 20% scroll offset).

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- This removes all animations and transitions for users who request it.
- Applied globally — no component should override this.

## Accessible Writing

### Guidelines

- Write link text that makes sense out of context: "Read the style guide" not "Click here."
- Image `alt` text describes the content: "Alex Rivera wearing a neon green streetwear outfit at a skate park" not "photo" or "image."
- Decorative images get `alt=""` (empty alt, not missing alt).
- Form labels are always visible — don't rely on placeholder text alone.
- Error messages identify the field and explain how to fix the issue.

### Do / Don't

| Do | Don't |
|---|---|
| `alt="Jordan Ellis in a yellow blazer at a rooftop party"` | `alt="photo"` or missing alt entirely |
| `<a href="/blog">Read our latest posts</a>` | `<a href="/blog">Click here</a>` |
| Visible `<label>` for every form input | Placeholder-only inputs |
| "Email is required" next to the email field | "Error" with no context |
