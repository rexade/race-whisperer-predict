
/**
 * Calibrated adjustment factors based on statistical analysis
 * These values are optimized for Swedish trotting races
 */

export interface AdjustmentCalibration {
  postPosition: {
    baseAdjustment: number;
    maxPosition: number;
    scalingFactor: number;
  };
  distance: {
    referenceDistance: number;
    adjustmentPerMeter: number;
    maxReasonableAdjustment: number;
  };
  startMethod: {
    volteStartPenalty: number;
    autoStartBaseline: number;
  };
  driver: {
    experienceWeight: number;
    winPercentageWeight: number;
    maxDriverAdjustment: number;
  };
  equipment: {
    shoesAdjustment: number;
    sulkyAdjustment: number;
    maxEquipmentAdjustment: number;
  };
}

/**
 * Default calibrated values - these can be adjusted based on empirical data
 */
export const DEFAULT_CALIBRATION: AdjustmentCalibration = {
  postPosition: {
    baseAdjustment: 0.05, // 50ms per position
    maxPosition: 12,
    scalingFactor: 1.1 // Positions get progressively worse
  },
  distance: {
    referenceDistance: 2140,
    adjustmentPerMeter: 0.001, // 1ms per meter difference
    maxReasonableAdjustment: 5.0 // 5 seconds max
  },
  startMethod: {
    volteStartPenalty: 1.0, // 1 second penalty for volte starts
    autoStartBaseline: 0.0
  },
  driver: {
    experienceWeight: 0.01, // 10ms per year of experience
    winPercentageWeight: 0.02, // 20ms per percentage point
    maxDriverAdjustment: 2.0 // 2 seconds max
  },
  equipment: {
    shoesAdjustment: 0.1, // 100ms for shoes
    sulkyAdjustment: 0.05, // 50ms for sulky type
    maxEquipmentAdjustment: 0.5 // 500ms max
  }
};

/**
 * Validates that adjustment values are within reasonable bounds
 */
export const validateAdjustmentBounds = (
  adjustmentType: keyof AdjustmentCalibration,
  value: number,
  calibration: AdjustmentCalibration = DEFAULT_CALIBRATION
): { isValid: boolean; warning?: string } => {
  const config = calibration[adjustmentType];
  
  switch (adjustmentType) {
    case 'postPosition':
      const maxPostAdjustment = config.baseAdjustment * config.maxPosition;
      if (Math.abs(value) > maxPostAdjustment) {
        return {
          isValid: false,
          warning: `Post position adjustment ${value.toFixed(3)}s exceeds maximum ${maxPostAdjustment.toFixed(3)}s`
        };
      }
      break;
      
    case 'distance':
      if (Math.abs(value) > config.maxReasonableAdjustment) {
        return {
          isValid: false,
          warning: `Distance adjustment ${value.toFixed(3)}s exceeds maximum ${config.maxReasonableAdjustment.toFixed(3)}s`
        };
      }
      break;
      
    case 'driver':
      if (Math.abs(value) > config.maxDriverAdjustment) {
        return {
          isValid: false,
          warning: `Driver adjustment ${value.toFixed(3)}s exceeds maximum ${config.maxDriverAdjustment.toFixed(3)}s`
        };
      }
      break;
      
    case 'equipment':
      if (Math.abs(value) > config.maxEquipmentAdjustment) {
        return {
          isValid: false,
          warning: `Equipment adjustment ${value.toFixed(3)}s exceeds maximum ${config.maxEquipmentAdjustment.toFixed(3)}s`
        };
      }
      break;
  }
  
  return { isValid: true };
};

/**
 * Calculates expected adjustment ranges for validation
 */
export const getExpectedAdjustmentRange = (
  adjustmentType: keyof AdjustmentCalibration,
  calibration: AdjustmentCalibration = DEFAULT_CALIBRATION
): { min: number; max: number; typical: number } => {
  const config = calibration[adjustmentType];
  
  switch (adjustmentType) {
    case 'postPosition':
      return {
        min: -config.baseAdjustment,
        max: config.baseAdjustment * config.maxPosition,
        typical: config.baseAdjustment * 6 // Middle positions
      };
      
    case 'distance':
      return {
        min: -config.maxReasonableAdjustment,
        max: config.maxReasonableAdjustment,
        typical: config.adjustmentPerMeter * 100 // 100m difference
      };
      
    case 'driver':
      return {
        min: -config.maxDriverAdjustment,
        max: config.maxDriverAdjustment,
        typical: config.winPercentageWeight * 10 // 10% difference
      };
      
    case 'equipment':
      return {
        min: -config.maxEquipmentAdjustment,
        max: config.maxEquipmentAdjustment,
        typical: config.shoesAdjustment // Shoes change
      };
      
    default:
      return { min: -1, max: 1, typical: 0 };
  }
};
