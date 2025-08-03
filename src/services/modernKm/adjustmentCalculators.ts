
/**
 * Calculate distance-based adjustment for individual horse vs race distance
 */
export const calculateDistanceAdjustment = (horseDistance: number, raceDistance: number): number => {
  const distanceDifference = horseDistance - raceDistance;
  if (distanceDifference === 0) return 0;
  
  // 1 meter difference = 0.001s adjustment
  const adjustment = distanceDifference * 0.001;
  console.log(`Distance adjustment: Horse ${horseDistance}m vs Race ${raceDistance}m (diff: ${distanceDifference}m) → ${adjustment.toFixed(3)}s`);
  return adjustment;
};

/**
 * Calculate non-linear race distance adjustment FROM 2140m reference TO actual race distance
 * RAW times are normalized to 2140m reference, so we need to adjust TO the actual race distance
 */
export const calculateRaceDistanceAdjustment = (raceDistance: number): number => {
  const referenceDistance = 2140; // Standard reference distance in meters
  
  if (raceDistance === referenceDistance) {
    console.log(`Race distance adjustment: ${raceDistance}m = reference distance → 0.000s`);
    return 0;
  }
  
  // Calculate adjustment from 2140m reference TO actual race distance using non-linear rates
  let adjustment = 0;
  const distanceDifferenceM = Math.abs(raceDistance - referenceDistance);
  const distanceDifferenceKm = distanceDifferenceM / 1000;
  
  console.log(`\n--- Race Distance Adjustment Calculation ---`);
  console.log(`Reference distance: ${referenceDistance}m`);
  console.log(`Actual race distance: ${raceDistance}m`);
  console.log(`Distance difference: ${distanceDifferenceM}m (${distanceDifferenceKm.toFixed(3)}km)`);
  
  if (raceDistance < referenceDistance) {
    // Shorter distances: use 3.2s per 1000m rate
    // When going FROM 2140m TO shorter distance, we need to subtract time
    adjustment = -(distanceDifferenceKm * 3.2);
    console.log(`Shorter distance rate: 3.2s per 1000m`);
    console.log(`Calculation: -(${distanceDifferenceKm.toFixed(3)} km × 3.2) = ${adjustment.toFixed(3)}s`);
  } else {
    // Longer distances: use 2.0s per 1000m rate
    // When going FROM 2140m TO longer distance, we need to add time
    adjustment = distanceDifferenceKm * 2.0;
    console.log(`Longer distance rate: 2.0s per 1000m`);
    console.log(`Calculation: ${distanceDifferenceKm.toFixed(3)} km × 2.0 = ${adjustment.toFixed(3)}s`);
  }
  
  console.log(`Final race distance adjustment: ${adjustment.toFixed(3)}s`);
  console.log(`--- End Race Distance Adjustment ---\n`);
  
  return adjustment;
};

/**
 * Calculate track familiarity adjustment based on horse's home track vs race track
 */
export const calculateTrackFamiliarityAdjustment = (
  horseHomeTrack: string,
  raceTrack: string
): number => {
  if (!horseHomeTrack || !raceTrack) {
    console.log('Track familiarity adjustment: Missing track data → 0.000s');
    return 0;
  }

  const homeTrackNormalized = horseHomeTrack.trim().toUpperCase();
  const raceTrackNormalized = raceTrack.trim().toUpperCase();
  
  if (homeTrackNormalized === raceTrackNormalized) {
    const adjustment = -0.15; // Home track advantage
    console.log(`Track familiarity adjustment: Home track advantage (${horseHomeTrack} = ${raceTrack}) → ${adjustment.toFixed(3)}s`);
    return adjustment;
  }
  
  console.log(`Track familiarity adjustment: Away track (${horseHomeTrack} ≠ ${raceTrack}) → 0.000s`);
  return 0;
};

/**
 * Calculate volte start distance penalty - only for horses with longer distance than race
 */
export const calculateVolteStartDistancePenalty = (
  startMethod: string,
  horseDistance: number,
  raceDistance: number
): number => {
  // Only apply penalty for volte start races
  if (!startMethod || !startMethod.toLowerCase().includes('volte')) {
    console.log(`Volte start penalty: Not a volte start (${startMethod || 'unknown'}) → 0.000s`);
    return 0;
  }
  
  // Only apply penalty if horse has longer distance than race
  if (horseDistance <= raceDistance) {
    console.log(`Volte start penalty: Horse distance ${horseDistance}m ≤ race distance ${raceDistance}m → 0.000s`);
    return 0;
  }
  
  // Apply penalty for volte starts with longer horse distance
  const penalty = 0.4;
  console.log(`Volte start penalty: Volte start with longer distance (${horseDistance}m > ${raceDistance}m) → +${penalty.toFixed(3)}s`);
  return penalty;
};
