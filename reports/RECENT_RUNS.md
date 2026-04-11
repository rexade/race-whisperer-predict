# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

## Run 50 — 2026-04-11 — MUTATE

**Goal:** Lane 3 U1 — Dark foundation. App opened with ATG blue dark theme; replace with Pi Pulse near-black + cyan palette and default to dark mode.
**Done:**
- `src/index.css`: Replaced `.dark {}` block — background `#080808`, card `#0f0f0f`, primary/accent `#22d3ee` (188 86% 53%), foreground `#f1f5f9`, muted-foreground `#475569`, borders hairline dark gray.
- `src/App.tsx`: Changed `defaultTheme="system"` → `"dark"`, removed `enableSystem`. App now boots dark unconditionally.
- tsc --noEmit: clean. No type errors.
**Result:** pass
**Next:** U2 — Audit main panels (V75Analyzer header, tabs, WeightManager, MAEPanel) for lingering blue tints or white backgrounds leaking through. Patch at component level where tokens aren't enough.

<!-- stdout from run 42 2026-04-11 04:00 -->
Done. Here's what changed in Run 50:

---

**LANE 3 → U1 — Dark foundation**

**`src/index.css`** — replaced the `.dark {}` CSS variable block:
- `--background`: `225 65% 10%` (ATG dark blue) → `0 0% 3%` (`#080808`, pure black)
- `--card` / `--popover`: → `0 0% 6%` (`#0f0f0f`)
- `--primary` / `--accent`: `220 82% 46%` (ATG blue) → `188 86% 53%` (`#22d3ee`, Pi Pulse cyan)
- `--primary-foreground` / `--accent-foreground`: → `0 0% 3%` (dark text on cyan)
- `--foreground`: → `210 40% 96%` (`#f1f5f9`)
- `--muted-foreground`: → `215 19% 35%` (`#475569`)
- `--border` / `--input`: → `0 0% 10%` (hairline dark gray, approximating `rgba(255,255,255,0.07)`)
- `--ring`: → `188 86% 53%` (cyan)
- Sidebar and ATG semantic tokens updated consistently

**`src/App.tsx`** — `defaultTheme="system"` → `"dark"`, removed `enableSystem`. App boots dark unconditionally; ThemeToggle still works if users want light.

tsc: clean. Next: U2 — surface polish audit of component-level blue tints.

---

---

## Run 51 — 2026-04-11 — RESEARCH

**Investigated:** H1 full data-flow trace (galloped races invisible to form calculator) + U2 surface audit (hardcoded blue tints)

**Key finding:** Galloped race dates are never passed to the form calculator. `horseProcessing.ts` now returns `gallopCount` (Run 49 fix) but NOT `gallopDates`. `HorseRawKmTime.allTimes` contains only clean races — galloped/DQ are skipped at lines 108-120. `horseNormalizationProcessor.ts` builds `recentRaces` exclusively from `allTimes`. A horse that galloped last race gets the same form calculation as if that race never happened — potentially a +0.20–0.30 s scoring error in its favour.

**Implication:** With FORM_MAX_RECENT_RACES=5 and exponential weights (16,8,4,2,1), the most recent race carries 52% of the total form weight. A horse with 4 prior wins + 1 recent gallop: currently scores as near-perfect form (−0.32 s); with fix, ≈ −0.07 s. Gap ≈ 0.25 s — roughly 2–3 positions. This is the most impactful unfixed scoring bug.

**Secondary finding (U2):** Only ONE hardcoded blue Tailwind class across all component tsx files: `text-blue-600` at `PostPositionCurveEditor.tsx:172`. Everything else in V75Analyzer, WeightManager, MAEPanel, CompactHorseRow uses semantic token classes. U2 is a one-line fix, can bundle with H1.

**Suggested next move:** H1 mutate across 3 files + U2 one-liner:
1. `src/services/types/kmTimeTypes.ts` — add `gallopDates?: string[]` to `HorseRawKmTime`
2. `src/services/horseProcessing.ts` — after line 247, derive `gallopDates` from `recentTen` and include in return
3. `src/components/v75/utils/horseNormalizationProcessor.ts` — update param 7 type to `HorseRawKmTime | undefined`, inject `gallopDates` as `{ place: 15, date }` entries into `recentRaces` in both real and fallback code paths
4. `src/components/PostPositionCurveEditor.tsx:172` — `text-blue-600` → `text-muted-foreground`
5. Tests: add 1 to `horseProcessing.test.ts` (gallopDates populated), add 1 to `normalizationPipeline.test.ts` (recent gallop → non-negative form adj)


<!-- stdout from run 43 2026-04-11 05:00 -->
**Run 51 — Research complete.**

---

## What I found

### H1 — Galloped race dates invisible to form calculator (confirmed, quantified)

The bug is a **silent form override for horses that recently galloped**. The chain:

1. `horseProcessing.ts` lines 115-120: galloped races are `continue`d — they never enter `allTimes`
2. `horseNormalizationProcessor.ts` lines 193-201: `recentRaces` is built entirely from `allTimes`
3. `calculateFormAdjustment` sees no gallop → no penalty

**Impact:** With `FORM_MAX_RECENT_RACES=5` and exponential decay (`2^n` weights), the most recent race carries 52% of the total form weight. A horse with 4 wins + 1 recent gallop currently scores as near-perfect form (−0.32 s); with the fix it scores as mediocre (≈ −0.07 s). Gap ≈ **0.25 s**, roughly 2–3 positions in a close field. This is the highest-leverage unfixed scoring bug.

**Type annotation bonus:** The `rawTimeData` parameter in `applyHorseNormalization` is typed as a narrow inline type `{ allTimes?: ... }` but the function body already accesses `.gallopRate`, `.lastRaceDate`, `.consistencyScore` on it. The fix properly types it as `HorseRawKmTime | undefined`.

---

### U2 — Surface polish (complete, trivially small)

Only **one** hardcoded blue class exists across all component `.tsx` files: `text-blue-600` at `PostPositionCurveEditor.tsx:172`. Everything else already uses semantic token classes. U2 is a one-liner, bundled with H1.

---

### Next mutate: H1 + U2 bundle

3 source files + 1 UI file + 2 tests. Exact implementation plan is in `ACTIVE_THREADS.md`.

---

## Run 51 — 2026-04-11 — MUTATE

**Goal:** H1 + U2 bundle — inject galloped race dates into form calculator so a galloped last race is penalised (not silently ignored), plus fix last hardcoded ATG blue token.

**Done:**
- `src/services/types/kmTimeTypes.ts` — added `gallopDates?: string[]` to `HorseRawKmTime`
- `src/services/horseProcessing.ts` — computed `gallopDates` from `recentTen` (line 247), included in return object
- `src/components/v75/utils/horseNormalizationProcessor.ts` — widened `rawTimeData` param from narrow inline type to `HorseRawKmTime`; injected gallop entries as `{ place: 15, date }` in both code paths (fallback + real data); `calculateFormAdjustment` sorts by date so mixed-source entries work correctly
- `src/components/PostPositionCurveEditor.tsx:172` — `text-blue-600` → `text-muted-foreground` (U2 done)
- `src/services/__tests__/horseProcessing.test.ts` — 2 new tests: gallopDates contains gallop date; gallopDates empty when none
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — 1 new test: gallop-injected place=15 → adj +0.24 (penalty, not 0)

**Result:** pass — tsc clean, 139/139 tests pass

**Next:** LANE 1 evaluation — run MAE evaluator on recent dates with v2 weights, record Rank MAE + win% vs baseline (5.289 / 30.6%)

<!-- stdout from run 44 2026-04-11 06:00 -->
Run 51 complete. Here's what changed:

**H1 — Gallop dates injected into form calculator (highest-leverage scoring bug fixed)**

The bug: galloped races were skipped when building `allTimes` (clean races only), so a horse whose most recent race was a gallop got zero form penalty — a ~+0.25 s scoring error in their favour.

Fix across 3 files:
- `kmTimeTypes.ts` — added `gallopDates?: string[]` to `HorseRawKmTime`
- `horseProcessing.ts` — computes `gallopDates` from `recentTen` alongside `gallopCount`
- `horseNormalizationProcessor.ts` — widened `rawTimeData` param to `HorseRawKmTime`; injects gallop dates as `{ place: 15, date }` in both code paths before passing to `calculateFormAdjustment` (which already sorts by date, so ordering is correct). A recent gallop now adds **+0.24 s form penalty** instead of nothing.

**U2 — Last hardcoded blue token removed**: `PostPositionCurveEditor.tsx:172` `text-blue-600` → `text-muted-foreground`

**3 new tests** (horseProcessing: 2, normalizationPipeline: 1) — all 139 tests pass, tsc clean.

**Next:** LANE 1 evaluation — run the MAE panel on recent dates to compare v2 weights vs baseline (5.289 MAE / 30.6% win).

---

## Run 52 — 2026-04-11 — MUTATE

**Goal:** U3 — Accent propagation — replace ATG blue (hsl 214 series) in `:root` light-mode block with cyan (hsl 188) to match the dark mode Pi Pulse palette. LANE 1 evaluation is user-gated, so this was the right scoring-neutral work to do.

**Done:**
- `src/index.css` — `:root` light-mode block: replaced all `214` hsl series values with `188` (cyan hue)
  - `--primary`: `214 84% 22%` → `188 84% 22%`
  - `--primary-hover`: `214 84% 18%` → `188 84% 18%`
  - `--secondary-foreground`: `214 84% 22%` → `188 84% 22%`
  - `--accent`: `214 95% 45%` → `188 86% 45%`
  - `--accent-hover`: `214 95% 40%` → `188 86% 40%`
  - `--ring`: `214 95% 45%` → `188 86% 45%`
  - `--atg-navy`: `214 84% 22%` → `188 84% 22%`
  - `--atg-blue`: `214 95% 45%` → `188 86% 45%`
  - `--atg-light-blue`: `210 40% 90%` → `188 40% 90%`
  - `--sidebar-background`: `214 84% 22%` → `188 84% 22%`
  - `--sidebar-primary`: `214 95% 45%` → `188 86% 45%`
  - `--sidebar-accent-foreground`: `214 84% 22%` → `188 84% 22%`
  - `--sidebar-ring`: `214 95% 45%` → `188 86% 45%`
  - Updated block comments to reflect new palette

**Result:** pass — tsc clean, 139 tests pass

**Next:** LANE 1 evaluation — user must run MAE panel in browser on recent dates, compare v2 weights vs baseline (5.289 MAE / 30.6% win%). After that, H2 (top-2 time average) becomes the next scoring improvement.

<!-- stdout from run 45 2026-04-11 07:00 -->
Done. Here's what changed in Run 52:

**U3 — Accent propagation** (`src/index.css`)

Replaced all 13 ATG blue (`hsl 214`) values in the `:root` light-mode block with cyan (`hsl 188`), matching the dark mode's Pi Pulse palette:

- `--primary` / `--primary-hover` / `--secondary-foreground`: `214 84%` → `188 84%`
- `--accent` / `--accent-hover` / `--ring`: `214 95%` → `188 86%`  
- `--atg-navy` / `--atg-blue` / `--atg-light-blue`: updated to `188` hue
- Sidebar tokens (`--sidebar-background`, `--sidebar-primary`, `--sidebar-accent-foreground`, `--sidebar-ring`): all `214` → `188`

If a user ever toggles to light mode, they'll now see cyan instead of ATG corporate blue. Dark mode is unaffected. tsc clean, 139 tests pass.

**Next:** LANE 1 evaluation (user-gated) — open the MAE panel in the browser and run it on recent dates. Once that's recorded, H2 (top-2 time average) is ready to land.


<!-- stdout from run 46 2026-04-11 08:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 9am (Europe/Stockholm)