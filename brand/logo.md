# Logo Guidelines

## Logo Elements

The WKND Trendsetters logo consists of two elements used together:

### 1. Icon (Star/Diamond Mark)
A 33x33 SVG of a rounded square containing a four-pointed star shape formed by intersecting arcs. The icon is geometric, modern, and distinctive at any size.

```svg
<svg width="33" height="33" viewBox="0 0 33 33">
  <path d="M28,0H5C2.24,0,0,2.24,0,5v23c0,2.76,2.24,5,5,5h23c2.76,0,5-2.24,5-5V5c0-2.76-2.24-5-5-5ZM29,17c-6.63,0-12,5.37-12,12h-1c0-6.63-5.37-12-12-12v-1c6.63,0,12-5.37,12-12h1c0,6.63,5.37,12,12,12v1Z" fill="currentColor"/>
</svg>
```

### 2. Wordmark
"FASHION BLOG" set in **Syncopate Bold**, uppercase, at `--text-sm` (0.875rem). This sits to the right of the icon.

## Logo Lockup

The icon and wordmark are displayed as a horizontal lockup:
- Icon size: 2rem × 2rem
- Gap between icon and text: `--space-xs` (0.5rem)
- Vertical alignment: center

## Color Variants

| Variant | Icon Color | Text Color | Background | Usage |
|---|---|---|---|---|
| Default | Black | Black | White/light | Primary usage, navbar |
| Inverse | White | White | Black/dark | Footer, dark sections |
| Accent | Black | Black | Neon Yellow | Special promotions (rare) |

## Usage Rules

### Do
- Maintain the icon-to-text proportion (2rem icon with sm text)
- Use the full lockup (icon + wordmark) in navigation and headers
- Icon alone is acceptable as a favicon or small-format identifier
- Ensure sufficient contrast against the background

### Don't
- Don't rotate, skew, or distort the icon
- Don't change the star shape inside the icon
- Don't use the wordmark without the icon in primary placements
- Don't set the wordmark in any font other than Syncopate
- Don't add effects (drop shadows, glows, outlines) to the logo
- Don't place the logo on busy image backgrounds without a solid backing
- Don't scale the icon below 16px — it loses legibility

## Clear Space

Maintain a minimum clear space around the full lockup equal to the icon height (2rem) on all sides. No other elements should encroach on this space.

## Favicon

The icon SVG is used as the site favicon at `public/favicon.svg`. It inherits the current color context.
