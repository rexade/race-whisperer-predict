export interface ModernNormalizationFactors {
  postPosition: number;
  distance: number;
  raceDistance: number; // Race-level distance
  startMethod: string;
  shoesFront: string;
  shoesBack: string;
  sulkyType: string;
  homeTrack: string;
  driverExperience: number;
  driverWinPercentage: number;
  driverWinPercentage2025: number;
  horseForm: number;
  raceType?: string; // Optional race type
  timeOfDay?: string; // Optional time of day
}

export interface NormalizationWeights {
  postPosition: number;
  shoeType: number;
  sulkyType: number;
  driverExperience: number;
  driver2025Performance: number;
  trackFamiliarity: number;
  form: number;
  distanceAdjustment: number; // New weight for distance adjustments
  raceType: number; // New weight for race type adjustments
  timeOfDay: number; // New weight for time-of-day adjustments
}

export interface ModernNormalizedResult {
  rawTime: string; // KM format
  modernNormalizedTime: string; // KM format
  adjustments: {
    postPosition: number;
    equipment: number;
    driver: number;
    driver2025: number;
    track: number;
    form: number;
    distance: number; // New distance adjustment
    raceType: number; // New race type adjustment
    timeOfDay: number; // New time-of-day adjustment
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
  form: 1.2,
  distanceAdjustment: 1.0, // New default weight
  raceType: 0.9, // New default weight
  timeOfDay: 0.5 // New default weight
};

/**
 * Converts KM time object to seconds for calculations
 */
const kmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};

/**
 * Converts seconds back to KM time format
 */
const secondsToKmTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const secs = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - secs) * 10);
  
  return `${minutes}:${secs.toString().padStart(2, '0')}.${tenths}`;
};

/**
 * Calculate distance-based adjustment for individual horse vs race distance
 */
const calculateDistanceAdjustment = (horseDistance: number, raceDistance: number): number => {
  // If horse distance differs from race distance (e.g., volte starts with extra distance)
  const distanceDifference = horseDistance - raceDistance;
  
  if (distanceDifference === 0) return 0;
  
  // Adjustment based on extra/less distance in meters
  // Roughly 0.001s per meter difference (empirical adjustment)
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
    'MAIDEN': 0.2, // Slower for maiden races
    'CLAIMING': 0.1, // Slightly slower for claiming races
    'ALLOWANCE': 0.0, // Baseline
    'STAKES': -0.15, // Faster for stakes races
    'GRADUATE': -0.1, // Faster for graduate races
    'OPEN': -0.05, // Slightly faster for open races
    'RESTRICTED': 0.05 // Slightly slower for restricted races
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
  
  // Parse time to get hour
  const timeMatch = timeOfDay.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return 0;
  
  const hour = parseInt(timeMatch[1]);
  
  // Time-based adjustments (empirical data suggests afternoon races are typically faster)
  let adjustment = 0;
  
  if (hour >= 6 && hour < 12) {
    adjustment = 0.1; // Morning races slightly slower
  } else if (hour >= 12 && hour < 18) {
    adjustment = -0.05; // Afternoon races slightly faster
  } else if (hour >= 18 && hour <= 23) {
    adjustment = 0.0; // Evening races baseline
  } else {
    adjustment = 0.15; // Late night/early morning races slower
  }
  
  console.log(`Time of day adjustment: ${timeOfDay} (hour ${hour}) → ${adjustment.toFixed(3)}s`);
  
  return adjustment;
};

/**
 * Applies modern normalization to a RAW time using race-specific factors
 */
export const applyModernNormalization = (
  rawTimeSeconds: number,
  factors: ModernNormalizationFactors,
  weights: NormalizationWeights = DEFAULT_WEIGHTS
): ModernNormalizedResult => {
  console.log(`\n=== Enhanced Modern Normalization ===`);
  console.log(`RAW Time: ${rawTimeSeconds.toFixed(2)}s`);
  
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

  // NEW: Distance Adjustment
  const distanceAdjustment = calculateDistanceAdjustment(
    factors.distance,
    factors.raceDistance
  ) * weights.distanceAdjustment;
  adjustments.distance = distanceAdjustment;

  // NEW: Race Type Adjustment
  const raceTypeAdjustment = calculateRaceTypeAdjustment(
    factors.raceType || ""
  ) * weights.raceType;
  adjustments.raceType = raceTypeAdjustment;

  // NEW: Time of Day Adjustment
  const timeOfDayAdjustment = calculateTimeOfDayAdjustment(
    factors.timeOfDay || ""
  ) * weights.timeOfDay;
  adjustments.timeOfDay = timeOfDayAdjustment;

  // Calculate total adjustment
  adjustments.total = postPosAdjustment + equipmentAdjustment + driverAdjustment + 
                    driver2025Adjustment + trackAdjustment + formAdjustment +
                    distanceAdjustment + raceTypeAdjustment + timeOfDayAdjustment;

  const modernNormalizedTimeSeconds = rawTimeSeconds + adjustments.total;
  
  // Convert both times to KM format for display
  const rawTimeKm = secondsToKmTime(rawTimeSeconds);
  const modernNormalizedTimeKm = secondsToKmTime(modernNormalizedTimeSeconds);

  console.log(`Enhanced Adjustments:`);
  console.log(`  Post Position (${factors.postPosition}): ${postPosAdjustment.toFixed(3)}s`);
  console.log(`  Equipment: ${equipmentAdjustment.toFixed(3)}s`);
  console.log(`  Driver: ${driverAdjustment.toFixed(3)}s`);
  console.log(`  Driver 2025: ${driver2025Adjustment.toFixed(3)}s`);
  console.log(`  Distance: ${distanceAdjustment.toFixed(3)}s`);
  console.log(`  Race Type: ${raceTypeAdjustment.toFixed(3)}s`);
  console.log(`  Time of Day: ${timeOfDayAdjustment.toFixed(3)}s`);
  console.log(`  Total: ${adjustments.total.toFixed(3)}s`);
  console.log(`Enhanced Modern Normalized Time: ${modernNormalizedTimeSeconds.toFixed(2)}s (${modernNormalizedTimeKm})`);

  return {
    rawTime: rawTimeKm,
    modernNormalizedTime: modernNormalizedTimeKm,
    adjustments,
    kmTime: modernNormalizedTimeKm
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

export const getDefaultWeights = (): NormalizationWeights => ({ ...DEFAULT_WEIGHTS });
