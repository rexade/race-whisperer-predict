# Performance Calculator Testing Guide

## Unit Tests for Start Points Calculation

The refactored start points calculation uses log+tanh saturation to prevent extreme bonuses. When you set up a test runner (Jest/Vitest), use these tests to verify the implementation.

### Installation (when ready to test)

```bash
npm install --save-dev vitest @vitest/ui
# or
npm install --save-dev @types/jest jest
```

### Test File: `performanceCalculators.test.ts`

Create this file in `src/services/modernKm/__tests__/` directory:

```typescript
import {
  calculateStartPointsAdjustment,
  calculateStartPointsAdjustmentFieldAware
} from '../performanceCalculators';

describe('calculateStartPointsAdjustment (log+tanh)', () => {
  test('neutral near baseline', () => {
    const adj = calculateStartPointsAdjustment(1200);
    expect(Math.abs(adj)).toBeLessThan(1e-6);
  });

  test('penalty below baseline, bonus above', () => {
    const low = calculateStartPointsAdjustment(900);
    const high = calculateStartPointsAdjustment(2000);
    expect(low).toBeGreaterThan(0);   // slower (penalty)
    expect(high).toBeLessThan(0);     // faster (bonus)
  });

  test('caps at maxImpact', () => {
    const adj = calculateStartPointsAdjustment(16000, { maxImpact: 0.6 });
    expect(adj).toBeLessThanOrEqual(0);
    expect(Math.abs(adj)).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  test('invalid inputs → 0', () => {
    expect(calculateStartPointsAdjustment(0)).toBe(0);
    expect(calculateStartPointsAdjustment(NaN as any)).toBe(0);
    expect(calculateStartPointsAdjustment(-10)).toBe(0);
  });

  test('monotonic: more points ⇒ not slower', () => {
    const a = calculateStartPointsAdjustment(1500);
    const b = calculateStartPointsAdjustment(5000);
    expect(b).toBeLessThanOrEqual(a);
  });

  test('realistic examples', () => {
    const examples = [
      { points: 900, expected: { min: 0.20, max: 0.35 } },
      { points: 1200, expected: { min: -0.05, max: 0.05 } },
      { points: 2000, expected: { min: -0.50, max: -0.30 } },
      { points: 5000, expected: { min: -0.61, max: -0.55 } },
      { points: 16000, expected: { min: -0.61, max: -0.58 } },
    ];

    examples.forEach(({ points, expected }) => {
      const adj = calculateStartPointsAdjustment(points);
      expect(adj).toBeGreaterThanOrEqual(expected.min);
      expect(adj).toBeLessThanOrEqual(expected.max);
    });
  });
});

describe('calculateStartPointsAdjustmentFieldAware', () => {
  const field = [900, 1100, 1200, 1400, 1800];

  test('uses race-relative median/IQR', () => {
    const mid = calculateStartPointsAdjustmentFieldAware(1200, field);
    const high = calculateStartPointsAdjustmentFieldAware(1800, field);
    const low = calculateStartPointsAdjustmentFieldAware(900, field);
    
    expect(Math.abs(mid)).toBeLessThan(0.15);
    expect(high).toBeLessThan(0);
    expect(low).toBeGreaterThan(0);
  });

  test('falls back when field insufficient', () => {
    const tiny = calculateStartPointsAdjustmentFieldAware(1500, [1200]);
    const base = calculateStartPointsAdjustment(1500);
    expect(tiny).toBeCloseTo(base, 6);
  });
});
```

## Calibration Plan

After implementing tests:

1. **Run MAE optimizer** with the new saturated function
2. **Allow these parameters to float**:
   - `weights.startPoints ∈ [0.3, 0.8]`
   - `alpha ∈ [0.4, 0.9]`
   - `maxImpact ∈ [0.4, 0.7]`
3. **Log per-run metrics**:
   - `alpha`, `maxImpact`, `weight_startPoints`
   - `MAE`, `p50/p90 adj magnitudes`
4. **Sanity check**: startPoints shouldn't dominate > ~25–30% of total absolute adjustment on average

## Debug Mode

Enable detailed logging:

```bash
MODERNKM_DEBUG=1 npm run dev
```

This activates console logs in:
- `calculateStartPointsAdjustment`
- `calculateStartPointsAdjustmentFieldAware`

## Safety Rails Implemented

✅ **Log + tanh saturation** - Caps at ±0.6s (or ±0.5s field-aware)  
✅ **Monotonic bonus** - Higher points never make you slower  
✅ **Invalid input handling** - Returns 0 for NaN, 0, negative  
✅ **Field-aware fallback** - Uses standard method when field data insufficient  
✅ **Debug flag** - Verbose logging only when enabled  

## Expected Behavior Examples

| Start Points | Adjustment | Notes |
|-------------|-----------|-------|
| 900 | +0.267s | Penalty (below baseline) |
| 1200 | 0.000s | Neutral (at baseline) |
| 2000 | −0.415s | Moderate bonus |
| 5000 | −0.590s | Strong bonus |
| 16000 | −0.600s | **Capped** (was −1.55s before fix!) |

## What Was Fixed

### Before (Linear & Unbounded)
```typescript
// OLD: baseline = 500, linear scaling
const adjustment = (baseline - startPoints) * 0.0001;
// 16000 pts → (500 - 16000) * 0.0001 = -1.55s 🚫
```

### After (Log + Tanh Saturated)
```typescript
// NEW: log scale + tanh cap
const delta = Math.log1p(startPoints) - Math.log1p(baseline);
const adj = -maxImpact * Math.tanh(delta / alpha);
// 16000 pts → ≈ -0.60s (capped) ✅
```

## Integration Status

✅ Function replaced in `performanceCalculators.ts`  
✅ Field-aware variant added  
✅ Wired into `index.ts` (uses field-aware when available)  
✅ `fieldStartPoints` added to `ModernNormalizationFactors` type  
✅ Default weights updated to "Realistic Balanced (2025)"  
✅ New preset added to `presetWeights.ts`  
✅ Debug flag implemented  

## Next Steps

1. Set up test runner (Vitest recommended)
2. Add the test file from this guide
3. Run tests to verify implementation
4. Optionally: implement field-aware data collection in race processor
5. Re-run MAE optimizer with new function
