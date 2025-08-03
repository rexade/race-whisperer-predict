
/**
 * Non-linear distance adjustment calculation for 2140m reference:
 * - 1640m to 2140m: 1.6s total difference (3.2s per 1000m rate)
 * - 2140m to 2640m: 1.0s total difference (2.0s per 1000m rate)
 */
const calculateNonLinearDistanceAdjustment = (distance: number, referenceDistance: number): number => {
  if (distance === referenceDistance) return 0;
  
  if (distance < referenceDistance) {
    // Shorter distances: use 3.2s per 1000m rate
    // 1640m to 2140m = 500m difference = 1.6s total
    const distanceDifferenceKm = (referenceDistance - distance) / 1000;
    return distanceDifferenceKm * 3.2; // Add time for shorter distances
  } else {
    // Longer distances: use 2.0s per 1000m rate  
    // 2140m to 2640m = 500m difference = 1.0s total
    const distanceDifferenceKm = (distance - referenceDistance) / 1000;
    return -(distanceDifferenceKm * 2.0); // Subtract time for longer distances
  }
};

/**
 * Normalization formula with 2140m as reference point:
 * 1. Convert all times to seconds
 * 2. Apply non-linear distance-based adjustments to normalize to 2140m:
 *    - 1640m to 2140m: 3.2 seconds per 1000m (1.6s total difference)
 *    - 2140m to 2640m: 2.0 seconds per 1000m (1.0s total difference)
 * 3. If volte start: subtract 1 second (normalize to auto equivalent)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  const isDebugMode = startMethod?.toLowerCase().includes('debug') || false;
  
  if (isDebugMode) {
    console.log(`\n🔍 DETAILED NORMALIZATION AUDIT`);
    console.log(`Input: ${timeSeconds}s, Distance: ${distance}m, Start: ${startMethod}`);
  }
  
  let normalizedTime = timeSeconds;
  
  // Step 1: Apply distance-based adjustments to normalize to 2140m using non-linear formula
  const referenceDistance = 2140; // Our reference point
  const distanceAdjustment = calculateNonLinearDistanceAdjustment(distance, referenceDistance);
  
  // Subtract the adjustment because:
  // - If race is shorter than 2140m (negative difference), we add time (make it slower)
  // - If race is longer than 2140m (positive difference), we subtract time (make it faster)
  normalizedTime -= distanceAdjustment;
  
  if (isDebugMode) {
    console.log(`🧮 Non-linear distance calculation: ${distance}m to 2140m = ${distanceAdjustment.toFixed(3)}s`);
    console.log(`🧮 After distance adjustment: ${timeSeconds} - ${distanceAdjustment.toFixed(3)} = ${normalizedTime.toFixed(3)}s`);
  }
  
  // Step 2: If volte start, subtract 1 second (normalize to auto)
  if (startMethod.toLowerCase() === "volte") {
    const beforeVolte = normalizedTime;
    normalizedTime -= 1.0;
    if (isDebugMode) {
      console.log(`🧮 Volte start adjustment: ${beforeVolte.toFixed(3)} - 1.0 = ${normalizedTime.toFixed(3)}s`);
    }
  }
  
  const finalResult = Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
  
  if (isDebugMode) {
    console.log(`🧮 Final normalized time (2140m reference): ${normalizedTime.toFixed(3)}s → ${finalResult}s (rounded)`);
  }
  
  return finalResult;
};
