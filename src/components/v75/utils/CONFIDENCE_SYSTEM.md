# V85 Confidence Scoring System

## Overview
The confidence system provides transparency about prediction reliability by analyzing data quality, recency, and availability for each horse.

## Confidence Score (0-100)

### Calculation Components
- **Volume (60 pts max)**: Number of starts (local + foreign)
  - 6 points per start, capped at 10 starts
- **Sample Quality (20 pts max)**: Number of raw km-time samples available
  - 2 points per sample, capped at 10 samples
- **Recency (20 pts max)**: Days since last start
  - < 14 days: +20 pts (very recent)
  - < 35 days: +10 pts (recent)
- **Local Data Bonus (10 pts)**: Has local ATG/Swedish history

### Score Ranges
- **80-100 (Green)**: High confidence - abundant recent data
- **50-79 (Amber)**: Moderate confidence - some data gaps
- **5-49 (Red)**: Low confidence - limited or stale data

## History Source

### Types
- **Local**: Has ATG/Swedish racing history (most reliable)
- **Abroad**: Only foreign racing history (less compatible)
- **No Data**: Minimal or no historical data

### Impact on Predictions
- **Local**: Full normalization pipeline with accurate adjustments
- **Abroad**: Fallback prediction using priors and field median
- **No Data**: Field median + class/earnings/driver priors

## Fallback Prediction Logic

When local history is unavailable:

1. **Abroad average** (if available) with recency weighting
2. **Lifetime best** with optimism penalty (+0.6s)
3. **Field median** as baseline
4. **Driver/trainer priors** as final adjustment

## Tie-Breaking

When horses have identical predicted times:
1. Primary: Predicted time
2. Secondary: Higher confidence wins

## UI Indicators

### Badges
- Small colored pill next to horse name
- Shows data source at a glance

### Confidence Dot
- Green/Amber/Red color coding
- Percentage displayed on hover
- Helps assess prediction reliability

## Future Enhancements

### External History Provider
```typescript
interface ExternalHistoryProvider {
  getAbroadHistory(horseId: string): Promise<{
    avgKm?: number;
    bestKm?: number;
    starts?: number;
  }>;
}
```

Currently stubbed with `NullExternalHistory`. Can be replaced with:
- International racing database integration
- Cross-track normalization service
- Foreign federation APIs

## Files

- `confidenceCalculator.ts` - Core logic
- `horseResultBuilder.ts` - Integration point
- `raceScoreCalculator.ts` - Sorting with confidence
- `CompactHorseRow.tsx` - UI badges and indicators
- `V75HorseRow.tsx` - Full table UI
