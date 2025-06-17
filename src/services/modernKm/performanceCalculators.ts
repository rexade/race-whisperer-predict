
/**
 * Calculate start points baseline adjustment
 * Higher start points = better form = faster times
 */
export const calculateStartPointsAdjustment = (startPoints: number): number => {
  // Baseline: 500 start points = 0 adjustment
  // Every 100 points above/below baseline = -/+ 0.1s
  const baseline = 500;
  const adjustment = (baseline - startPoints) * 0.001;
  
  console.log(`Start Points adjustment: ${startPoints} points (baseline: ${baseline}) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate place percentage baseline adjustment
 * Higher place % = better consistency = faster times
 * Input: percentage as basis points (e.g., 3478 for 34.78%)
 */
export const calculatePlacePercentageAdjustment = (placePercentageBasisPoints: number): number => {
  // Convert from basis points to actual percentage
  const actualPercentage = placePercentageBasisPoints / 100;
  
  // Baseline: 50% place rate = 0 adjustment
  // Every 10% above/below baseline = -/+ 0.1s
  const baseline = 50;
  const adjustment = (baseline - actualPercentage) * 0.01;
  
  console.log(`Place % adjustment: ${actualPercentage.toFixed(1)}% (baseline: ${baseline}%) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate horse win percentage baseline adjustment
 * Higher win % = better quality = faster times
 * Input: percentage as basis points (e.g., 434 for 4.34%)
 */
export const calculateHorseWinPercentageAdjustment = (winPercentageBasisPoints: number): number => {
  // Convert from basis points to actual percentage
  const actualPercentage = winPercentageBasisPoints / 100;
  
  // Baseline: 15% win rate = 0 adjustment
  // Every 5% above/below baseline = -/+ 0.15s
  const baseline = 15;
  const adjustment = (baseline - actualPercentage) * 0.03;
  
  console.log(`Horse Win % adjustment: ${actualPercentage.toFixed(1)}% (baseline: ${baseline}%) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate earnings per start baseline adjustment
 * Higher earnings = better quality = faster times
 * Input: earnings in öre (Swedish cents)
 */
export const calculateEarningsPerStartAdjustment = (earningsPerStartOre: number): number => {
  // Convert from öre to SEK
  const earningsInSek = earningsPerStartOre / 100;
  
  // Baseline: 3000 SEK per start = 0 adjustment
  // Every 1000 SEK above/below baseline = -/+ 0.02s
  const baseline = 3000;
  const adjustment = (baseline - earningsInSek) * 0.00002;
  
  console.log(`Earnings/Start adjustment: ${earningsInSek.toFixed(0)} SEK (baseline: ${baseline} SEK) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};
