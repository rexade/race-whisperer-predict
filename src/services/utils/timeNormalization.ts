
/**
 * Simplified normalization formula:
 * 1. Convert all times to seconds
 * 2. If 1640m autostart: add 3.6 seconds
 * 3. If volte start: subtract 1 second (because volte is slower, we normalize to auto equivalent)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  console.log(`\n--- Normalizing Time ---`);
  console.log(`Original time: ${timeSeconds}s, Distance: ${distance}m, Start: ${startMethod}`);
  
  let normalizedTime = timeSeconds;
  
  // Step 1: If 1640m autostart, add 3.6 seconds
  if (distance === 1640 && startMethod.toLowerCase() === "auto") {
    normalizedTime += 3.6;
    console.log(`1640m autostart adjustment: +3.6s → ${normalizedTime.toFixed(1)}s`);
  }
  
  // Step 2: If volte start, subtract 1 second (normalize to auto)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
    console.log(`Volte start adjustment: -1.0s → ${normalizedTime.toFixed(1)}s`);
  }
  
  console.log(`Final normalized time: ${normalizedTime.toFixed(1)}s`);
  return Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
};
