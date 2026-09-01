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

## kmtid sectionals and trip data — tested, negative (2026-09-01)

kmtid.atgx.se publishes per-start trip and sectional data: actualDistanceRan
(ground actually covered), slipstreamDistance, first200ms, last200ms, best100ms
and a galloped flag. 82 cards exist over 18 months, all cached in
data/kmtid-cache/; the archive begins around March 2025 and adds roughly one
card a week, so this is the whole corpus rather than a collection shortfall.

Tested three ways against the 604-race holdout, all negative:

1. Ground-loss correction to the base time (replace the official km-time with
   actualKMTime where covered). Monotonically worse: w=0 0.5818, w=0.5 0.5792,
   w=1.0 0.5717, w=1.5 0.5706. Coverage is the mechanism -- 19.4% of the starts
   feeding a base time are corrected, so a horse's recent-3 mixes corrected and
   uncorrected samples and horses stop being comparable.

2. Sectionals as a feature, centred rank within the source race so uncovered
   horses score 0 and are not biased. last200ms (closing speed) monotonically
   worse, 0.5818 down to 0.5734. best100ms roughly flat.

3. best100ms with the weight chosen on TRAIN and the holdout read once. The
   train response is unimodal -- 0.5778 at w=0 rising to 0.5798 at w=3 then
   falling to 0.5776 at w=8 -- which is the shape of real signal rather than
   noise. It does not transfer: holdout +0.0002 MRR and -0.5pp win rate.

Univariate ranking on 3565 consecutive kmtid starts puts the sectionals behind
what the model already uses: previous finishing position separates next-start
win rate by 10.7pp and km-time by 8.3pp, against 6.6pp for best100, 4.0pp for
last200 and 2.8pp (non-monotonic) for first200.

Conclusion: there is signal in best100, but at 46.9% horse coverage it is
diluted below usefulness, and the source cannot supply more. Do not re-run this
without new coverage.
