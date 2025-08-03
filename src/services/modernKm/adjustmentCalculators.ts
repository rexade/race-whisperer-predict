
/**
 * Calculate distance-based adjustment for individual horse vs race distance
 */
export const calculateDistanceAdjustment = (horseDistance: number, raceDistance: number): number => {
  const distanceDifference = horseDistance - raceDistance;
  if (distanceDifference === 0) return 0;
  
  // 1 meter difference = 0.001s adjustment
  const adjustment = distanceDifference * 0.001;
  console.log(`Distance adjustment: Horse ${horseDistance}m vs Race ${raceDistance}m (diff: ${distanceDifference}m) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate non-linear race distance adjustment FROM 2140m reference TO actual race distance
 * RAW times are normalized to 2140m reference, so we need to adjust TO the actual race distance
 */
export const calculateRaceDistanceAdjustment = (raceDistance: number): number => {
  const referenceDistance = 2140; // Standard reference distance in meters
  
  if (raceDistance === referenceDistance) {
    console.log(`Race distance adjustment: ${raceDistance}m = reference distance → 0.000s`);
    return 0;
  }
  
  // Calculate adjustment from 2140m reference TO actual race distance using non-linear rates
  let adjustment = 0;
  const distanceDifferenceM = Math.abs(raceDistance - referenceDistance);
  const distanceDifferenceKm = distanceDifferenceM / 1000;
  
  console.log(`\n--- Race Distance Adjustment Calculation ---`);
  console.log(`Reference distance: ${referenceDistance}m`);
  console.log(`Actual race distance: ${raceDistance}m`);
  console.log(`Distance difference: ${distanceDifferenceM}m (${distanceDifferenceKm.toFixed(3)}km)`);
  
  if (raceDistance < referenceDistance) {
    // Shorter distances: use 3.2s per 1000m rate
    // When going FROM 2140m TO shorter distance, we need to subtract time
    adjustment = -(distanceDifferenceKm * 3.2);
    console.log(`Shorter distance rate: 3.2s per 1000m`);
    console.log(`Calculation: -(${distanceDifferenceKm.toFixed(3)} km × 3.2) = ${adjustment.toFixed(3)}s`);
  } else {
    // Longer distances: use 2.0s per 1000m rate
    // When going FROM 2140m TO longer distance, we need to add time
    adjustment = distanceDifferenceKm * 2.0;
    console.log(`Longer distance rate: 2.0s per 1000m`);
    console.log(`Calculation: ${distanceDifferenceKm.toFixed(3)} km × 2.0 = ${adjustment.toFixed(3)}s`);
  }
  
  console.log(`Final race distance adjustment: ${adjustment.toFixed(3)}s`);
  console.log(`--- End Race Distance Adjustment ---\n`);
  
  return adjustment;
};

/**
 * Calculate race type adjustment based on race classification
 */
export const calculateRaceTypeAdjustment = (raceType: string): number => {
  if (!raceType) return 0;
  
  const raceTypeAdjustments: { [key: string]: number } = {
    'MAIDEN': 0.2,      // Easier competition
    'CLAIMING': 0.1,    // Lower class
    'ALLOWANCE': 0.0,   // Standard baseline
    'STAKES': -0.15,    // Higher class, faster times
    'GRADUATE': -0.1,   // Moving up in class
    'OPEN': -0.05,      // Open competition
    'RESTRICTED': 0.05, // Limited field
    'TROT': 0.0         // Standard trot race
  };
  
  const adjustment = raceTypeAdjustments[raceType.toUpperCase()] || 0;
  console.log(`Race type adjustment: ${raceType} → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate time-of-day adjustment based on when the race is run
 */
export const calculateTimeOfDayAdjustment = (timeOfDay: string): number => {
  if (!timeOfDay) return 0;
  
  // Extract hour from ISO timestamp or time string
  let hour: number;
  
  if (timeOfDay.includes('T')) {
    // ISO timestamp format: 2025-06-22T16:20:00
    const timeMatch = timeOfDay.match(/T(\d{2}):/);
    hour = timeMatch ? parseInt(timeMatch[1]) : 12;
  } else {
    // Simple time format: HH:MM
    const timeMatch = timeOfDay.match(/(\d{1,2}):/);
    hour = timeMatch ? parseInt(timeMatch[1]) : 12;
  }
  
  let adjustment = 0;
  let period = '';
  
  if (hour >= 6 && hour < 12) {
    adjustment = 0.1;
    period = 'Morning';
  } else if (hour >= 12 && hour < 18) {
    adjustment = -0.05;
    period = 'Afternoon';
  } else if (hour >= 18 && hour <= 23) {
    adjustment = 0.0;
    period = 'Evening';
  } else {
    adjustment = 0.15;
    period = 'Night/Early Morning';
  }
  
  console.log(`Time of day adjustment: ${timeOfDay} (${period}, hour ${hour}) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};
