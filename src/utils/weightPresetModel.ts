import { getDefaultPostPositionCurves, type PostPositionCurves } from '../services/modernKm/index';
import type { NormalizationWeights } from '../services/modernKm/types';
import type { WeightPreset } from '../services/modernKm/presetWeights';

/** Everything a preset must push into the analysis to reproduce the run it was measured on. */
export interface PresetModel {
  weights: NormalizationWeights;
  postPositionCurves: PostPositionCurves;
}

/** Where an applied preset lands — in the app, the two `V75Analyzer` state setters. */
export interface PresetTargets {
  applyWeights: (weights: NormalizationWeights) => void;
  applyPostPositionCurves: (curves: PostPositionCurves) => void;
}

/**
 * Resolve the full model a preset describes.
 *
 * A preset is not just coefficients. Eleven of the shipped presets carry
 * `postPositionCurves`, seven of which differ from the flat V41 defaults — three
 * of those through the entirely separate `byDistance` bucketed path in
 * `calculatePostPositionAdjustment`. Those weights were fitted *against* those
 * curves, so applying one half without the other silently runs a model that was
 * never evaluated: selecting "V39 — Bucketed Best" would move spår 9 at 2140 m
 * by a third of a second before the postPosition weight is even applied.
 */
export function resolvePresetModel(preset: WeightPreset): PresetModel {
  return {
    weights: preset.weights,
    postPositionCurves: preset.postPositionCurves ?? getDefaultPostPositionCurves(),
  };
}

/**
 * Push both halves of a preset into the analysis.
 *
 * The delivery lives here, not in the picker, so that "selecting a preset sends
 * its curves onward" is a claim a node test can make about a pure function
 * rather than something only a rendered component could demonstrate. Removing
 * the curve call below fails `weightPresetModel.test.ts`; removing the prop that
 * feeds `applyPostPositionCurves` fails the type-check, because
 * `WeightManagerProps` requires it.
 */
export function applyPresetModel(preset: WeightPreset, targets: PresetTargets): PresetModel {
  const model = resolvePresetModel(preset);
  targets.applyWeights(model.weights);
  // Only when the preset brings its own. A preset with no curves leaves the
  // current set alone rather than resetting one loaded from the API or an
  // imported config — which is the behaviour this restores, not a new one.
  if (preset.postPositionCurves) targets.applyPostPositionCurves(model.postPositionCurves);
  return model;
}
