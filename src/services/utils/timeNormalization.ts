
/**
 * Normalization formula with 2140m as reference point:
 * 1. Convert all times to seconds
 * 2. Apply distance-based adjustments to normalize to 2140m:
 *    - Distance difference in km × 2.7 seconds per km
 *    - 1640m: Add 1.35s (shorter distance, so slower normalized time)
 *    - 2140m: No adjustment (reference distance)
 *    - 2640m: Subtract 1.35s (longer distance, so faster normalized time)
 * 3. If volte start: subtract 1 second (normalize to auto equivalent)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  console.log(`\n--- Normalizing Time to 2140m Reference ---`);
  console.log(`Original time: ${timeSeconds}s, Distance: ${distance}m, Start: ${startMethod}`);
  
  let normalizedTime = timeSeconds;
  
  // Step 1: Apply distance-based adjustments to normalize to 2140m
  const referenceDistance = 2140; // Our new reference point
  const distanceDifferenceKm = (distance - referenceDistance) / 1000;
  const distanceAdjustment = distanceDifferenceKm * 2.7;
  
  // Subtract the adjustment because:
  // - If race is shorter than 2140m (negative difference), we add time (make it slower)
  // - If race is longer than 2140m (positive difference), we subtract time (make it faster)
  normalizedTime -= distanceAdjustment;
  
  console.log(`Distance adjustment: ${distance}m to 2140m = ${distanceDifferenceKm.toFixed(3)}km × 2.7 = ${distanceAdjustment.toFixed(2)}s`);
  console.log(`After distance adjustment: ${normalizedTime.toFixed(1)}s`);
  
  // Step 2: If volte start, subtract 1 second (normalize to auto)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
    console.log(`Volte start adjustment: -1.0s → ${normalizedTime.toFixed(1)}s`);
  }
  
  console.log(`Final normalized time (2140m reference): ${normalizedTime.toFixed(1)}s`);
  return Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
};
