export interface HorseData {
  name: string;
  startNumber: number;
  driver: string;
  driverWinPercentage: number;
  postPosition: number;
  normalizedTime: number;
  rawTime: number; // The calculated RAW time using simplified formula
  bestTime?: number;
  recentStarts?: number;
  totalEarnings?: string;
  equipment?: string[];
  horseId: number;
  validHistoricalRaces: number;
}

export interface RaceData {
  raceId: string;
  raceNumber: number;
  distance: number;
  startMethod: string;
  track: string;
  horses: HorseData[];
}

/**
 * Normalization formula with 2140m as reference point:
 * 1. Convert all times to seconds
 * 2. Apply distance-based adjustments to normalize to 2140m:
 *    - Distance difference in km × 2.7 seconds per km
 *    - 1640m: Add 1.35s (shorter distance, so slower normalized time)
 *    - 2140m: No adjustment (reference distance)
 *    - 2640m: Subtract 1.35s (longer distance, so faster normalized time)
 * 3. If volte start: subtract 1 second (normalize to auto)
 */
export const normalizeTimeSimplified = (
  timeSeconds: number,
  distance: number,
  startMethod: string
): number => {
  let normalizedTime = timeSeconds;
  
  // Step 1: Apply distance-based adjustments to normalize to 2140m
  const referenceDistance = 2140; // Our reference point
  const distanceDifferenceKm = (distance - referenceDistance) / 1000;
  const distanceAdjustment = distanceDifferenceKm * 2.7;
  
  // Subtract the adjustment because:
  // - If race is shorter than 2140m (negative difference), we add time (make it slower)
  // - If race is longer than 2140m (positive difference), we subtract time (make it faster)
  normalizedTime -= distanceAdjustment;
  
  // Step 2: If volte start, subtract 1 second (normalize to auto)
  if (startMethod.toLowerCase() === "volte") {
    normalizedTime -= 1.0;
  }
  
  return Math.round(normalizedTime * 10) / 10;
};

// Keep the original complex normalization for other uses if needed
export const normalizeKmTimeHistoric = (
  seconds: number,
  startMethod: string,
  distance: number,
  postPosition?: number
): number => {
  let adjustment = 0.0;
  
  if (startMethod === "volte") {
    adjustment -= 1.0;
  }
  
  if (distance < 1800) {
    adjustment += 0.7;
  } else if (distance > 2500) {
    adjustment -= 0.7;
  } else if (distance === 3140) {
    adjustment -= 1.0;
  }
  
  if ([2160, 2660, 3160].includes(distance)) {
    adjustment -= 0.3;
  }
  
  return Math.round((seconds + adjustment) * 10) / 10;
};

export const normalizeKmTime = (
  seconds: number,
  isBareFoot: boolean = false,
  isShoeChange: boolean = false,
  sulkyType: string = "VA",
  driverWinPercentage?: number,
  finalOdds?: number,
  postPosition?: number,
  startMethod: string = "auto",
  distance?: number,
  horseDistance?: number
): number => {
  let adjustment = 0.0;

  // Volte start adjustments
  if (startMethod === "volte" && horseDistance && distance && horseDistance > distance) {
    const extraMeters = horseDistance - distance;
    if (extraMeters === 20) adjustment += 0.4;
    else if (extraMeters === 40) adjustment += 0.6;
    else if (extraMeters === 60) adjustment += 0.8;
  }

  // Post position adjustments
  const postPositionAdjustments: { [key: number]: number } = {
    1: 0.1, 2: 0.05, 3: 0.0, 4: -0.05, 5: -0.2,
    6: -0.05, 7: 0.0, 8: 0.1, 9: 0.15, 10: 0.15,
    11: 0.2, 12: 0.3, 13: 0.25, 14: 0.2, 15: 0.2
  };

  if (startMethod === "auto" && postPosition) {
    adjustment += postPositionAdjustments[postPosition] || 0;
    
    // Driver/post-position interaction
    if (driverWinPercentage !== undefined) {
      if (driverWinPercentage > 20 && postPosition >= 9) {
        adjustment -= 0.05;
      } else if (driverWinPercentage > 15 && postPosition >= 11) {
        adjustment -= 0.03;
      }
    }
  } else if (startMethod === "volte" && postPosition) {
    if ([1, 2, 3, 4, 5].includes(postPosition)) adjustment -= 0.2;
    else if ([6, 7].includes(postPosition)) adjustment -= 0.1;
    else if (postPosition === 8) adjustment += 0.1;
    else if ([9, 10].includes(postPosition)) adjustment += 0.2;
    else if (postPosition === 11) adjustment += 0.25;
    else if (postPosition === 12) adjustment += 0.3;
    else if (postPosition === 13) adjustment += 0.5;
    else if (postPosition >= 14) adjustment += 0.2;
  }

  // Equipment adjustments
  if (sulkyType === "AM") adjustment -= 0.2;
  if (isBareFoot) adjustment -= 0.2;
  if (isShoeChange) adjustment += 0.2;

  // Driver adjustments
  if (driverWinPercentage !== undefined) {
    if (driverWinPercentage > 20) adjustment -= 0.25;
    else if (driverWinPercentage > 15) adjustment -= 0.30;
    else if (driverWinPercentage > 10) adjustment -= 0.05;
    else if (driverWinPercentage <= 5) adjustment += 0.02;
  }

  return Math.round((seconds + adjustment) * 10) / 10;
};

export const fetchRaceData = async (
  date: string,
  progressCallback?: (task: string, progress: number) => void
): Promise<RaceData[]> => {
  // Import here to avoid circular dependencies
  const { searchRacesByDate, fetchRaceData: fetchATGRace, fetchStartData } = await import('../services/atgApi');
  const { calculateRawTimesForRace } = await import('../services/timeProcessor');
  
  const races: RaceData[] = [];
  
  progressCallback?.("Searching for races...", 10);
  
  try {
    // Search for races on the given date
    const raceInfos = await searchRacesByDate(date);
    
    if (raceInfos.length === 0) {
      progressCallback?.("No races found for this date", 100);
      return races;
    }

    for (let i = 0; i < raceInfos.length; i++) {
      const raceInfo = raceInfos[i];
      progressCallback?.(`Fetching race ${i + 1} of ${raceInfos.length}...`, 20 + (i / raceInfos.length) * 30);
      
      try {
        const raceData = await fetchATGRace(raceInfo.id);
        
        progressCallback?.(`Calculating RAW times for race ${i + 1}...`, 50 + (i / raceInfos.length) * 30);
        
        // Calculate RAW times for all horses in this race using simplified formula
        const rawTimes = await calculateRawTimesForRace(raceData.starts, (current, total) => {
          const raceProgress = 50 + (i / raceInfos.length) * 30;
          const horseProgress = (current / total) * (30 / raceInfos.length);
          progressCallback?.(`Processing horse ${current} of ${total} in race ${i + 1}...`, raceProgress + horseProgress);
        });

        // Convert to our HorseData format
        const horses: HorseData[] = raceData.starts.map(start => {
          const rawTimeData = rawTimes.find(rt => rt.horseId === start.horse.id);
          const driverName = `${start.driver.firstName} ${start.driver.lastName}`;
          
          return {
            name: start.horse.name,
            startNumber: start.number,
            driver: driverName,
            driverWinPercentage: start.driver.statistics?.winPercentage || 0,
            postPosition: start.postPosition,
            normalizedTime: rawTimeData?.best3Average || 0,
            rawTime: rawTimeData?.best3Average || 0,
            horseId: start.horse.id,
            validHistoricalRaces: rawTimeData?.validTimesCount || 0,
            bestTime: rawTimeData?.allTimes[0]?.normalizedTime,
            recentStarts: rawTimeData?.validTimesCount || 0,
            equipment: [] // Would need to parse equipment from ATG data
          };
        });

        races.push({
          raceId: raceData.race.id,
          raceNumber: raceData.race.number,
          distance: raceData.race.distance,
          startMethod: raceData.race.startMethod,
          track: raceData.race.track,
          horses
        });

      } catch (error) {
        console.error(`Error fetching race ${raceInfo.id}:`, error);
        // Continue with other races
      }
    }

    progressCallback?.("Analysis complete!", 100);
    
  } catch (error) {
    console.error("Error fetching races:", error);
    progressCallback?.("Error occurred during analysis", 100);
    throw error;
  }
  
  return races;
};
