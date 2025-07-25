
// Legacy interface maintained for backward compatibility
export interface ModernNormalizationFactors {
  postPosition: number;
  distance: number;
  raceDistance: number;
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  
  horseForm: number;
  raceType?: string;
  timeOfDay?: string;
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverPerformance: number;
  trackFamiliarity: number;
  form: number;
  distanceAdjustment: number;
  raceType: number;
  timeOfDay: number;
}

export interface ModernNormalizedResult {
  rawTime: string; // KM format string for backward compatibility
  modernNormalizedTime: string; // KM format string for backward compatibility
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    
    track: number;
    form: number;
    distance: number;
    raceType: number;
    timeOfDay: number;
    total: number;
  };
  kmTime: string; // For backward compatibility
}

// Re-export new KM time normalization functionality
export { 
  applyModernKmNormalization,
  getDefaultWeights 
} from './modernKmNormalization';

// Re-export types
export type { 
  ModernKmNormalizedResult,
  KmTime 
} from './types/kmTimeTypes';

// Legacy function maintained for backward compatibility
export const applyModernNormalization = (
  rawTimeSeconds: number,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights
): ModernNormalizedResult => {
  // Convert seconds to KM time, apply new normalization, then convert back to strings
  const { secondsToKmTime, formatKmTime } = require('./utils/kmTimeUtils');
  const { applyModernKmNormalization } = require('./modernKmNormalization');
  
  const rawKmTime = secondsToKmTime(rawTimeSeconds);
  const result = applyModernKmNormalization(rawKmTime, factors, weights);
  
  return {
    rawTime: formatKmTime(result.rawTime),
    modernNormalizedTime: formatKmTime(result.modernNormalizedTime),
    adjustments: result.adjustments,
    kmTime: formatKmTime(result.modernNormalizedTime)
  };
};
