# Chatty Design System — Reference

Tokens applied in `globals.css`. Components styled in `src/components/ui/`.

## Principles

- **Dark-first, OLED-black.** Pure #000 background; elevation via lighter neutrals, not shadows.
- **One accent, used sparingly.** Red-orange (#fe2c02) for CTAs, destructive state, brand dot. Never decorative.
- **Dense and functional.** 14px base, tight spacing, documentation-grade density. No ornament.
- **Generous radii, minimal borders.** Fully-rounded buttons/pills, 12px card corners, hairline borders.
- **Single type family.** Inter for all text. JetBrains Mono for code only.

## Color usage

| Role              | Token                          | Hex               |
| ----------------- | ------------------------------ | ----------------- |
| Page background   | `background`                   | #000000           |
| Cards, panels     | `card` / `secondary`           | #131313           |
| Overlays, hover   | `popover` / `muted` / `accent` | #1a1a1a           |
| Primary text      | `foreground`                   | #ffffff           |
| Secondary text    | `muted-foreground`             | #8a8f98           |
| Brand / CTA       | `primary` / `destructive`      | #fe2c02           |
| Links             | `info`                         | #7ba3ff           |
| Success / Warning | `success` / `warning`          | #3eb489 / #e0a94b |

Borders: conceptually `rgba(255,255,255,0.08)`, mapped to `hsl(0 0% 15%)`.

## Component conventions

**Buttons:** Primary = solid red, white text, 9999px radius, 8px 16px pad. Secondary = #131313, hairline border, rounded. Ghost = transparent, muted text. Hover lightens surface; focus = 2px red ring + 2px offset.

**Cards:** #131313 on #000. 1px hairline border. Radius 12px. ~20px padding. Inset highlight `inset 0 1px 0 rgba(255,255,255,0.04)`. Nested content uses #1a1a1a. No drop shadow.

**Inputs:** #131313 background. Radius 6px. 10px 12px padding. Focus: red border + red glow. Error: red border + red hint. Labels: 11px muted uppercase.

**Badges/Chips:** Pill (9999px). 11px/500. Semantic tones: 15% color-mix tinted background.

**Sidebar nav:** 13px muted, 8px 12px pad, 6-8px radius. Active: #1a1a1a + white text. Group labels: 10px uppercase +0.08em tracking.

**Code blocks:** #1a1a1a background. Radius 6-8px. Optional filename header. JetBrains Mono 12px, lh 1.55.

**Callouts:** 2px left border in semantic color. ~8% tinted background. Radius 8px.

**Modals:** Backdrop rgba(0,0,0,0.6) + blur(10px). Surface #1a1a1a. Radius 14px. Shadow `0 24px 64px rgba(0,0,0,0.6)`.

## Layout

- **Header:** 56px sticky, semi-transparent black + backdrop-blur(12px)
- **Sidebar:** 240-260px, sticky below header
- **TOC (right):** 220-240px, active = 2px red left border
- **Content:** max-width 760-860px prose
- **Page max:** 1200px

## Typography

| Role      | Size      | Weight | Tracking           |
| --------- | --------- | ------ | ------------------ |
| Display 1 | 56px      | 700    | -0.02em            |
| Display 3 | 28px      | 600    | -0.02em            |
| Display 4 | 20px      | 600    | 0                  |
| Body      | 14px/21px | 400    | 0                  |
| Caption   | 12px      | 400    | 0                  |
| Eyebrow   | 11px      | 600    | +0.08em, uppercase |

## What we are NOT

- No gradients in UI chrome. No heavy drop shadows. No sharp corners (min 6px).
- No filled icons — stroke only (Lucide, 1.5px). No emoji or decorative elements.
- No light mode defined (dark-only system).

## Styled shadcn components

All components in `src/components/ui/` are pre-styled to match this system:

- **Button** — rounded-full pills, 120ms transition, 2px red focus ring
- **Card** — inset top highlight, no drop shadow
- **Dialog** — backdrop-blur overlay, 14px radius, modal shadow
- **Input / Textarea** — 6px radius, secondary bg, red focus glow
- **Label** — xs muted text
- **Badge** — pill-shaped, semantic tone variants (success/warning/info)
- **Dropdown** — rounded-xl, modal shadow
- **Toaster** — dark theme hardcoded, card bg
