
export interface ModernNormalizationFactors {
  postPosition: number;
  distance: number;
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  driverWinPercentage2025: number;
  horseForm: number;
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverExperience: number;
  driver2025Performance: number;
  trackFamiliarity: number;
  form: number;
}

export interface ModernNormalizedResult {
  rawTime: number;
  modernNormalizedTime: number;
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    driver2025: number;
    track: number;
    form: number;
    total: number;
  };
  kmTime: string;
}

const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.0,
  shoeType: 0.8,
  sulkyType: 0.6,
  driverExperience: 0.9,
  driver2025Performance: 1.1,
  trackFamiliarity: 0.7,
  form: 1.2
};

/**
 * Applies modern normalization to a RAW time using race-specific factors
 */
export const applyModernNormalization = (
  rawTime: number,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS
): ModernNormalizedResult => {
  console.log(`\n=== Modern Normalization ===`);
  console.log(`RAW Time: ${rawTime.toFixed(2)}s`);
  
  let adjustments = {
    postPosition: 0,
    equipment: 0,
    driver: 0,
    driver2025: 0,
    track: 0,
    form: 0,
    total: 0
  };

  // Post Position Adjustment (based on start method)
  const postPosAdjustment = calculatePostPositionAdjustment(
    factors.postPosition, 
    factors.startMethod
  ) * weights.postPosition;
  adjustments.postPosition = postPosAdjustment;

  // Equipment Adjustments
  const equipmentAdjustment = (
    calculateShoeAdjustment(factors.shoesFront, factors.shoesBack) +
    calculateSulkyAdjustment(factors.sulkyType)
  ) * weights.shoeType;
  adjustments.equipment = equipmentAdjustment;

  // Driver Experience Adjustment
  const driverAdjustment = calculateDriverAdjustment(
    factors.driverExperience,
    factors.driverWinPercentage,
    factors.postPosition
  ) * weights.driverExperience;
  adjustments.driver = driverAdjustment;

  // Driver 2025 Performance Adjustment
  const driver2025Adjustment = calculateDriver2025Adjustment(
    factors.driverWinPercentage2025,
    factors.postPosition
  ) * weights.driver2025Performance;
  adjustments.driver2025 = driver2025Adjustment;

  // Track Familiarity (placeholder for now)
  const trackAdjustment = 0 * weights.trackFamiliarity;
  adjustments.track = trackAdjustment;

  // Form Adjustment (placeholder for now)
  const formAdjustment = 0 * weights.form;
  adjustments.form = formAdjustment;

  // Calculate total adjustment
  adjustments.total = postPosAdjustment + equipmentAdjustment + driverAdjustment + driver2025Adjustment + trackAdjustment + formAdjustment;

  const modernNormalizedTime = rawTime + adjustments.total;
  const kmTime = convertSecondsToKmTime(modernNormalizedTime);

  console.log(`Adjustments:`);
  console.log(`  Post Position (${factors.postPosition}): ${postPosAdjustment.toFixed(3)}s`);
  console.log(`  Equipment: ${equipmentAdjustment.toFixed(3)}s`);
  console.log(`  Driver: ${driverAdjustment.toFixed(3)}s`);
  console.log(`  Driver 2025: ${driver2025Adjustment.toFixed(3)}s`);
  console.log(`  Total: ${adjustments.total.toFixed(3)}s`);
  console.log(`Modern Normalized Time: ${modernNormalizedTime.toFixed(2)}s (${kmTime})`);

  return {
    rawTime,
    modernNormalizedTime,
    adjustments,
    kmTime
  };
};

const calculatePostPositionAdjustment = (postPosition: number, startMethod: string): number => {
  if (startMethod.toLowerCase() === "auto") {
    // Auto start adjustments
    const autoAdjustments: { [key: number]: number } = {
      1: 0.1, 2: 0.05, 3: 0.0, 4: -0.05, 5: -0.2,
      6: -0.05, 7: 0.0, 8: 0.1, 9: 0.15, 10: 0.15,
      11: 0.2, 12: 0.3, 13: 0.25, 14: 0.2, 15: 0.2
    };
    return autoAdjustments[postPosition] || 0;
  } else {
    // Volte start adjustments
    if ([1, 2, 3, 4, 5].includes(postPosition)) return -0.2;
    if ([6, 7].includes(postPosition)) return -0.1;
    if (postPosition === 8) return 0.1;
    if ([9, 10].includes(postPosition)) return 0.2;
    if (postPosition === 11) return 0.25;
    if (postPosition === 12) return 0.3;
    if (postPosition === 13) return 0.5;
    if (postPosition >= 14) return 0.2;
  }
  return 0;
};

const calculateShoeAdjustment = (frontShoes: string, backShoes: string): number => {
  let adjustment = 0;
  
  // Barefoot adjustments (faster)
  if (frontShoes === "0" || frontShoes === "") adjustment -= 0.1;
  if (backShoes === "0" || backShoes === "") adjustment -= 0.1;
  
  return adjustment;
};

const calculateSulkyAdjustment = (sulkyType: string): number => {
  // American sulky is typically faster
  if (sulkyType === "AM") return -0.2;
  return 0;
};

const calculateDriverAdjustment = (
  driverExperience: number,
  winPercentage: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  // Driver skill adjustments
  if (winPercentage > 20) adjustment -= 0.25;
  else if (winPercentage > 15) adjustment -= 0.15;
  else if (winPercentage > 10) adjustment -= 0.05;
  else if (winPercentage <= 5) adjustment += 0.02;
  
  // Driver/post position interaction
  if (winPercentage > 20 && postPosition >= 9) {
    adjustment -= 0.05;
  } else if (winPercentage > 15 && postPosition >= 11) {
    adjustment -= 0.03;
  }
  
  return adjustment;
};

const calculateDriver2025Adjustment = (
  winPercentage2025: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  // 2025 current form adjustments (more aggressive than career stats)
  if (winPercentage2025 > 25) adjustment -= 0.3;
  else if (winPercentage2025 > 20) adjustment -= 0.2;
  else if (winPercentage2025 > 15) adjustment -= 0.1;
  else if (winPercentage2025 > 10) adjustment -= 0.05;
  else if (winPercentage2025 <= 5) adjustment += 0.05;
  
  // Current form and difficult post position interaction
  if (winPercentage2025 > 25 && postPosition >= 9) {
    adjustment -= 0.08;
  } else if (winPercentage2025 > 20 && postPosition >= 11) {
    adjustment -= 0.05;
  }
  
  return adjustment;
};

const convertSecondsToKmTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const secs = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - secs) * 10);
  
  return `${minutes}:${secs.toString().padStart(2, '0')}.${tenths}`;
};

export const getDefaultWeights = (): NormalizationWeights => ({ ...DEFAULT_WEIGHTS });
