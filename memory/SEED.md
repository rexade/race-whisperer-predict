# Race Whisperer Predict — Project Seed

## What this is
A V75 horse race analysis tool. Users pick a race date, the app fetches ATG race data,
runs normalization/scoring logic across horses in each leg, and surfaces ranked picks.

## Stack
- React 18 + TypeScript + Vite
- Tailwind + shadcn/ui
- React Query for data fetching
- Vitest for tests

## Entry point
`src/App.tsx` → `V75Analyzer.tsx` (single-page, one main component)

## Core flow
1. User picks a date via `V75DatePicker`
2. `useGameInfo` + `useRaceData` (React Query) fetch from ATG API
3. `useV75Analysis` hook runs scoring/normalization
4. Results rendered via lazy-loaded `V75Results`
5. Weight tuning via `WeightManager`, position curves via `PostPositionCurveEditor`
6. Cache managed via `V75CacheManager`

## Key service layers
- `src/services/atgApi.ts` / `enhancedAtgApi.ts` — ATG data fetching
- `src/services/modernKm/` — km-time normalization (core scoring logic)
- `src/services/horseProcessing.ts` — horse stat aggregation
- `src/services/v75CacheService.ts` — local result caching

## Reference: v85-briefing-engine
A sibling Python project lives at `/home/admin/v85-briefing-engine/`. It is a V85 batch analysis engine with:
- `collect/atg.py` — ATG API fetching with 0.5s delay between requests and a cache layer
- `normalize/` — race and horse data normalization models
- `feature_extract/` — form, distance suitability, gallop reliability, equipment delta, pace model, lead chance, trip dependency
- `score/horse_scorer.py` + `round_scorer.py` — scoring and ranking pipeline
- `summarize_ai/` — Claude API briefing generation

This is useful as **reference for scoring algorithms and data models**, not to run directly.
- You may read any file in `/home/admin/v85-briefing-engine/` for ideas or logic to port
- Do NOT import or depend on it from race-whisperer-predict source
- Do NOT run `run_analysis.py` — it makes live API calls

## ATG API — DO NOT SPAM
The race data comes from the real ATG.se production API. It is not a test environment.
- **Never write scripts that call the ATG API in a loop or batch**
- **Never trigger API calls from tests or build steps**
- **Never add polling, auto-refresh, or scheduled fetching logic**
- If you need to test data handling, use existing cached/fixture data or mock the API
- One manual fetch by a real user in the browser = fine. Automated bulk calls = ban risk

## Pi Pulse directive
- Treat as isolated external project — do not touch Pi Pulse itself
- Improve one meaningful thing per run
- Keep the app working — never break the main analyzer flow
- Prefer UX clarity and data quality over feature additions
- Avoid random rewrites or complexity that doesn't serve the user

## Scoring pipeline
Single adjusted km-time output (lower = better). 13 factors in `applyModernKmNormalization` (`modernKm/index.ts`). Weights in `DEFAULT_WEIGHTS` (`modernKm/types.ts`), user-tunable via `WeightManager` → `localStorage`.
Full step-by-step reference: `memory/SEED_PIPELINE.md`

## Current weight snapshot (v2 — updated Run 46)
| Factor | Weight | Notes |
|---|---|---|
| `driverPerformance` | 1.0 | exact table value |
| `raceDistanceAdjustment` | 1.0 | reference distance scaling |
| `volteStartDistancePenalty` | 1.1 | standing start cost |
| `postPosition` | 0.9 | meaningful but not decisive |
| `form` | **0.8** | ↑ boosted — primary current-condition signal |
| `distanceAdjustment` | 0.8 | preferred vs race distance |
| `trackFamiliarity` | 0.6 | home track bonus |
| `layoffPenalty` | 0.6 | 21+ days rest |
| `placePercentage` | 0.6 | career place rate |
| `sulkyType` | 0.5 | American sulky advantage |
| `gallopRisk` | 0.5 | gait-break history |
| `ageFactor` | 0.5 | peak 5–7yo |
| `startPoints` | 0.5 | saturated log-scale rating |
| `consistencyFactor` | **0.5** | ↑ boosted — consistent finishers rank better |
| `shoeType` | 0.4 | barefoot advantage |
| `genderAdjustment` | 0.4 | mare penalty |
| `horseWinPercentage` | **0.2** | ↓ reduced — overlap with startPoints+place% |
| `earningsPerStart` | **0.1** | ↓ reduced — class/purse bias |

Form constants (v2):
- `FORM_SCALE_S`: 0.40 (↑ from 0.30) — wider impact range
- `FORM_MAX_RECENT_RACES`: 5 (↓ from 8) — tighter recency window
- Recency weighting: **exponential** `2^(n-i-1)` (↑ from linear) — most recent race = 52% of weight

## Primary direction — accuracy and trustworthy results

The codebase is clean. The pipeline works. The next phase is making the **output trustworthy**.

That means three things:

### 1. MAE feedback loop (weight grounding)
Current weights are educated guesses. To make them empirical:
- When user loads a race, store the predicted ranking per leg
- After the race runs, fetch the actual finishing order from ATG results
- Calculate rank MAE (mean absolute error) per leg, per session, per factor
- Store in local cache alongside race data
- Show in UI: "Model accuracy over last N V75 rounds"

This is the reasoning behind the MAE generator. It closes the loop between prediction and reality, and gives real data for weight tuning.

The `WeightManager` + `presetWeights.ts` setup is already in place. MAE data gives the user evidence to tune — instead of guessing that `driverPerformance: 1.4` is better than `1.0`.

### 2. Per-horse confidence and sanity flags
A horse ranked 1st with 2 career starts is not the same as one with 80. Surface this:
- **Sample size flag**: horse with < 5 starts = low confidence
- **Missing data flag**: no km time, no driver stats, no form data
- **Equipment change flag**: equipment this race differs from last race (already partially tracked)
- **Gallop risk flag**: high gallop rate in recent races = reliability concern
- **Data age flag**: last race > 90 days ago = stale form

These flags don't change the score — they let the user decide how much to trust it.

---

## What to focus on next (priority order)
1. **Evaluate Run 46 weights** — run the MAE evaluator on recent dates, compare Rank MAE and win% vs previous baseline (MAE 5.289 / win 30.6%). If improved → keep. If worse → revert and tune.
2. **MAE infrastructure** — prediction store + result comparison + error display
3. **Per-horse confidence flags** — sample size, missing data, equipment delta, data age
4. **Console cleanup** — `v75DataConsistencyValidator.ts` (20 calls) — do this opportunistically, not as a dedicated run

## Done (accuracy phase)
- [x] **Gallop reliability factor** — done (Run 22). `calculateGallopReliabilityPenalty` wired into pipeline, weight 0.8, tests pass.
- [x] **Weight rebalance v2** — done (Run 46). Boosted form signal (weight 0.8, scale 0.40, 5-race window, exponential recency). Reduced career-stat overlap (winPct 0.2, earnings 0.1). Boosted consistency (0.5). Goal: lower Rank MAE, increase win% without false verdicts.

## Known technical debt
- `equipmentCalculators.ts` is a thin wrapper over `robustEquipmentCalculators.ts` — redundant surface, harmless
