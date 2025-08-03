
import { KmTime, addSecondsToKmTime, subtractSecondsFromKmTime, kmTimeToSeconds } from './kmTimeUtils';

/**
 * Non-linear distance adjustment calculation for 2140m reference:
 * - 1640m to 2140m: 1.6s total difference (3.2s per 1000m rate)
 * - 2140m to 2640m: 1.0s total difference (2.0s per 1000m rate)
 */
const calculateNonLinearDistanceAdjustmentSeconds = (distance: number, referenceDistance: number): number => {
  if (distance === referenceDistance) return 0;
  
  if (distance < referenceDistance) {
    // Shorter distances: use 3.2s per 1000m rate
    const distanceDifferenceKm = (referenceDistance - distance) / 1000;
    return distanceDifferenceKm * 3.2; // Add time for shorter distances
  } else {
    // Longer distances: use 2.0s per 1000m rate  
    const distanceDifferenceKm = (distance - referenceDistance) / 1000;
    return -(distanceDifferenceKm * 2.0); // Subtract time for longer distances
  }
};

/**
 * Normalization formula with 2140m as reference point working directly with KM times:
 * 1. Apply non-linear distance-based adjustments to normalize to 2140m
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
  
  // Step 1: Apply non-linear distance-based adjustments to normalize to 2140m
  const referenceDistance = 2140;
  const distanceAdjustmentSeconds = calculateNonLinearDistanceAdjustmentSeconds(distance, referenceDistance);
  
  // Apply the adjustment: ADD because positive adjustment means slower time
  normalizedTime = addSecondsToKmTime(normalizedTime, distanceAdjustmentSeconds);
  
  console.log(`Non-linear distance adjustment: ${distance}m → 2140m reference`);
  console.log(`  Applied adjustment: ADD ${distanceAdjustmentSeconds.toFixed(3)}s`);
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
