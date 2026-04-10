# Scoring Pipeline Reference

*Detailed reference. Read this when working on the modernKm pipeline — not needed for most tasks.*

## How it works
Adjusts a base km time in seconds. Lower adjusted time = better horse.
Entry point: `applyModernKmNormalization` in `src/services/modernKm/index.ts`

## Pipeline order
1. Raw km time, pre-normalised to 2140 m auto reference
2. `raceDistanceAdjustment` — piecewise: -3.2 s/km shorter, +2.0 s/km longer
3. `postPosition` — pos 1 = -0.30 s, pos 8 = +0.30 s, pos 15 = +1.00 s; custom curves via UI
4. `equipment` — barefoot front/back: -0.1 s each; American sulky: -0.2 s
5. `driver` — tanh-saturated; baseline 12% win rate = 0; cap ±0.30 s
6. `track` — home track bonus: -0.15 s
7. `form` — last 8 races, recency-weighted; win = -0.05 s, poor = +0.03 s
8. `distance` — horse preferred dist vs race dist: 0.001 s/m diff
9. `volteStartDistancePenalty` — back-marker in volte: +0.40 s
10. `startPoints` — field-aware IQR-normalised if ≥3 horses, else log-tanh; cap ±0.30 s
11. `placePercentage` — linear; baseline 50%: 0.001 s/ppt
12. `horseWinPercentage` — linear; baseline 15%: 0.015 s/ppt
13. `earningsPerStart` — linear; baseline 3000 SEK: 0.00001 s/öre; cap -0.20 s
14. `gallopReliabilityPenalty` — gallop rate above baseline adds seconds; weight 0.8 (Run 22)

## DEFAULT_WEIGHTS
`raceDistanceAdjustment: 1.0` | `postPosition: 0.9` | `driverPerformance: 1.0`
`shoeType: 0.4` | `sulkyType: 0.5` | `trackFamiliarity: 0.6` | `form: 0.5`
`distanceAdjustment: 0.8` | `volteStartDistancePenalty: 1.1` | `startPoints: 0.5`
`placePercentage: 0.6` | `horseWinPercentage: 0.4` | `earningsPerStart: 0.2`
`gallopReliability: 0.8`

Weights multiplied per factor, summed. Weight = 0 disables entirely.
User-tunable via WeightManager → saved to `localStorage` as `customDefaultWeights`.
