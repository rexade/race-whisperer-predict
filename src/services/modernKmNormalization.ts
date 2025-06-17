
// Re-export everything from the new modular structure for backward compatibility
export {
  applyModernKmNormalization,
  getDefaultWeights
} from './modernKm/index';

export type {
  ModernKmNormalizedResult,
  ModernNormalizationFactors,
  NormalizationWeights
} from './modernKm/types';
