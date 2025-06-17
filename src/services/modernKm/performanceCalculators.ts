
/**
 * Calculate start points baseline adjustment
 * Higher start points = better form = faster times
 */
export const calculateStartPointsAdjustment = (startPoints: number): number => {
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
export const calculatePlacePercentageAdjustment = (placePercentage: number): number => {
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
export const calculateHorseWinPercentageAdjustment = (winPercentage: number): number => {
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
export const calculateEarningsPerStartAdjustment = (earningsPerStart: number): number => {
  // Convert from öre to SEK (divide by 100)
  const earningsInSek = earningsPerStart / 100;
  // Baseline: 3000 SEK per start = 0 adjustment
  // Every 1000 SEK above/below = -/+ 0.02s (reduced multiplier from 0.00005 to 0.00002)
  const baseline = 3000;
  const adjustment = (baseline - earningsInSek) * 0.00002;
  
  console.log(`Earnings/Start adjustment: ${earningsInSek.toFixed(0)} SEK → ${adjustment.toFixed(3)}s`);
  return adjustment;
};
