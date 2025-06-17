import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime, kmTimeToSeconds, cloneKmTime } from './utils/kmTimeUtils';

export interface ModernKmNormalizedResult {
  rawTime: KmTime;
  modernNormalizedTime: KmTime;
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    driver2025: number;
    track: number;
    form: number;
    distance: number;
    raceType: number;
    timeOfDay: number;
    startPoints: number;
    placePercentage: number;
    horseWinPercentage: number;
    earningsPerStart: number;
    total: number;
  };
}

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
  startPoints: number;
  placePercentage: number;
  horseWinPercentage: number;
  earningsPerStart: number;
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
  startPoints: number;
  placePercentage: number;
  horseWinPercentage: number;
  earningsPerStart: number;
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
  timeOfDay: 0.5,
  startPoints: 0.8,
  placePercentage: 0.9,
  horseWinPercentage: 1.0,
  earningsPerStart: 0.7
};

/**
 * Calculate start points baseline adjustment
 * Higher start points = better form = faster times
 */
const calculateStartPointsAdjustment = (startPoints: number): number => {
  // Baseline: 500 start points = 0 adjustment (reduced from 50)
  // Every 100 points above/below = -/+ 0.1s (reduced multiplier from 0.005 to 0.001)
  const baseline = 500;
  const adjustment = (baseline - startPoints) * 0.001;
  
  console.log(`Start Points adjustment: ${startPoints} points → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate place percentage baseline adjustment
 * Higher place % = better consistency = faster times
 * NOTE: Input percentages are already in proper decimal form (e.g., 34.78 for 34.78%)
 */
const calculatePlacePercentageAdjustment = (placePercentage: number): number => {
  // Convert from basis points to percentage (divide by 100)
  const actualPercentage = placePercentage / 100;
  // Baseline: 50% place rate = 0 adjustment
  // Every 10% above/below = -/+ 0.1s
  const baseline = 50;
  const adjustment = (baseline - actualPercentage) * 0.01;
  
  console.log(`Place % adjustment: ${actualPercentage.toFixed(1)}% → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate horse win percentage baseline adjustment
 * Higher win % = better quality = faster times
 * NOTE: Input percentages are already in proper decimal form (e.g., 4.34 for 4.34%)
 */
const calculateHorseWinPercentageAdjustment = (winPercentage: number): number => {
  // Convert from basis points to percentage (divide by 100)
  const actualPercentage = winPercentage / 100;
  // Baseline: 15% win rate = 0 adjustment
  // Every 5% above/below = -/+ 0.15s
  const baseline = 15;
  const adjustment = (baseline - actualPercentage) * 0.03;
  
  console.log(`Horse Win % adjustment: ${actualPercentage.toFixed(1)}% → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate earnings per start baseline adjustment
 * Higher earnings = better quality = faster times
 * NOTE: Input is already in öre (cents), needs conversion to SEK
 */
const calculateEarningsPerStartAdjustment = (earningsPerStart: number): number => {
  // Convert from öre to SEK (divide by 100)
  const earningsInSek = earningsPerStart / 100;
  // Baseline: 3000 SEK per start = 0 adjustment
  // Every 1000 SEK above/below = -/+ 0.02s (reduced multiplier from 0.00005 to 0.00002)
  const baseline = 3000;
  const adjustment = (baseline - earningsInSek) * 0.00002;
  
  console.log(`Earnings/Start adjustment: ${earningsInSek.toFixed(0)} SEK → ${adjustment.toFixed(3)}s`);
  return adjustment;
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
  console.log(`Start Method: ${factors.startMethod}`);
  
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
    startPoints: 0,
    placePercentage: 0,
    horseWinPercentage: 0,
    earningsPerStart: 0,
    total: 0
  };

  // FIRST: Apply volte start penalty if applicable (this is baseline normalization)
  let baseNormalizedTime = cloneKmTime(rawKmTime);
  const startMethodLower = factors.startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  if (isVolteStart) {
    baseNormalizedTime = addSecondsToKmTime(baseNormalizedTime, 1.0);
    console.log(`🔥 VOLTE START DETECTED (${factors.startMethod}) - Added 1.0s penalty (raw time assumes auto) → ${baseNormalizedTime.minutes}:${baseNormalizedTime.seconds.toString().padStart(2, '0')}.${baseNormalizedTime.tenths}`);
  } else {
    console.log(`Auto start detected (${factors.startMethod}) - No volte penalty applied`);
  }

  // Post Position Adjustment using baseline data
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

  // NEW: Start Points Adjustment
  const startPointsAdjustment = calculateStartPointsAdjustment(
    factors.startPoints
  ) * weights.startPoints;
  adjustments.startPoints = startPointsAdjustment;

  // NEW: Place Percentage Adjustment
  const placePercentageAdjustment = calculatePlacePercentageAdjustment(
    factors.placePercentage
  ) * weights.placePercentage;
  adjustments.placePercentage = placePercentageAdjustment;

  // NEW: Horse Win Percentage Adjustment
  const horseWinPercentageAdjustment = calculateHorseWinPercentageAdjustment(
    factors.horseWinPercentage
  ) * weights.horseWinPercentage;
  adjustments.horseWinPercentage = horseWinPercentageAdjustment;

  // NEW: Earnings Per Start Adjustment
  const earningsPerStartAdjustment = calculateEarningsPerStartAdjustment(
    factors.earningsPerStart
  ) * weights.earningsPerStart;
  adjustments.earningsPerStart = earningsPerStartAdjustment;

  // Calculate total adjustment (applied to the baseline normalized time)
  adjustments.total = postPosAdjustment + equipmentAdjustment + driverAdjustment + 
                    driver2025Adjustment + trackAdjustment + formAdjustment +
                    distanceAdjustment + raceTypeAdjustment + timeOfDayAdjustment +
                    startPointsAdjustment + placePercentageAdjustment + 
                    horseWinPercentageAdjustment + earningsPerStartAdjustment;

  // Apply total adjustment to the baseline normalized KM time
  const modernNormalizedKmTime = addSecondsToKmTime(baseNormalizedTime, adjustments.total);

  console.log(`Enhanced KM Adjustments (applied to ${isVolteStart ? 'volte-normalized' : 'raw'} time):`);
  console.log(`  Post Position (${factors.postPosition}): ${postPosAdjustment.toFixed(3)}s`);
  console.log(`  Equipment: ${equipmentAdjustment.toFixed(3)}s`);
  console.log(`  Driver: ${driverAdjustment.toFixed(3)}s`);
  console.log(`  Driver 2025: ${driver2025Adjustment.toFixed(3)}s`);
  console.log(`  Distance: ${distanceAdjustment.toFixed(3)}s`);
  console.log(`  Race Type: ${raceTypeAdjustment.toFixed(3)}s`);
  console.log(`  Time of Day: ${timeOfDayAdjustment.toFixed(3)}s`);
  console.log(`  Start Points: ${startPointsAdjustment.toFixed(3)}s`);
  console.log(`  Place %: ${placePercentageAdjustment.toFixed(3)}s`);
  console.log(`  Horse Win %: ${horseWinPercentageAdjustment.toFixed(3)}s`);
  console.log(`  Earnings/Start: ${earningsPerStartAdjustment.toFixed(3)}s`);
  console.log(`  Total: ${adjustments.total.toFixed(3)}s`);
  console.log(`Enhanced Modern Normalized KM Time: ${modernNormalizedKmTime.minutes}:${modernNormalizedKmTime.seconds.toString().padStart(2, '0')}.${modernNormalizedKmTime.tenths}`);

  return {
    rawTime: cloneKmTime(rawKmTime),
    modernNormalizedTime: modernNormalizedKmTime,
    adjustments
  };
};

const calculatePostPositionAdjustment = (postPosition: number, startMethod: string): number => {
  const startMethodLower = startMethod.toLowerCase();
  const isAutoStart = startMethodLower === "auto" || startMethodLower === "a" || !startMethodLower.includes("volte");
  
  console.log(`Calculating post position adjustment for position ${postPosition}, start method: ${startMethod} (${isAutoStart ? 'AUTO' : 'VOLTE'})`);
  
  if (isAutoStart) {
    // Auto start baseline time adjustments from your data
    const autoAdjustments: { [key: number]: number } = {
      1: 0.25,   // 9.7% win rate, 0.25s time adj
      2: 0.06,   // 11.6% win rate, 0.06s time adj  
      3: 0.03,   // 11.9% win rate, 0.03s time adj
      4: 0.08,   // 11.9% win rate, 0.08s time adj
      5: 0.0,    // 12.2% win rate, 0.0s time adj (best performance)
      6: 0.09,   // 11.3% win rate, 0.09s time adj
      7: 0.25,   // 9.7% win rate, 0.25s time adj
      8: 0.48,   // 7.4% win rate, 0.48s time adj
      9: 0.49,   // 7.3% win rate, 0.49s time adj
      10: 0.5,   // 7.2% win rate, 0.5s time adj
      11: 0.5,   // 7.2% win rate, 0.5s time adj
      12: 0.61,  // 6.1% win rate, 0.61s time adj
      13: 1.05,  // 1.7% win rate, 1.05s time adj
      14: 1.1,   // 1.2% win rate, 1.1s time adj
      15: 1.1    // 1.2% win rate, 1.1s time adj
    };
    
    const adjustment = autoAdjustments[postPosition] || 1.1; // Default to worst case for positions beyond 15
    console.log(`AUTO start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  } else {
    // Volte start baseline time adjustments from your data
    const volteAdjustments: { [key: number]: number } = {
      1: 0.03,   // 12.2% win rate, 0.03s time adj
      2: 0.11,   // 11.4% win rate, 0.11s time adj
      3: 0.4,    // 8.5% win rate, 0.4s time adj
      4: 0.0,    // 12.5% win rate, 0.0s time adj (best performance)
      5: 0.31,   // 9.4% win rate, 0.31s time adj
      6: 0.47,   // 7.8% win rate, 0.47s time adj
      7: 0.71,   // 5.4% win rate, 0.71s time adj
      8: 0.64,   // 6.1% win rate, 0.64s time adj
      9: 0.66,   // 5.9% win rate, 0.66s time adj
      10: 0.83,  // 4.2% win rate, 0.83s time adj
      11: 0.84,  // 4.1% win rate, 0.84s time adj
      12: 0.9,   // 3.5% win rate, 0.9s time adj
      13: 1.23,  // 0.2% win rate, 1.23s time adj
      14: 1.22,  // 0.3% win rate, 1.22s time adj
      15: 1.23   // 0.2% win rate, 1.23s time adj
    };
    
    const adjustment = volteAdjustments[postPosition] || 1.23; // Default to worst case for positions beyond 15
    console.log(`VOLTE start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  }
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
