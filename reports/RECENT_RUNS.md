# Recent Runs

*Auto-generated. Last 4 runs. Full history in reports/RUN_LOG.md.*

---

## Run 67 — 2026-04-26 — MUTATE

**Goal:** C2 — enhancedAtgApi.ts console cleanup. ~45 raw `console.*` calls (including emoji sulky debug blocks) on every horse load.
**Done:** `src/services/enhancedAtgApi.ts` — added `import { log } from '@/lib/logger'`, replaced all `console.log`→`log.debug`, `console.warn`→`log.warn`, `console.error`→`log.error`. Stripped emoji prefixes from all messages.
**Result:** pass — tsc clean, 156 tests pass.
**Next:** C3 (equipment change flag) is still deferred (needs HorseRawKmTime changes). Consider expanding MAE corpus or investigating V4 weight candidate.

---

## Run 68 — 2026-04-27 — RESEARCH

**Investigated:** Production pipeline gaps — `horseNormalizationProcessor.ts`, `modernKm/index.ts`, `types.ts`, `presetWeights.ts`, `eval-mae.mjs`.

**Key finding:** Three silent dead factors (T1/F1/D1). T1 fixed next run. F1 and D1 noted for follow-up.

---

## Run 69 — 2026-04-27 — MUTATE

**Goal:** T1 — fix `trainerWinPercentage` missing from raw km path (HIGH priority from Run 68 research)
**Done:**
- `src/components/v75/utils/horseNormalizationProcessor.ts` — added `trainerWinPercentage` to the raw-km path factors object (~line 194). Mirrors the identical line in the fallback path.
- `src/services/modernKm/__tests__/normalizationPipeline.test.ts` — added `calculateTrainerAdjustment` import + 6-case test block.
**Result:** pass — tsc clean, 163/163 tests pass.
**Next:** F1 (fieldStartPoints never populated) or V4 corpus eval to resolve D1 (driverForm weight dead in production).

---

## Run 70 — 2026-04-27 — MUTATE

**Goal:** V4 MAE eval (LANE 1) to resolve D1 (driverForm dead in production). Ran eval, then investigated actual production pipeline state.

**Done:**
- `scripts/eval-mae.mjs` — ran on 4 April dates (30 races). V4 = V3 exactly (delta +0.000). Driver×horse coverage 0/N every race. Verdict: driver×horse signal unusable in V85.
- **Discovered**: commit `b54b3fc` (already in tree) fixed F1 and D1: `fieldStartPoints` + `fieldDriverWinRates` populated in both normalization paths; field-relative `calculateDriverFormAdjustment` added to `index.ts:112-117`. ACTIVE_THREADS was stale.
- `src/services/modernKm/performanceCalculators.ts:161-165` — fixed stale JSDoc: "6th–10th" → "6th–8th", "11th+" → "9th+ (FORM_POOR_THRESHOLD)", range "−0.05s…+0.03s" → "−0.40s…+0.24s" (reflects FORM_SCALE_S=0.40 set in Run 46).
**Result:** pass — tsc clean, 163/163 tests pass. Report: `reports/mae-auto-2026-04-04.json`.
**Next:** MAE corpus expansion — run eval on 2026-04-26 and newer completed V85 dates as they become available.
