import { getDefaultPostPositionCurves, type PostPositionCurves } from '../services/modernKm/index';
import type { NormalizationWeights } from '../services/modernKm/types';
import type { WeightPreset } from '../services/modernKm/presetWeights';

/** Everything a preset must push into the analysis to reproduce the run it was measured on. */
export interface PresetModel {
  weights: NormalizationWeights;
  postPositionCurves: PostPositionCurves;
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
 *
 * This exists as a pure function so the preset → curves path is testable without
 * rendering the picker. A preset with no curves of its own falls back to the
 * defaults, which is what the analysis would have used anyway.
 */
export function resolvePresetModel(preset: WeightPreset): PresetModel {
  return {
    weights: preset.weights,
    postPositionCurves: preset.postPositionCurves ?? getDefaultPostPositionCurves(),
  };
}
