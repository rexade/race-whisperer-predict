# UI overhaul: mobile-first race reading

Date: 2026-08-30
Status: approved, ready for implementation planning

## Why

The app grew a UI for work that no longer happens in the browser. Calibration,
weight optimisation and MAE evaluation moved to the `scripts/` CLI, where the
honest train/holdout protocol lives, but their panels stayed — stacked on the
same single page as the race results, each behind its own toggle. The result is
one long page that mixes a betting workflow with dead developer tooling.

The stated problem is mobile: the app is read on a phone near post time, when
odds are moving and the analysis is worth re-running. That is the case the
current layout serves worst.

The actual workflow is three steps, and one of them exists only because the app
forgets: open the weight manager, press V42, analyse, read horses.

## Goals

- Make reading a race on a phone the thing the app is good at.
- Remove the UI that is no longer used.
- Cut the workflow from four steps to two.

## Non-goals

- **No change to predictions.** This is a presentation-layer change. The model
  pipeline, weights, and every service under `src/services/modernKm` and
  `src/services/calibration` are untouched. If a prediction changes, the work is
  wrong.
- No routing library, no state management library, no component library swap.
- No new features. Nothing here adds capability; it removes and rearranges.

## Decisions

Each was chosen by the user from mockups built with real race data.

| Decision | Choice | Rationale |
|---|---|---|
| Horse row | Compact, tap to expand | ~6 horses per screen against ~3 for a fully-expanded row. A 13-horse handicap field is unreadable otherwise. |
| Navigation | Leg tabs, one leg at a time | Full field for the leg being studied; never lose your place scrolling. Chosen over a card-overview grid. |
| Visual direction | Quiet light | Light theme with minimal chrome and tabular numerals. Dark themes wash out in daylight, and this is read outdoors. |
| Unused panels | Delete | Recoverable from git history. Keeping them behind a dev route preserves maintenance cost for code that has no user. |

## Structure

Single screen. No router — there is only ever one thing on display.

```
App
└─ V75Analyzer               kept under its current name, reduced (555 lines → ~200)
   ├─ AnalysisBar            date, game type, Analyse; collapses to a summary line after running
   ├─ LegTabs                one tab per leg, horizontally scrollable, swipeable
   └─ LegView                header: distance, start method, margin verdict
      └─ HorseRow ×N         collapsed by default, tap to expand
```

`V75Analyzer` keeps its filename and export. Renaming it would touch imports and
tests for no benefit, and the file is being reduced rather than replaced.

Leg count is derived from the fetched game, not hardcoded. V85 has eight legs,
V75 seven, V65 six; `LegTabs` renders whatever `fetchRaceDataForGame` returned.

## Deletions

Two clean dependency chains and three leaves. Nothing else imports them.

```
CalibrationPanel → useCalibration → calibration.worker
V75TimeCalculationDebug → V75RaceHistoryBreakdown
MAEPanel
V75CacheManager
PostPositionCurveEditor
```

Roughly 1,900 lines of components plus one worker.

`historicalCalibrationService`, `weightOptimizer`, `datasetSplits` and
`calibrationDatasetCache` **stay**. The CLI scripts import them, and that is
where calibration happens now. Only the browser surfaces go.

Tests belonging to deleted components are deleted with them. Tests covering
retained services are not touched.

## Leg view

**Collapsed row** — programme number, horse name, predicted km-time, odds,
spelprocent, and a strength bar so the shape of a race is scannable without
reading numbers.

The bar is scaled within the race, not globally: the fastest predicted time
fills it, the slowest shows a visible minimum, and the rest interpolate
linearly between them. Scaling against absolute km-times would make every bar in
a 1640m sprint look full and every bar in a 3140m stayer look empty, which
carries no information about who wins.

**Expanded row** — driver, spår, tillägg when the horse is behind the front
line, barefoot and shoe-change signals, confidence flags, and margin to the next
horse.

The programme number is the prominent numeral, not the rank. In a handicap race
`postPosition` restarts at each tillägg tier, so it is not an identifier; the
programme number is what appears on the card and on a ticket. Rank is implied by
row order.

**Leg header** carries the margin verdict — spik / favorit / öppet — from the
existing `legConfidence` in `raceRanking.ts`. No new logic.

## Visual system

- Light by default. `App.tsx` currently hardcodes `defaultTheme="dark"`; that
  flips to `light`. The existing theme toggle stays and dark mode must remain
  usable.
- Tabular numerals everywhere times, odds and percentages appear, so columns
  align down the list.
- Minimal borders, no card chrome. One accent colour, reserved for the leader.
- Touch targets at least 44px.

Token work lands in `tailwind.config.ts` and the CSS custom properties.

## Preset flow

Selecting a preset in the picker will also persist it via
`saveBrowserDefaultWeights`. `initWeightsFromApi` already prefers
`loadBrowserDefaultWeights()` over factory defaults and already skips the
persistence API on static deployments, so the mechanism exists — selection
simply never wrote to it.

This removes two steps from the workflow: pick V42 once, and it survives
reloads. On a frontend-only Vercel deployment there is no backend to persist to,
which is exactly why the browser default matters.

`WeightManager` (643 lines) reduces to a preset dropdown plus an "advanced"
disclosure for manual weight editing.

## Data flow

Unchanged. `fetchRaceDataForGame` → `calculateRawKmTimesForRaceWithId` →
`RaceResultProcessor.processRaceResult` → ranked `V75HorseResult[]`, computed in
`analysis.worker`. The overhaul consumes the same output through different
components.

## Testing

- The existing 308 tests must stay green. They cover services and utilities and
  should be unaffected; any failure means the change reached further than
  intended.
- New coverage: `legConfidence` → badge mapping, row collapse/expand behaviour,
  and preset selection persisting to the browser default.
- Manual check on a real handicap card, where `startNumber` and `postPosition`
  diverge and duplicate post positions exist. Today's V85 leg 1 at Bergsåker is
  a suitable case: three tillägg tiers, three horses at "spår 1".

## Risks

- **Light theme touches global tokens.** Dark mode has to be re-checked after,
  not assumed.
- **`V75Analyzer` at 555 lines does several jobs** — header, menu, panel
  toggling, analysis orchestration, results. Separating what stays from what
  goes is the fiddliest part of the work and the most likely place to break
  something unrelated.
- **Deleting `calibration.worker` removes in-browser calibration entirely.**
  This is intended and matches how the project already works, but it is a
  one-way door short of a git revert.

## Out of scope

- Tillägg display beyond the expanded row; showing "+20m" inline on collapsed
  rows needs a `raceDistance` prop threaded down and can follow later.
- Ticket building. The app reads races; constructing and costing a V85 ticket is
  a separate feature.
- Pool-value surfacing. The odds-versus-spelprocent signal is CLI-only today and
  bringing it into the UI is its own design question.
