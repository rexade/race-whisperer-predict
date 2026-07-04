# Racing Program UI — mobile-first redesign

**Date:** 2026-07-04
**Status:** Approved (user selected direction B "Racing Program" and approved the full design in the visual companion)

## Problem

1. **Broken on phones:** the single-row toolbar packs brand + 4-button game switcher +
   date picker + analyze + export + 4 icon buttons, nearly all `flex-shrink-0`, into a
   fixed `h-14` row. On ~380 px screens it overflows; clipped buttons are unreachable.
   `index.html` also sets `maximum-scale=1.0, user-scalable=no`, so users cannot zoom
   to compensate.
2. **Generic look:** the current teal/shadcn styling reads as a default template.

Primary phone use case: **reading predictions at the track.**

## Design direction (validated visually)

**"Racing Program"** — Scandinavian racing-program editorial:

- **Day edition (light):** warm paper tones (`#faf7f1` family), near-black ink,
  burnt-orange accent (`#b3541e`), serif horse names (Georgia system stack),
  hairline rules, uppercase letter-spaced micro-labels.
- **Night edition (dark):** deep sepia (`#141210` family) with **amber** accent
  (`#ffb02e`) and phosphor-green positive signals (`#4fd598`) — Tote Board
  glanceability for track evenings. Winner card gets an amber border.
- Numerals always `tabular-nums`.

## Structural changes

### Navigation (the click-bug fix)
- **Mobile (< sm):** toolbar reduces to 3 elements — italic serif brand · one
  **game/date chip** (opens popover containing game-type switcher + date picker) ·
  **☰ menu** (Sheet with Weights, Calibration, Cache, Export, MAE stats, theme
  toggle). Nothing can overflow.
- **Analyze** becomes a full-width bar button under the header on mobile.
- **Desktop (≥ sm):** single-row toolbar retained (brand · switcher · date ·
  analyze · export · icons), restyled to the new theme.
- Remove `maximum-scale=1.0, user-scalable=no` from the viewport meta.

### Results view (the hero screen)
- Race tabs → horizontally scrollable **chip strip** ("Lopp 1…8"), 44 px+ targets,
  active chip underlined in accent.
- Race header: uppercase micro-label (distance · start method · race name).
- **Rank 1 gets an expanded card:** serif name, driver/spår line, predicted time,
  odds · spelprocent, **confidence bar** (margin to rank 2 normalized), margin
  label, barefoot badge; bordered card (ink border in day, amber in night).
- Ranks 2+: compact rows (rank numeral, serif name, driver line, right-aligned
  time + odds/spel), tap to expand existing detail content.
- **Barefoot/shoe-change badge:** uses `shoes.front/back` + `frontChanged/backChanged`
  (fields added 2026-07-04): "barfota ✓" green when barefoot, "barfota idag ✓" when
  switched today. Label language: Swedish (matches domain terms like spår/lopp).
- Every interactive element ≥ 44 px touch target on mobile.

### Out of scope
- Calibration panel / weight manager / curve editor redesign — they inherit the new
  tokens and get tap-target fixes only. Desktop-first tools remain desktop-oriented.
- No new fonts fetched from CDNs — system serif stack (Georgia) keeps the app
  self-contained and fast.

## Implementation map

| Piece | Files |
|---|---|
| Viewport fix | `index.html` |
| Theme tokens (day + night editions) | `src/index.css` |
| Toolbar/nav rework + mobile menu Sheet + game/date chip popover | `src/components/V75Analyzer.tsx` (+ small new `MobileMenu`/`GameDateChip` components) |
| Race chip strip | `src/components/v75/components/V75Results.tsx` |
| Horse rows + winner card + barefoot badge + confidence bar | `src/components/v75/components/CompactHorseRow.tsx`, `V75Summary.tsx` |
| Shared cards/status | `src/components/shared/analyzer/*` |

Existing shadcn primitives (Sheet, Popover, Tabs) are already in `src/components/ui/`.

## Verification

- `npm run build` + full vitest suite green (no logic changes intended).
- Manual: `npm run dev -- --host` and check on a real phone — all toolbar actions
  reachable, race chips scrollable, rows expandable, both themes.
