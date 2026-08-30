// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WEIGHT_PRESETS, type WeightPreset } from '@/services/modernKm/presetWeights';
import { getDefaultPostPositionCurves, type PostPositionCurves } from '@/services/modernKm/index';
import { calculatePostPositionAdjustment } from '@/services/modernKm/postPositionCalculator';
import { resolvePresetModel } from '../weightPresetModel';

/**
 * These probes stand in for the analysis path. `calculatePostPositionAdjustment`
 * is the only consumer of the curves, so comparing its output under a preset's
 * curves against its output under the flat defaults is exactly the question
 * "did this preset's curves reach the prediction?".
 *
 * 2140 m and 2640 m sit in different distance buckets, so the bucketed presets
 * are exercised on the `byDistance` branch as well as the legacy single curve.
 */
const PROBES: Array<{ position: number; startMethod: string; distance: number }> = [
  1, 5, 9, 12,
].flatMap(position =>
  ['Auto', 'Volte'].flatMap(startMethod =>
    [1640, 2140, 2640].map(distance => ({ position, startMethod, distance }))
  )
);

const adjustments = (curves: PostPositionCurves): number[] =>
  PROBES.map(p => calculatePostPositionAdjustment(p.position, p.startMethod, curves, p.distance));

const curveCarryingPresets = WEIGHT_PRESETS.filter(p => p.postPositionCurves);
const defaultAdjustments = adjustments(getDefaultPostPositionCurves());

/** Presets whose curves actually change a prediction — the ones C1 silently broke. */
const divergentPresets = curveCarryingPresets.filter(
  preset => adjustments(preset.postPositionCurves!).some((v, i) => v !== defaultAdjustments[i])
);

const presetNamed = (prefix: string): WeightPreset => {
  const preset = WEIGHT_PRESETS.find(p => p.name.startsWith(prefix));
  if (!preset) throw new Error(`No preset starting with "${prefix}"`);
  return preset;
};

describe('resolvePresetModel', () => {
  it('passes the preset coefficients through untouched', () => {
    const preset = presetNamed('V42');
    expect(resolvePresetModel(preset).weights).toEqual(preset.weights);
  });

  it('falls back to the default curves for a preset that carries none', () => {
    const plain = WEIGHT_PRESETS.find(p => !p.postPositionCurves);
    expect(plain).toBeDefined();
    expect(resolvePresetModel(plain!).postPositionCurves).toEqual(getDefaultPostPositionCurves());
  });

  it('the shipped presets really do carry curves that change a prediction', () => {
    // Guards the premise of the test below: if the presets ever stopped
    // diverging from the defaults this suite would pass vacuously.
    expect(curveCarryingPresets.length).toBeGreaterThanOrEqual(11);
    expect(divergentPresets.length).toBeGreaterThanOrEqual(7);
  });

  it('carries every divergent preset curve into the post-position adjustment', () => {
    for (const preset of divergentPresets) {
      const resolved = adjustments(resolvePresetModel(preset).postPositionCurves);
      // The resolved model reproduces the preset exactly …
      expect(resolved).toEqual(adjustments(preset.postPositionCurves!));
      // … and is not the flat default, which is the regression this guards:
      // dropping the preset → curves wiring makes these two identical.
      expect(resolved).not.toEqual(defaultAdjustments);
    }
  });

  it('reproduces the bucketed V39 curve rather than the flat default', () => {
    // Spelled out for one preset so the failure message names a real number.
    // V39 routes 2140 m through its `byDistance.auto.medium` bucket; the flat
    // default has no bucketed path at all and returns 0.550 s for spår 9.
    const v39 = resolvePresetModel(presetNamed('V39'));
    const at = (curves: PostPositionCurves) => calculatePostPositionAdjustment(9, 'Auto', curves, 2140);

    expect(at(getDefaultPostPositionCurves())).toBeCloseTo(0.55, 5);
    expect(at(v39.postPositionCurves)).not.toBeCloseTo(0.55, 5);
  });
});
