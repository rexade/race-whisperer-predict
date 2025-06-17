
import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime, kmTimeToSeconds, cloneKmTime } from './utils/kmTimeUtils';
import { ModernKmNormalizedResult } from './types/kmTimeTypes';

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
  driverWinPercentage2025: number;
  horseForm: number;
  raceType?: string;
  timeOfDay?: string;
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverExperience: number;
  driver2025Performance: number;
  trackFamiliarity: number;
  form: number;
  distanceAdjustment: number;
  raceType: number;
  timeOfDay: number;
}

const DEFAULT_WEIGHTS: NormalizationWeights = {
  postPosition: 1.0,
  shoeType: 0.8,
  sulkyType: 0.6,
  driverExperience: 0.9,
  driver2025Performance: 1.1,
  trackFamiliarity: 0.7,
  form: 1.2,
  distanceAdjustment: 1.0,
  raceType: 0.9,
  timeOfDay: 0.5
};

/**
 * Calculate distance-based adjustment for individual horse vs race distance
 */
const calculateDistanceAdjustment = (horseDistance: number, raceDistance: number): number => {
  const distanceDifference = horseDistance - raceDistance;
  if (distanceDifference === 0) return 0;
  
  const adjustment = distanceDifference * 0.001;
  console.log(`Distance adjustment: Horse ${horseDistance}m vs Race ${raceDistance}m = ${distanceDifference}m → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate race type adjustment based on race classification
 */
const calculateRaceTypeAdjustment = (raceType: string): number => {
  if (!raceType) return 0;
  
  const raceTypeAdjustments: { [key: string]: number } = {
    'MAIDEN': 0.2,
    'CLAIMING': 0.1,
    'ALLOWANCE': 0.0,
    'STAKES': -0.15,
    'GRADUATE': -0.1,
    'OPEN': -0.05,
    'RESTRICTED': 0.05
  };
  
  const adjustment = raceTypeAdjustments[raceType.toUpperCase()] || 0;
  console.log(`Race type adjustment: ${raceType} → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate time-of-day adjustment based on when the race is run
 */
const calculateTimeOfDayAdjustment = (timeOfDay: string): number => {
  if (!timeOfDay) return 0;
  
  const timeMatch = timeOfDay.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return 0;
  
  const hour = parseInt(timeMatch[1]);
  let adjustment = 0;
  
  if (hour >= 6 && hour < 12) {
    adjustment = 0.1;
  } else if (hour >= 12 && hour < 18) {
    adjustment = -0.05;
  } else if (hour >= 18 && hour <= 23) {
    adjustment = 0.0;
  } else {
    adjustment = 0.15;
  }
  
  console.log(`Time of day adjustment: ${timeOfDay} (hour ${hour}) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Applies modern normalization to a RAW KM time using race-specific factors
 */
export const applyModernKmNormalization = (
  rawKmTime: KmTime,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS
): ModernKmNormalizedResult => {
  console.log(`\n=== Enhanced Modern KM Normalization ===`);
  console.log(`RAW Time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);
  
  let adjustments = {
    postPosition: 0,
    equipment: 0,
    driver: 0,
    driver2025: 0,
    track: 0,
    form: 0,
    distance: 0,
    raceType: 0,
    timeOfDay: 0,
    total: 0
  };

  // Post Position Adjustment
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

  // Track Familiarity (placeholder)
  const trackAdjustment = 0 * weights.trackFamiliarity;
  adjustments.track = trackAdjustment;

  // Form Adjustment (placeholder)
  const formAdjustment = 0 * weights.form;
  adjustments.form = formAdjustment;

  // Distance Adjustment
  const distanceAdjustment = calculateDistanceAdjustment(
    factors.distance,
    factors.raceDistance
  ) * weights.distanceAdjustment;
  adjustments.distance = distanceAdjustment;

  // Race Type Adjustment
  const raceTypeAdjustment = calculateRaceTypeAdjustment(
    factors.raceType || ""
  ) * weights.raceType;
  adjustments.raceType = raceTypeAdjustment;

  // Time of Day Adjustment
  const timeOfDayAdjustment = calculateTimeOfDayAdjustment(
    factors.timeOfDay || ""
  ) * weights.timeOfDay;
  adjustments.timeOfDay = timeOfDayAdjustment;

  // Calculate total adjustment
  adjustments.total = postPosAdjustment + equipmentAdjustment + driverAdjustment + 
                    driver2025Adjustment + trackAdjustment + formAdjustment +
                    distanceAdjustment + raceTypeAdjustment + timeOfDayAdjustment;

  // Apply total adjustment to the KM time
  const modernNormalizedKmTime = addSecondsToKmTime(rawKmTime, adjustments.total);

  console.log(`Enhanced KM Adjustments:`);
  console.log(`  Post Position (${factors.postPosition}): ${postPosAdjustment.toFixed(3)}s`);
  console.log(`  Equipment: ${equipmentAdjustment.toFixed(3)}s`);
  console.log(`  Driver: ${driverAdjustment.toFixed(3)}s`);
  console.log(`  Driver 2025: ${driver2025Adjustment.toFixed(3)}s`);
  console.log(`  Distance: ${distanceAdjustment.toFixed(3)}s`);
  console.log(`  Race Type: ${raceTypeAdjustment.toFixed(3)}s`);
  console.log(`  Time of Day: ${timeOfDayAdjustment.toFixed(3)}s`);
  console.log(`  Total: ${adjustments.total.toFixed(3)}s`);
  console.log(`Enhanced Modern Normalized KM Time: ${modernNormalizedKmTime.minutes}:${modernNormalizedKmTime.seconds.toString().padStart(2, '0')}.${modernNormalizedKmTime.tenths}`);

  return {
    rawTime: cloneKmTime(rawKmTime),
    modernNormalizedTime: modernNormalizedKmTime,
    adjustments
  };
};

const calculatePostPositionAdjustment = (postPosition: number, startMethod: string): number => {
  if (startMethod.toLowerCase() === "auto") {
    const autoAdjustments: { [key: number]: number } = {
      1: 0.1, 2: 0.05, 3: 0.0, 4: -0.05, 5: -0.2,
      6: -0.05, 7: 0.0, 8: 0.1, 9: 0.15, 10: 0.15,
      11: 0.2, 12: 0.3, 13: 0.25, 14: 0.2, 15: 0.2
    };
    return autoAdjustments[postPosition] || 0;
  } else {
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
  if (frontShoes === "0" || frontShoes === "") adjustment -= 0.1;
  if (backShoes === "0" || backShoes === "") adjustment -= 0.1;
  return adjustment;
};

const calculateSulkyAdjustment = (sulkyType: string): number => {
  if (sulkyType === "AM") return -0.2;
  return 0;
};

const calculateDriverAdjustment = (
  driverExperience: number,
  winPercentage: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  if (winPercentage > 20) adjustment -= 0.25;
  else if (winPercentage > 15) adjustment -= 0.15;
  else if (winPercentage > 10) adjustment -= 0.05;
  else if (winPercentage <= 5) adjustment += 0.02;
  
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
  
  if (winPercentage2025 > 25) adjustment -= 0.3;
  else if (winPercentage2025 > 20) adjustment -= 0.2;
  else if (winPercentage2025 > 15) adjustment -= 0.1;
  else if (winPercentage2025 > 10) adjustment -= 0.05;
  else if (winPercentage2025 <= 5) adjustment += 0.05;
  
  if (winPercentage2025 > 25 && postPosition >= 9) {
    adjustment -= 0.08;
  } else if (winPercentage2025 > 20 && postPosition >= 11) {
    adjustment -= 0.05;
  }
  
  return adjustment;
};

export const getDefaultWeights = (): NormalizationWeights => ({ ...DEFAULT_WEIGHTS });
