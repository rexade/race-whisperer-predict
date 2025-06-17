
export interface HorseData {
  name: string;
  startNumber: number;
  driver: string;
  driverWinPercentage: number;
  postPosition: number;
  normalizedTime: number;
  bestTime?: number;
  recentStarts?: number;
  totalEarnings?: string;
  equipment?: string[];
}

export interface RaceData {
  raceId: string;
  raceNumber: number;
  distance: number;
  startMethod: string;
  track: string;
  horses: HorseData[];
}

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
  const races: RaceData[] = [];
  
  progressCallback?.("Checking available races...", 20);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock race data generation (in real app, this would be API calls)
  const mockRaceCount = Math.floor(Math.random() * 5) + 3; // 3-7 races
  
  for (let raceNum = 1; raceNum <= mockRaceCount; raceNum++) {
    progressCallback?.(`Fetching race ${raceNum} data...`, 20 + (raceNum / mockRaceCount) * 60);
    
    const race: RaceData = {
      raceId: `${date}_78_${raceNum}`,
      raceNumber: raceNum,
      distance: [1640, 2140, 2640, 3140][Math.floor(Math.random() * 4)],
      startMethod: Math.random() > 0.3 ? "auto" : "volte",
      track: "Solvalla",
      horses: []
    };
    
    // Generate mock horses for each race
    const horseCount = Math.floor(Math.random() * 4) + 8; // 8-11 horses
    
    for (let startNum = 1; startNum <= horseCount; startNum++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate individual horse API calls
      
      const baseTime = 75 + Math.random() * 10; // Base time around 75-85 seconds for 1600m
      const scaledTime = (baseTime * race.distance) / 1640; // Scale for distance
      
      const driverWinPct = Math.random() * 25;
      const postPos = startNum;
      
      // Apply normalization
      const normalizedTime = normalizeKmTime(
        scaledTime,
        Math.random() > 0.8, // barefoot
        Math.random() > 0.9, // shoe change
        Math.random() > 0.9 ? "AM" : "VA", // sulky type
        driverWinPct,
        undefined,
        postPos,
        race.startMethod,
        race.distance
      );
      
      const equipment = [];
      if (Math.random() > 0.8) equipment.push("Barefoot");
      if (Math.random() > 0.9) equipment.push("Shoe Change");
      if (Math.random() > 0.85) equipment.push("Blinkers");
      
      race.horses.push({
        name: `Horse ${raceNum}-${startNum}`,
        startNumber: startNum,
        driver: `Driver ${String.fromCharCode(65 + (startNum % 26))}`,
        driverWinPercentage: Math.round(driverWinPct * 10) / 10,
        postPosition: postPos,
        normalizedTime: normalizedTime,
        bestTime: normalizedTime - Math.random() * 2,
        recentStarts: Math.floor(Math.random() * 15) + 5,
        totalEarnings: `${Math.floor(Math.random() * 500000 + 100000).toLocaleString()} kr`,
        equipment: equipment.length > 0 ? equipment : undefined
      });
    }
    
    races.push(race);
  }
  
  progressCallback?.("Finalizing analysis...", 90);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  progressCallback?.("Complete!", 100);
  
  return races;
};
