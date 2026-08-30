# Mobile-First UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the unused developer panels, make reading a race on a phone the thing the app is good at, and cut the user's workflow from four steps to two.

**Architecture:** Presentation-layer only. Delete two dependency chains and three leaf components, extract the one piece of new display logic (field-relative strength) as a pure function next to the existing ranking helpers, rebuild the horse row around collapse/expand, and flip the already-written light theme to be the default. No service, worker, or model code changes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, shadcn-ui, vitest (node environment — no DOM testing library is installed and this plan does not add one).

**Spec:** `docs/superpowers/specs/2026-08-30-ui-overhaul-design.md`

## Global Constraints

- **No prediction may change.** Every service under `src/services/modernKm` and `src/services/calibration` is untouched. If a predicted time or rank differs after this work, the implementation is wrong.
- `historicalCalibrationService`, `weightOptimizer`, `datasetSplits` and `calibrationDatasetCache` must remain — the `scripts/` CLI imports them. Only their browser surfaces are deleted.
- All 308 existing tests must stay green, minus those belonging to deleted components.
- Tests target pure functions, not React rendering. `vitest.config.ts` uses `environment: 'node'` and `@testing-library/react` is **not** a dependency. Do not add one.
- `npx tsc -p tsconfig.app.json --noEmit` must pass, and `npm run lint` must report **0 errors** (warnings are pre-existing and acceptable).
- Swedish UI copy stays Swedish (`Spår`, `Lopp`, `VÄRDE`, `barfota`). Do not translate existing strings.

---

### Task 1: Delete the unused panels

Removes ~1,900 lines with no user. Two chains plus three leaves; nothing else imports them (verified with `grep -rln`).

**Files:**
- Delete: `src/components/calibration/CalibrationPanel.tsx`
- Delete: `src/components/calibration/useCalibration.ts`
- Delete: `src/workers/calibration.worker.ts`
- Delete: `src/components/v75/components/MAEPanel.tsx`
- Delete: `src/components/v75/components/V75CacheManager.tsx`
- Delete: `src/components/PostPositionCurveEditor.tsx`
- Delete: `src/components/v75/components/V75TimeCalculationDebug.tsx`
- Delete: `src/components/v75/components/V75RaceHistoryBreakdown.tsx`
- **Keep** `src/services/calibration/__tests__/marketBaseline.test.ts` — it covers `historicalCalibrationService`, which stays for the CLI. Do not delete it.
- Modify: `src/components/V75Analyzer.tsx` (imports at 32–36, toggles and panel blocks at 494–536)
- Modify: `src/components/WeightManager.tsx` (removes the `PostPositionCurveEditor` import and its usage)
- Modify: `src/components/v75/components/CompactHorseRow.tsx` (removes the `V75TimeCalculationDebug` import and usage)

**Interfaces:**
- Consumes: nothing.
- Produces: `V75Analyzer` no longer accepts or passes `onPostPositionCurvesChange` to `WeightManager`; `WeightManagerProps` loses `onPostPositionCurvesChange`.

- [ ] **Step 1: Confirm nothing outside the delete set imports these**

```bash
for f in CalibrationPanel useCalibration calibration.worker MAEPanel V75CacheManager PostPositionCurveEditor V75TimeCalculationDebug V75RaceHistoryBreakdown; do
  echo "--- $f"; grep -rln "$f" src/ --include=*.ts --include=*.tsx | grep -v "$f\."
done
```

Expected: only `V75Analyzer.tsx`, `WeightManager.tsx`, `CompactHorseRow.tsx`, and members of the delete set itself. If anything else appears, stop and report it.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/calibration/CalibrationPanel.tsx \
       src/components/calibration/useCalibration.ts \
       src/workers/calibration.worker.ts \
       src/components/v75/components/MAEPanel.tsx \
       src/components/v75/components/V75CacheManager.tsx \
       src/components/PostPositionCurveEditor.tsx \
       src/components/v75/components/V75TimeCalculationDebug.tsx \
       src/components/v75/components/V75RaceHistoryBreakdown.tsx
```

- [ ] **Step 3: Delete tests belonging only to deleted components**

```bash
ls src/components/calibration/__tests__/ 2>/dev/null
```

Delete any test file under `src/components/calibration/__tests__/` that imports `useCalibration` or `CalibrationPanel`. **Do not** delete `src/services/calibration/__tests__/marketBaseline.test.ts` — it covers `historicalCalibrationService`, which stays.

- [ ] **Step 4: Strip the references**

In `V75Analyzer.tsx`: remove the `lazy(...)` imports for `V75CacheManager`, `MAEPanel` and `CalibrationPanel`; remove `showCacheManager` state and every block guarded by it; remove the `CalibrationPanel` block. Keep `V75Results` and `WeightManager`.

Two consequences that are easy to miss:

- **The MAE badge in the masthead (~line 201) calls `setShowCacheManager(true)`** and becomes dead once the cache manager is gone. Remove the whole `{maeStats && (<button …>)}` block, the `maeStats` state, the `getAggregateMAEStats()` call in the mount effect, and the `TrendingUp` import if nothing else uses it.
- **`postPositionCurves` state** feeds both the deleted `PostPositionCurveEditor` and `V75Results`/analysis. Trace it before removing: delete only the setter path that existed for the editor, and keep the value if it is still passed into the analysis call. If it is passed to `RaceResultProcessor` or the analysis worker, **keep it** — removing it would change predictions, which this plan forbids.

In `WeightManager.tsx`: remove the `PostPositionCurveEditor` import, its render block, and `onPostPositionCurvesChange` from `WeightManagerProps` and the destructure. Keep `applyPreset` writing curves into `onWeightsChange`'s sibling callback only if that callback still exists; otherwise drop the curve branch from `applyPreset`.

In `CompactHorseRow.tsx`: remove the `V75TimeCalculationDebug` import and its usage.

- [ ] **Step 5: Verify the build and tests**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run && npm run lint
```

Expected: tsc clean, tests pass (count may drop if calibration component tests existed), lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove browser panels for work that moved to the CLI

Calibration, weight optimisation and MAE evaluation happen in scripts/ now,
where the honest train/holdout protocol lives. Their panels stayed behind
toggles on the results page, so the app opened onto a mix of betting workflow
and tooling with no user.

Deletes two chains (CalibrationPanel to useCalibration to calibration.worker,
V75TimeCalculationDebug to V75RaceHistoryBreakdown) and three leaves. The
services stay: the CLI imports historicalCalibrationService, weightOptimizer
and datasetSplits, and only their browser surfaces go."
```

---

### Task 2: Persist a preset the moment it is selected

Removes two of the user's four steps. `initWeightsFromApi` already prefers `loadBrowserDefaultWeights()` and already skips the persistence API on static deployments — selection simply never wrote to it.

**Files:**
- Modify: `src/services/modernKm/weightConfig.ts`
- Modify: `src/components/WeightManager.tsx` (`applyPreset` ~line 199, `saveAsDefault` ~line 73)
- Test: `src/services/modernKm/__tests__/weightConfig.test.ts`

**Interfaces:**
- Consumes: `parseNormalizationWeights`, `loadBrowserDefaultWeights` from `weightConfig.ts`.
- Produces: `saveBrowserDefaultWeights(weights: NormalizationWeights): boolean` — writes to `localStorage.customDefaultWeights`, evicts `calibration_dataset_*` keys and retries once on a quota error, returns `true` on success and `false` if it could not save.

- [ ] **Step 1: Write the failing test**

Append to `src/services/modernKm/__tests__/weightConfig.test.ts`, inside the existing `describe('weight configuration', ...)`:

```ts
  it('saves weights as the browser default', () => {
    const ok = saveBrowserDefaultWeights({ ...DEFAULT_WEIGHTS, oddsLive: 2 });
    expect(ok).toBe(true);
    expect(loadBrowserDefaultWeights()?.oddsLive).toBe(2);
  });

  it('evicts calibration caches and retries when storage is full', () => {
    localStorage.setItem('calibration_dataset_6mo', 'x');
    let firstCall = true;
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'customDefaultWeights' && firstCall) { firstCall = false; throw new Error('QuotaExceededError'); }
      return real.call(this, k, v);
    });

    const ok = saveBrowserDefaultWeights({ ...DEFAULT_WEIGHTS, oddsLive: 3 });

    expect(ok).toBe(true);
    expect(localStorage.getItem('calibration_dataset_6mo')).toBeNull();
    expect(loadBrowserDefaultWeights()?.oddsLive).toBe(3);
    spy.mockRestore();
  });

  it('reports failure when storage cannot be written at all', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(saveBrowserDefaultWeights({ ...DEFAULT_WEIGHTS })).toBe(false);
    spy.mockRestore();
  });
```

Add `saveBrowserDefaultWeights` and `DEFAULT_WEIGHTS` to the file's existing imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/modernKm/__tests__/weightConfig.test.ts`
Expected: FAIL — `saveBrowserDefaultWeights is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/services/modernKm/weightConfig.ts`:

```ts
/**
 * Persist weights as this browser's default.
 *
 * Selecting a preset should survive a reload: on a frontend-only deployment
 * there is no backend to persist to, and initWeightsFromApi already prefers a
 * stored browser default over factory weights. Calibration datasets can fill
 * localStorage, so a quota failure evicts them and retries once rather than
 * silently dropping the user's choice.
 */
export function saveBrowserDefaultWeights(weights: NormalizationWeights): boolean {
  if (typeof localStorage === 'undefined') return false;
  const blob = JSON.stringify(weights);
  try {
    localStorage.setItem('customDefaultWeights', blob);
    return true;
  } catch {
    Object.keys(localStorage)
      .filter(key => key.startsWith('calibration_dataset_'))
      .forEach(key => localStorage.removeItem(key));
    try {
      localStorage.setItem('customDefaultWeights', blob);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/modernKm/__tests__/weightConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Call it from both places in WeightManager**

Import `saveBrowserDefaultWeights` from `@/services/modernKm/weightConfig`, then change `applyPreset` to persist the selection:

```ts
  const applyPreset = (preset: WeightPreset) => {
    setSelectedPreset(preset.name);
    onWeightsChange(preset.weights);
    if (preset.postPositionCurves && onPostPositionCurvesChange) {
      onPostPositionCurvesChange(preset.postPositionCurves);
    }
    // Selecting a preset IS choosing a default. Without this the choice is lost
    // on reload, which is why picking V42 every session was part of the routine.
    saveBrowserDefaultWeights(preset.weights);
  };
```

Replace the inline `localStorage.setItem` / eviction / retry logic in `saveAsDefault` with a call to `saveBrowserDefaultWeights(weights)`, keeping the existing success and failure toasts driven by its boolean return.

If Task 1 removed `onPostPositionCurvesChange`, drop that branch from `applyPreset`.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run
git add src/services/modernKm/weightConfig.ts src/services/modernKm/__tests__/weightConfig.test.ts src/components/WeightManager.tsx
git commit -m "Persist a preset when it is selected

initWeightsFromApi already prefers a stored browser default and already skips
the persistence API on static deployments, but selecting a preset never wrote
to it -- so V42 had to be re-picked every session, which is two of the four
steps in the user's routine.

saveBrowserDefaultWeights centralises the write, including the quota eviction
that saveAsDefault had inline, and applyPreset now calls it. Selecting a preset
is choosing a default; treating those as separate actions was the bug."
```

---

### Task 3: Field-relative strength, as a pure function

The one piece of genuinely new display logic. It lives beside the existing ranking helpers and is tested there, matching how this repo tests (services and utils, not rendering).

**Files:**
- Modify: `src/components/v75/utils/raceRanking.ts`
- Test: `src/components/v75/utils/__tests__/raceRanking.test.ts`

**Interfaces:**
- Consumes: `rankingScoreSeconds` from `raceRanking.ts`.
- Produces: `fieldStrength(seconds: number, fieldSeconds: number[]): number` returning 0.08–1. Task 4 consumes this to size the bar.

- [ ] **Step 1: Write the failing test**

Append to `src/components/v75/utils/__tests__/raceRanking.test.ts`:

```ts
describe('fieldStrength', () => {
  const field = [72, 73, 75];

  it('gives the fastest horse a full bar and the slowest the floor', () => {
    expect(fieldStrength(72, field)).toBeCloseTo(1, 5);
    expect(fieldStrength(75, field)).toBeCloseTo(0.08, 5);
  });

  it('interpolates linearly between them', () => {
    // 73 is 1/3 of the way from 72 to 75, so strength drops 1/3 of the range.
    expect(fieldStrength(73, field)).toBeCloseTo(1 - (1 - 0.08) / 3, 5);
  });

  it('scales within the race, not against absolute km-times', () => {
    // A slow stayer field and a fast sprint field must produce the same shape,
    // otherwise every bar in a 3140m race reads empty and says nothing.
    const sprint = [66, 67, 69];
    expect(fieldStrength(67, sprint)).toBeCloseTo(fieldStrength(73, field), 5);
  });

  it('gives every horse a full bar when the field is tied', () => {
    expect(fieldStrength(72, [72, 72])).toBeCloseTo(1, 5);
  });

  it('handles a single-horse field and non-finite input', () => {
    expect(fieldStrength(72, [72])).toBeCloseTo(1, 5);
    expect(fieldStrength(Number.NaN, field)).toBe(0);
    expect(fieldStrength(72, [])).toBe(0);
  });
});
```

Add `fieldStrength` to the file's existing import from `../raceRanking`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/v75/utils/__tests__/raceRanking.test.ts`
Expected: FAIL — `fieldStrength is not a function`.

- [ ] **Step 3: Implement it**

Append to `src/components/v75/utils/raceRanking.ts`:

```ts
/** Shortest bar drawn, so the slowest horse still reads as present rather than absent. */
const STRENGTH_FLOOR = 0.08;

/**
 * A horse's predicted time as a 0-1 bar, scaled within its own race.
 *
 * Ranking is a within-race problem. Scaling against absolute km-times would
 * make every bar in a 1640m sprint look full and every bar in a 3140m stayer
 * look empty, which carries no information about who wins. Fastest fills the
 * bar, slowest gets the floor, the rest interpolate.
 */
export function fieldStrength(seconds: number, fieldSeconds: number[]): number {
  if (!Number.isFinite(seconds)) return 0;
  const valid = fieldSeconds.filter(Number.isFinite);
  if (valid.length === 0) return 0;

  const fastest = Math.min(...valid);
  const slowest = Math.max(...valid);
  if (slowest === fastest) return 1;

  const position = (seconds - fastest) / (slowest - fastest);
  const strength = 1 - position * (1 - STRENGTH_FLOOR);
  return Math.max(STRENGTH_FLOOR, Math.min(1, strength));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/v75/utils/__tests__/raceRanking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/v75/utils/raceRanking.ts src/components/v75/utils/__tests__/raceRanking.test.ts
git commit -m "Add field-relative strength for the horse row bar

Scaled within the race rather than against absolute km-times: a 1640m sprint
and a 3140m stayer must produce the same shape, or every bar in the stayer
reads empty and tells you nothing about who wins."
```

---

### Task 4: Rebuild the horse row as collapsed-with-expand

**Files:**
- Modify: `src/components/v75/components/CompactHorseRow.tsx` (511 lines; the numeral block is at ~207–230 after the programme-number fix, the meta line at ~255)

**Interfaces:**
- Consumes: `fieldStrength` from Task 3; `V75HorseResult` (`startNumber?`, `postPosition`, `horseName`, `driverName`, `distance`, `confidence`, `shoesFront`, `shoesBack`, `betDistribution`, `modernNormalizedResult`).
- Produces: `CompactHorseRowProps` gains `fieldSeconds: number[]` (every horse's `rankingScoreSeconds` in this race) and `defaultExpanded?: boolean`.

- [ ] **Step 1: Add the expand state and the bar**

Collapsed content is: programme number (already the prominent numeral), horse name, predicted time, odds, spelprocent, and the strength bar. Everything currently rendered below the name — driver, spår, barefoot chip, confidence flags, value-pick chip, history-source badge — moves inside a block gated on `expanded`.

```tsx
const [expanded, setExpanded] = useState(defaultExpanded ?? false);
const strength = fieldStrength(rankingScoreSeconds(horse), fieldSeconds);
```

Wrap the row in a `<button>` (or a `div` with `role="button"`, `tabIndex={0}`, and an Enter/Space handler) that toggles `expanded`, carries `aria-expanded={expanded}`, and has a minimum height of 44px.

Render the bar under the collapsed line:

```tsx
<div className="h-[3px] rounded-sm bg-muted overflow-hidden mt-1.5" aria-hidden="true">
  <div className="h-full bg-primary" style={{ width: `${strength * 100}%` }} />
</div>
```

- [ ] **Step 2: Pass the field times from the parent, and add the leg verdict**

`V75RaceDetails.tsx` (38 lines) renders the rows. Compute once per race and pass down. Import `sortByPrediction`, `rankingScoreSeconds`, `winnerMargin` and `legConfidence` from `../utils/raceRanking`, and `horseResultKey` from `../utils/horseResultIdentity`:

```tsx
const sorted = sortByPrediction(race.horses);
const fieldSeconds = sorted.map(rankingScoreSeconds);
const margin = winnerMargin(sorted);
const verdict = legConfidence(margin);   // 'spik' | 'favorit' | 'oppet'
// ...
{sorted.map((horse, i) => (
  <CompactHorseRow key={horseResultKey(horse)} horse={horse} rank={i + 1} fieldSeconds={fieldSeconds} />
))}
```

Match the existing call site's props — do not drop `marginToNext` or `isValuePick` if they are already passed.

Render the verdict in the leg header above the rows, so the spik/open judgement is readable without decoding the coloured dot on the tab:

```tsx
const VERDICT_LABEL = { spik: 'SPIK', favorit: 'FAVORIT', oppet: 'ÖPPET' } as const;
// ...
<div className="flex items-center gap-2 mb-2">
  <span className="text-[10px] font-bold tracking-wide">{VERDICT_LABEL[verdict]}</span>
  {margin !== undefined && (
    <span className="text-xs text-muted-foreground">marginal +{margin.toFixed(1)}s</span>
  )}
</div>
```

This reuses `legConfidence` unchanged — no new ranking logic.

- [ ] **Step 3: Verify types and tests**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run && npm run lint
```

Expected: tsc clean, 0 lint errors, tests green.

- [ ] **Step 4: Check it against a real handicap card**

```bash
npm run dev
```

Open the app, analyse **2026-08-30 V85** (Bergsåker, leg 1 — three tillägg tiers, three horses at "spår 1"). Confirm: programme numbers match the ATG card (3 Kaboom, 2 Ice Cool Surprise, 13 Jubii Vang); bars descend down the list; tapping a row reveals driver, spår and form chips; the row is comfortably tappable on a narrow viewport.

- [ ] **Step 5: Commit**

```bash
git add src/components/v75/components/CompactHorseRow.tsx src/components/v75/V75RaceDetails.tsx
git commit -m "Collapse the horse row, expand on tap

Roughly six horses now fit a phone screen against three before, which matters
because a handicap field runs to thirteen. The strength bar carries predicted
time relative to the field, so the shape of a race is scannable without reading
any numbers; driver, spar and form chips cost one tap."
```

---

### Task 5: Drop the ticket overview from the results view

The chosen navigation is leg tabs. `KupongView` is the card-overview grid that was considered and not chosen; leaving it above the tabs means every leg is scrolled past twice.

**Files:**
- Modify: `src/components/v75/components/V75Results.tsx` (import, and the `<KupongView …/>` render at ~line 57)
- Delete: `src/components/v75/components/KupongView.tsx`

- [ ] **Step 1: Confirm nothing else imports it**

```bash
grep -rln "KupongView" src/ --include=*.tsx --include=*.ts | grep -v "KupongView.tsx"
```

Expected: only `V75Results.tsx`. If anything else appears, stop and report — do not delete.

- [ ] **Step 2: Remove it**

```bash
git rm src/components/v75/components/KupongView.tsx
```

Remove the import and the `<KupongView races={races} onSelectRace={onTabChange} />` line from `V75Results.tsx`. Leave the `Tabs` block untouched — it already implements the chosen navigation.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run && npm run lint
git add -A
git commit -m "Drop the ticket overview above the leg tabs

The card-overview grid was the navigation option not chosen; keeping it above
the tabs meant scrolling past every leg before reaching the one being read."
```

---

### Task 6: Make the light theme the default and quiet it down

`src/index.css` already defines a full light `:root` palette — currently a warm sepia. The chosen direction is quieter and more neutral, and the app never shows it because `App.tsx` hardcodes dark.

**Files:**
- Modify: `src/App.tsx:10` (`defaultTheme="dark"` → `"light"`)
- Modify: `src/index.css` (`:root` block starting ~line 45)

- [ ] **Step 1: Flip the default**

```tsx
<ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
```

Leave the existing theme toggle in place — dark mode must remain usable.

- [ ] **Step 2: Neutralise the light palette**

In the `:root` block, reduce the warm cast and lift contrast. Adjust `--background` from `40 45% 96%` toward a near-neutral `220 20% 98%`, and `--foreground` from `30 16% 12%` toward `222 15% 12%`. Move `--card`, `--muted`, `--border` and `--muted-foreground` the same direction so hues stay consistent. Keep one accent hue for `--primary` — it marks the leader and nothing else.

Do not edit the `.dark` block.

- [ ] **Step 3: Add tabular numerals**

Times, odds and percentages must align down the list. In `index.css`, add to the `.num` utility already used by the row and tabs:

```css
  .num { font-variant-numeric: tabular-nums; }
```

If `.num` already sets this, skip.

- [ ] **Step 4: Check both themes**

```bash
npm run dev
```

Analyse a card. Confirm in light: text contrast is comfortable, the leader accent is visible, bars read against the background. Toggle to dark and confirm nothing regressed — this is the risk the spec names.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run && npm run lint
git add src/App.tsx src/index.css
git commit -m "Default to the light theme and neutralise its palette

index.css already carried a full light palette; the app just never showed it,
because App.tsx hardcoded dark. This app gets read outdoors near post time,
where dark themes wash out. The warm sepia cast moves toward neutral and
numerals become tabular so times and odds align down a list. Dark mode is
untouched and stays available on the toggle."
```

---

### Task 7: Show what was analysed once the controls collapse

The spec lists an `AnalysisBar` that "collapses to a summary line after running". The responsive masthead already does most of this — on mobile it reduces to brand, chip and menu. What is missing is that after analysing, the collapsed state does not say *which* game and date you are looking at, so on a phone the header is unlabelled.

**Files:**
- Modify: `src/components/V75Analyzer.tsx` (masthead left block, ~line 199–221 after Task 1 removes the MAE badge)

**Interfaces:**
- Consumes: existing `gameType` and the selected date state, plus whatever flag already marks a completed analysis (the same condition that gates rendering `V75Results`).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the summary chip**

In the left masthead block, beside the brand, render a chip when results exist — replacing the space the MAE badge occupied:

```tsx
{races.length > 0 && (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs num text-muted-foreground">
    {gameType} · {analysisDate}
  </span>
)}
```

Use the actual state names present in the file — `races` and `analysisDate` here stand for whatever already holds the analysed result set and its date. Unlike the MAE badge this is not `hidden md:inline-flex`: the point is that it shows **on mobile**, where the controls are behind the menu.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run test:run && npm run lint
```

Then at a narrow viewport, analyse a card and confirm the header reads e.g. `TrotAnalyzer  V85 · 2026-08-30` with the controls collapsed behind the menu.

```bash
git add src/components/V75Analyzer.tsx
git commit -m "Label the collapsed header with the analysed game and date

On a phone the controls sit behind the menu, so after analysing, the masthead
said nothing about what was on screen. Takes the space the MAE badge occupied
before it was removed with the cache manager it opened."
```

---

## Verification

After every task:

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run test:run
npm run lint
```

`tsc` clean, tests green, **0 lint errors**.

Once all six are done, the prediction-unchanged constraint must be proven rather than assumed:

```bash
npx tsx scripts/predict.ts --date 2026-08-30 --type V85 --config data/cfg-ht-with-de.json
```

Compare the ranking against a run from before the overhaul. Any difference means presentation work reached into the model and must be found before merging.
