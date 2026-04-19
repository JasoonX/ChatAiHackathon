# Design System — Chatty Video

## Style Prompt

Dark premium tech aesthetic with glowing teal accents. Clean typography, subtle depth through gradients, and confident motion. Think modern SaaS product launch — bold but not flashy. The vibe is "professional developer tool" not "gaming". Smooth transitions, subtle ambient glow effects.

## Colors

- `#0B1426` — Background (dark navy-black)
- `#0F1B2D` — Background secondary (cards, panels)
- `#2DD4BF` — Primary accent (teal, used for highlights)
- `#22D3EE` — Secondary accent (cyan, subtle glows)
- `#F1F5F9` — Primary text (off-white)
- `#94A3B8` — Secondary text (slate gray)
- `#1E293B` — Border/divider (subtle slate)

## Typography

- Headlines: **Inter** (700-800 weight)
- Body/labels: **Inter** (400-500 weight)
- Code/tech: **JetBrains Mono** (500 weight)

## Motion

- Ease: `power3.out` for entrances, `power2.inOut` for transitions
- Duration: 0.4-0.6s entrances, 0.3s staggers
- Stagger: 0.08-0.12s between elements
- Transitions: Push slide (primary), blur crossfade (accent)

## What NOT to Do

- No neon glow overload — one subtle glow per scene max
- No gradient text effects
- No pure black (#000) — always use the tinted navy
- No bounce/elastic easing — keep it professional
- No rotating/spinning animations — use translate and scale only
