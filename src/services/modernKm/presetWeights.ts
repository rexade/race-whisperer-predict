import { NormalizationWeights } from './types';

export interface WeightPreset {
  name: string;
  description: string;
  weights: NormalizationWeights;
  category: 'conservative' | 'balanced' | 'aggressive' | 'specialized';
  /** Mean rank error from autonomous eval corpus (lower = better). */
  maeScore?: number;
  /** Number of races used for MAE evaluation. */
  raceCount?: number;
}

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    name: 'V4 — Driver Form (candidate)',
    description: 'V3 + driver×horse form signal (win rate of current driver on this horse, last 6 starts). Candidate — run eval to confirm.',
    category: 'balanced',
    weights: {
      postPosition: 0.7, shoeType: 0.4, sulkyType: 0.5,
      driverPerformance: 1.0, trackFamiliarity: 0.6, form: 1.0,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.1, startPoints: 0.5,
      placePercentage: 0.6, horseWinPercentage: 0.2, earningsPerStart: 0.1,
      gallopRisk: 0.5, layoffPenalty: 0.6, ageFactor: 0.5,
      genderAdjustment: 0.4, consistencyFactor: 0.5,
      driverForm: 0.8,
      trainerPerformance: 0,
    },
  },
  {
    name: 'V3 — Empirical (2026)',
    description: 'Current defaults — form boosted to 1.0, postPosition reduced to 0.7. 78 V85 races (10 dates, Jan–Apr 2026). MAE 2.815 — best on full corpus.',
    category: 'balanced',
    maeScore: 2.815,
    raceCount: 78,
    weights: {
      postPosition: 0.7, shoeType: 0.4, sulkyType: 0.5,
      driverPerformance: 1.0, trackFamiliarity: 0.6, form: 1.0,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.1, startPoints: 0.5,
      placePercentage: 0.6, horseWinPercentage: 0.2, earningsPerStart: 0.1,
      gallopRisk: 0.5, layoffPenalty: 0.6, ageFactor: 0.5,
      genderAdjustment: 0.4, consistencyFactor: 0.5,
      driverForm: 0,
      trainerPerformance: 0,
    },
  },
  {
    name: 'V2 — Empirical (2026)',
    description: 'Previous defaults — validated on 48 V85 races (6 dates, Jan–Apr 2026). MAE 2.690. Superseded by V3.',
    category: 'balanced',
    maeScore: 2.690,
    raceCount: 48,
    weights: {
      postPosition: 0.9, shoeType: 0.4, sulkyType: 0.5,
      driverPerformance: 1.0, trackFamiliarity: 0.6, form: 0.8,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.1, startPoints: 0.5,
      placePercentage: 0.6, horseWinPercentage: 0.2, earningsPerStart: 0.1,
      gallopRisk: 0.5, layoffPenalty: 0.6, ageFactor: 0.5,
      genderAdjustment: 0.4, consistencyFactor: 0.5,
      driverForm: 0,
      trainerPerformance: 0,
    },
  },
  {
    name: 'Realistic Balanced (2025)',
    description: 'Saturated start points, de-duplicated form, realistic caps',
    category: 'balanced',
    weights: {
      postPosition: 0.9, shoeType: 0.4, sulkyType: 0.5,
      driverPerformance: 1.4, trackFamiliarity: 0.6, form: 1.0,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.1, startPoints: 0.5,
      placePercentage: 0.6, horseWinPercentage: 0.4, earningsPerStart: 0.2,
      gallopRisk: 0.5, layoffPenalty: 0.6, ageFactor: 0.5,
      genderAdjustment: 0.4, consistencyFactor: 0.3,
      driverForm: 0, trainerPerformance: 0,
    }
  },
  {
    name: 'Conservative',
    description: 'Minimal adjustments, focus on core factors only',
    category: 'conservative',
    weights: {
      postPosition: 0.8, shoeType: 0.5, sulkyType: 0.3,
      driverPerformance: 0.7, trackFamiliarity: 0.4, form: 0.8,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.0, startPoints: 0.5,
      placePercentage: 0.6, horseWinPercentage: 0.7, earningsPerStart: 0.4,
      gallopRisk: 0.3, layoffPenalty: 0.4, ageFactor: 0.3,
      genderAdjustment: 0.2, consistencyFactor: 0.2,
      driverForm: 0, trainerPerformance: 0,
    }
  },
  {
    name: 'Balanced',
    description: 'Default weights with proven effectiveness',
    category: 'balanced',
    weights: {
      postPosition: 1.0, shoeType: 0.8, sulkyType: 0.6,
      driverPerformance: 1.1, trackFamiliarity: 0.7, form: 1.2,
      distanceAdjustment: 1.0, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.0, startPoints: 0.8,
      placePercentage: 0.9, horseWinPercentage: 1.0, earningsPerStart: 0.7,
      gallopRisk: 0.5, layoffPenalty: 0.6, ageFactor: 0.5,
      genderAdjustment: 0.4, consistencyFactor: 0.4,
      driverForm: 0, trainerPerformance: 0,
    }
  },
  {
    name: 'Aggressive',
    description: 'Amplified adjustments for maximum differentiation',
    category: 'aggressive',
    weights: {
      postPosition: 1.3, shoeType: 1.2, sulkyType: 1.0,
      driverPerformance: 1.5, trackFamiliarity: 1.1, form: 1.6,
      distanceAdjustment: 1.3, raceDistanceAdjustment: 1.2,
      volteStartDistancePenalty: 1.2, startPoints: 1.2,
      placePercentage: 1.3, horseWinPercentage: 1.4, earningsPerStart: 1.1,
      gallopRisk: 0.8, layoffPenalty: 0.9, ageFactor: 0.7,
      genderAdjustment: 0.5, consistencyFactor: 0.6,
      driverForm: 0, trainerPerformance: 0,
    }
  },
  {
    name: 'Equipment Focus',
    description: 'Emphasizes equipment and setup factors',
    category: 'specialized',
    weights: {
      postPosition: 1.2, shoeType: 1.5, sulkyType: 1.3,
      driverPerformance: 0.8, trackFamiliarity: 1.0, form: 0.9,
      distanceAdjustment: 1.0, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.1, startPoints: 0.6,
      placePercentage: 0.7, horseWinPercentage: 0.8, earningsPerStart: 0.5,
      gallopRisk: 0.5, layoffPenalty: 0.5, ageFactor: 0.4,
      genderAdjustment: 0.3, consistencyFactor: 0.3,
      driverForm: 0, trainerPerformance: 0,
    }
  },
  {
    name: 'Performance Focus',
    description: 'Emphasizes historical performance metrics',
    category: 'specialized',
    weights: {
      postPosition: 0.9, shoeType: 0.6, sulkyType: 0.4,
      driverPerformance: 1.3, trackFamiliarity: 0.8, form: 1.5,
      distanceAdjustment: 0.8, raceDistanceAdjustment: 1.0,
      volteStartDistancePenalty: 1.0, startPoints: 1.3,
      placePercentage: 1.4, horseWinPercentage: 1.5, earningsPerStart: 1.2,
      gallopRisk: 0.7, layoffPenalty: 0.7, ageFactor: 0.6,
      genderAdjustment: 0.4, consistencyFactor: 0.5,
      driverForm: 0, trainerPerformance: 0,
    }
  }
];

export const getPresetByName = (name: string): WeightPreset | undefined => {
  return WEIGHT_PRESETS.find(preset => preset.name === name);
};

export const getPresetsByCategory = (category: WeightPreset['category']): WeightPreset[] => {
  return WEIGHT_PRESETS.filter(preset => preset.category === category);
};
