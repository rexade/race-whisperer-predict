# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

## Run 56 — 2026-04-11 — RESEARCH

**Investigated:** H3 — field-size-blind form bands: full fix feasibility + pragmatic fix readiness

**Key finding:** `ATGHistoricalRecord` (atgHistoricalApi.ts) has **no `fieldSize` or `startCount` field** — confirmed by complete interface inspection. Field size for historical race records is structurally impossible to obtain: each per-horse historical record only contains the horse's own result, not total starters. Getting it would require one `/api/atg/races/{raceId}` call per historical race — 50-120 extra API calls per game round. Prohibited by no-spam directive. Full fix is **permanently blocked**.

MAE evaluation data (`mae-auto-2026-03-14.json`, 24 races) shows actual V85 field sizes: modal range 10-15 horses (median ~12). In a 12-horse field, 9th place = 4th from last — genuinely poor. In a 15-horse field, 9th place = 7th from last — borderline MID. The current threshold (11+) is too lenient for all these typical fields.

The pragmatic fix is safe: add `FORM_POOR_THRESHOLD = 9` constant, change `place >= 11` → `place >= FORM_POOR_THRESHOLD` in `performanceCalculators.ts:187`. Effect: 9th/10th finishes move from +0.12s to +0.24s. Existing test `'mixed results (2nd, 5th, 8th)'` unaffected — `place: 8` stays MID. Test for poor finishes uses `place: 12`/`15` — still passes.

**Implication:** The pragmatic fix is the only viable improvement for H3 — and it's correct for the modal field size. Two boundary tests needed: `place: 8` → MID, `place: 9` → POOR, `place: 10` → POOR. These guard the new threshold constant.

**Suggested next move:** MUTATE — `performanceCalculators.ts:187` + `normalizationConstants.ts` (add `FORM_POOR_THRESHOLD = 9`) + 3 boundary tests in `normalizationPipeline.test.ts`. One-liner logic change, new constant, 3 tests. tsc must pass.

<!-- stdout from run 51 2026-04-11 16:00 -->

---

## Run 56 — Research Complete

**Thread investigated:** H3 — field-size-blind form bands

### Key findings

**Full fix is permanently blocked.** `ATGHistoricalRecord` has no `fieldSize` or `startCount` field. Getting field size for historical races would require one `/api/atg/races/{raceId}` API call per historical race (~50-120 extra calls per game round). Prohibited.

**Pragmatic fix is the only option — and it's correct.** MAE evaluation data shows actual V85 field sizes: modal range 10-15 horses (median ~12). In a 12-horse field, 9th place = 4th from last, genuinely poor performance. Current threshold of 11+ for POOR is too lenient for all typical fields.

### Exact changes for the next mutate run

1. **`normalizationConstants.ts`** — add `FORM_POOR_THRESHOLD = 9 as const` in the recent-form section
2. **`performanceCalculators.ts:187`** — change MID band from `place >= 6 && place <= 10` → `place >= 6 && place <= 8`, so `else` (place >= 9) triggers POOR
3. **`normalizationPipeline.test.ts`** — 3 new boundary tests:
   - `place: 8` → MID (+0.12s) — boundary guard
   - `place: 9` → POOR (+0.24s) — new threshold
   - `place: 10` → POOR (+0.24s) — was MID, now POOR

All existing tests unaffected: `place: 8` stays MID, `place: 12`/`15` still POOR. Three files, one logic line, one constant, three tests.

---

## Run 57 — 2026-04-11 — MUTATE

**Goal:** H3 — POOR band threshold fix. Research (Run 56) confirmed the pragmatic fix is correct and all exact changes were pre-specified.

**Done:**
- `src/services/modernKm/normalizationConstants.ts` — added `FORM_POOR_THRESHOLD = 9 as const` with calibration comment; updated `FORM_SCORE_MID` doc comment to reflect 6–8 range
- `src/services/modernKm/performanceCalculators.ts` — imported `FORM_POOR_THRESHOLD`; changed MID band from `place <= 10` → `place <= FORM_POOR_THRESHOLD - 1` (i.e. ≤ 8)
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — 3 new boundary tests: place=8 → MID +0.12s, place=9 → POOR +0.24s, place=10 → POOR +0.24s

**Result:** pass — tsc clean, 156/156 tests pass (up from 153)

**Next:** H4 step 2 — lower `LAYOFF_THRESHOLD_DAYS` 21→14 (hold; needs MAE data). Or run eval-mae.mjs on more dates to grow accuracy corpus.

<!-- stdout from run 53 2026-04-11 17:00 -->
Done. Here's a summary of Run 57:

**H3 — POOR band threshold fix** (research was complete from Run 56, mutation executed now)

**Changes made:**
- `normalizationConstants.ts` — added `FORM_POOR_THRESHOLD = 9 as const` with calibration rationale; updated `FORM_SCORE_MID` doc comment
- `performanceCalculators.ts:187` — MID band changed from `place <= 10` → `place <= FORM_POOR_THRESHOLD - 1` (≤ 8); imported new constant
- `normalizationPipeline.test.ts` — 3 boundary tests confirming: place=8 stays MID (+0.12s), place=9 → POOR (+0.24s), place=10 → POOR (+0.24s)

**Result:** tsc clean, 156/156 tests pass (up from 153).

**Effect:** 9th and 10th-place finishes now carry a +0.24s form penalty instead of +0.12s, reflecting that in a modal 12-horse V85 field, 9th place is 4th from last — genuinely poor, not mid-pack.


<!-- stdout from run 54 2026-04-11 18:00 -->
[run failed — claude exited 1]

You've hit your limit · resets 7pm (Europe/Stockholm)

---

## Run 58 — 2026-04-11 — MUTATE

**Goal:** Sync eval-mae.mjs with H3 POOR band change, then grow MAE corpus on new dates.

**Done:**
- `scripts/eval-mae.mjs:153` — fixed `formAdj` POOR band: `<= 10` → `<= 8` (MID is now 6–8, POOR is 9+ matching `FORM_POOR_THRESHOLD = 9` from H3/Run 57)
- Ran `eval-mae.mjs` on 3 new V85 dates: 2026-04-05, 2026-03-28, 2026-03-21 (24 new races)
- Results: V1 MAE=5.233 (13% win), V2 MAE=5.279 (13% win) — V1 very slightly better (+0.046 delta)
- Combined 48-race picture: V1=5.006, V2=5.006 — essentially tied across all 6 dates
- Report saved: `reports/mae-auto-2026-04-05.json`

**Result:** pass

**Next:** H4 step 2 (lower `LAYOFF_THRESHOLD_DAYS` 21→14) — tests are already written (Run 55). Combined MAE tie means no signal to block it. Or run eval on 2–3 more dates to get to 72 races (more statistical power).

<!-- stdout from run 54 2026-04-11 19:00 -->
**Run 58 complete.**

## What changed

**`scripts/eval-mae.mjs` — formAdj POOR band sync (H3)**
- Line 153: `<= 10` → `<= 8` — MID is now 6–8, POOR is 9+, matching `FORM_POOR_THRESHOLD = 9` added in Run 57.
- Before this fix, the evaluator was scoring 9th and 10th place finishes as MID (+0.12s) while the live app was scoring them as POOR (+0.24s). Future evals now faithfully represent the pipeline.

## MAE corpus — combined picture

| Batch | Dates | Races | V1 MAE | V2 MAE | Delta |
|---|---|---|---|---|---|
| Old | Mar 14 / Mar 7 / Feb 28 | 24 | 4.779 | 4.733 | −0.046 (V2 better) |
| New | Apr 5 / Mar 28 / Mar 21 | 24 | 5.233 | 5.279 | +0.046 (V1 better) |
| **Combined** | 6 dates | **48** | **5.006** | **5.006** | **tied** |

V1 and V2 are statistically tied at this sample size. V2 remains current — the design rationale (form-heavy, reduced career-stat overlap) is sound regardless of the tie. Need 72+ races for statistical signal.

**Next:** H4 step 2 — lower `LAYOFF_THRESHOLD_DAYS` from 21 to 14. Tests are pre-written from Run 55. The MAE tie is not a blocker.