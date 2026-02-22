# Iconography

## Philosophy

Icons in WKND Trendsetters are **secondary to photography and typography**. They support navigation, clarify actions, and add subtle visual cues — they never compete with our hero imagery or bold headlines. Our icon style is minimal, editorial, and consistent.

## Grid & Canvas

| Property | Value |
|---|---|
| ViewBox | `0 0 24 24` |
| Live area | 20x20 (2px padding on all sides) |
| Pixel grid | Align strokes and shapes to the pixel grid |

All SVGs use a 24x24 viewBox regardless of display size. This ensures consistent stroke rendering across all size tokens.

## Style Rules

| Rule | Value |
|---|---|
| Style | Stroke-based (not filled) |
| Stroke width | 1.5px |
| Stroke caps | `round` (`stroke-linecap="round"`) |
| Stroke joins | `round` (`stroke-linejoin="round"`) |
| Fill | `none` (stroke-only icons) |
| Color | `currentColor` (inherits from parent text color) |

### Exceptions

- **Logo mark** — the brand star icon uses `fill="currentColor"` (it's a solid shape, not a stroke icon).
- **Social media icons** — platform logos use `fill="currentColor"` per their brand guidelines.

These exceptions are limited to brand marks. All UI/navigation icons follow the stroke rules.

## Size Scale

Five size tokens, mapped to CSS custom properties:

| Token | CSS Variable | Size | Usage |
|---|---|---|---|
| `xs` | `--icon-xs` | 12px (0.75rem) | Inline indicators, breadcrumb separators |
| `sm` | `--icon-sm` | 16px (1rem) | Button icons, inline text icons |
| `md` | `--icon-md` | 24px (1.5rem) | Default — nav icons, card icons, action buttons |
| `lg` | `--icon-lg` | 32px (2rem) | Featured icons, mega menu category icons |
| `xl` | `--icon-xl` | 48px (3rem) | Hero/section decorative icons |

### CSS Container Classes

```css
.icon    { width: 1.5rem; height: 1.5rem; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-xs { width: 0.75rem; height: 0.75rem; }
.icon-sm { width: 1rem; height: 1rem; }
.icon-md { width: 1.5rem; height: 1.5rem; }
.icon-lg { width: 2rem; height: 2rem; }
.icon-xl { width: 3rem; height: 3rem; }
```

Size classes (`.icon-xs` through `.icon-xl`) are modifiers applied alongside `.icon`.

## Icon Catalog

Current icons used across the site:

| Name | Location | Type | ViewBox | Notes |
|---|---|---|---|---|
| `icon-nav-menu` | Navbar (mobile toggle) | Stroke | 24x24 | Hamburger menu, 3 lines |
| `icon-nav-caret` | Navbar dropdowns | Stroke | 16x16 | Chevron down — should migrate to 24x24 |
| `icon-nav-arrow` | Navbar CTA, text buttons | Stroke | 16x16 | Right arrow — should migrate to 24x24 |
| `icon-brand-star` | Navbar logo, footer logo | Fill | 33x33 | Brand mark — exception, keep 33x33 |
| `icon-faq-plus` | FAQ accordion | Stroke | 24x24 | Plus sign, rotates to X on open |
| `icon-social-facebook` | Footer | Fill | 16x16 | Social — exception |
| `icon-social-instagram` | Footer | Fill | 16x16 | Social — exception |
| `icon-social-x` | Footer | Fill | 16x16 | Social — exception |
| `icon-social-linkedin` | Footer | Fill | 16x16 | Social — exception |
| `icon-social-youtube` | Footer | Fill | 16x16 | Social — exception |
| `icon-mega-category` | Mega menu items | Fill | 32x32 | Category icons — should migrate to stroke style |

## Naming Convention

`icon-{category}-{name}`

| Category | Examples |
|---|---|
| `nav` | `icon-nav-menu`, `icon-nav-caret`, `icon-nav-arrow` |
| `brand` | `icon-brand-star` |
| `social` | `icon-social-facebook`, `icon-social-instagram` |
| `ui` | `icon-ui-plus`, `icon-ui-close`, `icon-ui-search` |
| `faq` | `icon-faq-plus` |
| `mega` | `icon-mega-category` |

## Adding New Icons Checklist

1. **Check the catalog** — does an existing icon serve this purpose?
2. **Use 24x24 viewBox** — all new icons must use the standard canvas.
3. **Stroke-based** — 1.5px, round caps and joins, `fill="none"`.
4. **Use `currentColor`** — never hard-code a color value.
5. **Add `aria-hidden="true"`** — if the icon is decorative (most are).
6. **Add `aria-label`** — if the icon is the only content in a button/link.
7. **Update this catalog** — add the new icon to the table above.
8. **Test at all sizes** — ensure legibility at xs (12px) and visual weight at xl (48px).

## Migration Roadmap

Several existing icons don't meet the current spec. These should be migrated:

| Icon | Current Issue | Target |
|---|---|---|
| `icon-nav-caret` | 16x16 viewBox | Migrate to 24x24 |
| `icon-nav-arrow` | 16x16 viewBox | Migrate to 24x24 |
| `icon-mega-category` | 32x32, fill-based | Redesign as 24x24 stroke |
| Social icons | 16x16 viewBox | Keep as-is (platform brand exceptions) |

## Do / Don't

| Do | Don't |
|---|---|
| Use `currentColor` for all icon colors | Hard-code hex values in SVG attributes |
| Set `aria-hidden="true"` on decorative icons | Leave SVGs without accessibility attributes |
| Use the `.icon` container class for sizing | Set width/height directly on the `<svg>` element |
| Keep strokes at 1.5px for consistency | Mix stroke widths across icons |
| Align to 24x24 viewBox for new icons | Create icons at arbitrary canvas sizes |
| Pair icon-only buttons with `aria-label` | Rely on icons alone to convey meaning |
