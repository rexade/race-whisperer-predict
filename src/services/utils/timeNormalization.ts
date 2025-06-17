
/**
 * Simplified normalization formula:
 * 1. Convert all times to seconds
 * 2. Apply distance conversion to normalize to 2140m equivalent
 * 3. If 1640m autostart: add 3.6 seconds
 * 4. If volte start: subtract 1 second (because volte is slower, we normalize to auto equivalent)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  console.log(`\n--- Normalizing Time ---`);
  console.log(`Original time: ${timeSeconds}s, Distance: ${distance}m, Start: ${startMethod}`);
  
  let normalizedTime = timeSeconds;
  
  // Step 1: Apply distance conversion to normalize to 2140m equivalent
  if (distance === 1640) {
    // Convert 1640m time to 2140m equivalent
    const conversionFactor = 2140 / 1640; // ≈ 1.305
    normalizedTime = normalizedTime * conversionFactor;
    console.log(`Distance conversion (1640m → 2140m): ${timeSeconds}s × ${conversionFactor.toFixed(3)} = ${normalizedTime.toFixed(1)}s`);
  } else if (distance === 2640) {
    // Convert 2640m time to 2140m equivalent
    const conversionFactor = 2140 / 2640; // ≈ 0.811
    normalizedTime = normalizedTime * conversionFactor;
    console.log(`Distance conversion (2640m → 2140m): ${timeSeconds}s × ${conversionFactor.toFixed(3)} = ${normalizedTime.toFixed(1)}s`);
  } else if (distance === 3140) {
    // Convert 3140m time to 2140m equivalent
    const conversionFactor = 2140 / 3140; // ≈ 0.681
    normalizedTime = normalizedTime * conversionFactor;
    console.log(`Distance conversion (3140m → 2140m): ${timeSeconds}s × ${conversionFactor.toFixed(3)} = ${normalizedTime.toFixed(1)}s`);
  } else if (distance !== 2140) {
    // Generic conversion for other distances
    const conversionFactor = 2140 / distance;
    normalizedTime = normalizedTime * conversionFactor;
    console.log(`Distance conversion (${distance}m → 2140m): ${timeSeconds}s × ${conversionFactor.toFixed(3)} = ${normalizedTime.toFixed(1)}s`);
  } else {
    console.log(`No distance conversion needed (already 2140m)`);
  }
  
  // Step 2: If 1640m autostart, add 3.6 seconds
  if (distance === 1640 && startMethod.toLowerCase() === "auto") {
    normalizedTime += 3.6;
    console.log(`1640m autostart adjustment: +3.6s → ${normalizedTime.toFixed(1)}s`);
  }
  
  // Step 3: If volte start, subtract 1 second (normalize to auto)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
    console.log(`Volte start adjustment: -1.0s → ${normalizedTime.toFixed(1)}s`);
  }
  
  console.log(`Final normalized time: ${normalizedTime.toFixed(1)}s`);
  return Math.round(normalizedTime * 10) / 10; // Round to 1 decimal place
};
