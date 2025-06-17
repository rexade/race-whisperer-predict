
import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime, kmTimeToSeconds } from './kmTimeUtils';

/**
 * Normalization formula with 2140m as reference point working directly with KM times:
 * 1. Apply distance-based adjustments to normalize to 2140m
 * 2. If volte start: subtract 1 second (normalize to auto equivalent)
 */
export const normalizeKmTimeSimplified = (
  kmTime: KmTime,
  distance: number,
  startMethod: string
): KmTime => {
  console.log(`\n--- Normalizing KM Time to 2140m Reference ---`);
  console.log(`Original time: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths}, Distance: ${distance}m, Start: ${startMethod}`);
  
  let normalizedTime = { ...kmTime };
  
  // Step 1: Apply distance-based adjustments to normalize to 2140m
  const referenceDistance = 2140;
  const distanceDifferenceKm = (distance - referenceDistance) / 1000;
  const distanceAdjustment = distanceDifferenceKm * 2.7;
  
  // Subtract the adjustment because:
  // - If race is shorter than 2140m (negative difference), we add time (make it slower)
  // - If race is longer than 2140m (positive difference), we subtract time (make it faster)
  normalizedTime = subtractSecondsFromKmTime(normalizedTime, distanceAdjustment);
  
  console.log(`Distance adjustment: ${distance}m to 2140m = ${distanceDifferenceKm.toFixed(3)}km × 2.7 = ${distanceAdjustment.toFixed(2)}s`);
  console.log(`After distance adjustment: ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  
  // Step 2: Check for volte start method (case-insensitive and check for volte variations)
  const startMethodLower = startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  if (isVolteStart) {
    normalizedTime = subtractSecondsFromKmTime(normalizedTime, 1.0);
    console.log(`🔥 VOLTE START DETECTED (${startMethod}) - Applied 1.0s penalty → ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  } else {
    console.log(`Auto start detected (${startMethod}) - No volte penalty applied`);
  }
  
  console.log(`Final normalized time (2140m reference): ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  return normalizedTime;
};
