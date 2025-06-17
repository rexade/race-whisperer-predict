
/**
 * Calculate distance-based adjustment for individual horse vs race distance
 */
export const calculateDistanceAdjustment = (horseDistance: number, raceDistance: number): number => {
  const distanceDifference = horseDistance - raceDistance;
  if (distanceDifference === 0) return 0;
  
  const adjustment = distanceDifference * 0.001;
  console.log(`Distance adjustment: Horse ${horseDistance}m vs Race ${raceDistance}m = ${distanceDifference}m → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate race type adjustment based on race classification
 */
export const calculateRaceTypeAdjustment = (raceType: string): number => {
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
export const calculateTimeOfDayAdjustment = (timeOfDay: string): number => {
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
