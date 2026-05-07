# Model Evaluation Notes

This repo keeps model claims as evidence, not as production defaults.

## Preserved Evidence

- `reports/mae-auto-2026-04-25.json`
- `reports/mae-auto-2026-05-02.json`

These reports came from the AI branch evaluation run and are kept as sampled evidence for later review. The broader generated report corpus, calibration archives, memory logs, and build output were intentionally not kept in the app repo.

## Current Takeaway

- V32 appears stronger on win-pick accuracy in the tested corpus.
- MAE improvement is smaller and varies by date.
- Some signals were zeroed because ablations showed no marginal benefit in the tested data.
- The tested corpus is still small and likely selection-biased.
- V32 is available as an experimental preset, but `DEFAULT_WEIGHTS` remains unchanged.

## Merge Rule

Main should accept data correctness fixes, repeatable evaluation tooling, and clearly labeled experimental presets. It should not accept generated build output, AI memory logs, large calibration archives, or model-default changes without controlled holdout evidence.
