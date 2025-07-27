
import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime, kmTimeToSeconds } from './kmTimeUtils';

/**
 * Normalization formula with 2140m as reference point working directly with KM times:
 * 1. Apply distance-based adjustments to normalize to 2140m
 * 2. If volte start: subtract 1 second (volte starts are faster than auto starts)
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
  const distanceDifferenceM = distance - referenceDistance; // e.g., 1640 - 2140 = -500m
  
  // Formula: 2.7 seconds per 1000m difference
  // If race is SHORTER than 2140m (negative difference), ADD time (make it slower)
  // If race is LONGER than 2140m (positive difference), SUBTRACT time (make it faster)
  const distanceAdjustmentSeconds = (distanceDifferenceM / 1000) * 2.7;
  
  // Apply the adjustment: SUBTRACT because we want opposite effect
  // Shorter races (negative diff) → negative adjustment → subtracting negative = ADDING time ✓
  // Longer races (positive diff) → positive adjustment → subtracting positive = SUBTRACTING time ✓
  normalizedTime = subtractSecondsFromKmTime(normalizedTime, distanceAdjustmentSeconds);
  
  console.log(`Distance adjustment: ${distance}m → 2140m reference`);
  console.log(`  Distance difference: ${distanceDifferenceM}m`);
  console.log(`  Adjustment calculation: (${distanceDifferenceM}/1000) × 2.7 = ${distanceAdjustmentSeconds.toFixed(3)}s`);
  console.log(`  Applied adjustment: SUBTRACT ${distanceAdjustmentSeconds.toFixed(3)}s`);
  console.log(`After distance adjustment: ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  
  // Step 2: Check for volte start method (case-insensitive and check for volte variations)
  const startMethodLower = startMethod.toLowerCase();
  const isVolteStart = startMethodLower.includes("volte") || startMethodLower === "v";
  
  if (isVolteStart) {
    normalizedTime = subtractSecondsFromKmTime(normalizedTime, 1.0);
    console.log(`🔥 VOLTE START DETECTED (${startMethod}) - Subtracted 1.0s advantage (volte starts are faster) → ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  } else {
    console.log(`Auto start detected (${startMethod}) - No volte adjustment applied`);
  }
  
  console.log(`Final normalized time (2140m reference): ${normalizedTime.minutes}:${normalizedTime.seconds.toString().padStart(2, '0')}.${normalizedTime.tenths}`);
  return normalizedTime;
};
