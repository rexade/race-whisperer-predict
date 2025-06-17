
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
  let normalizedTime = timeSeconds;
  
  // Step 1: If 1640m autostart, add 3.6 seconds
  if (distance === 1640 && startMethod.toLowerCase() === "auto") {
    normalizedTime += 3.6;
  }
  
  // Step 2: If volte start, subtract 1 second (normalizing to auto equivalent)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
  }
  
  return Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
};
