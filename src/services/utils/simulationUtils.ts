
import { ATGHistoricalRace } from '../atgApi';

// Temporary function to simulate historical data with varied distances and start methods
// This should be replaced with actual API calls once we have the correct endpoints
export const generateSimulatedHistory = (horseId: number, horseName: string): ATGHistoricalRace[] => {
  const races: ATGHistoricalRace[] = [];
  const raceCount = Math.floor(Math.random() * 8) + 6; // 6-13 historical races

  const distances = [1640, 2140, 2640];
  const startMethods = ["auto", "volte"];
  const tracks = ["Solvalla", "Åby", "Jägersro", "Mantorp", "Bergsåker"];

  for (let i = 0; i < raceCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (i * 10 + Math.random() * 10)); // Every 10-20 days
    
    const distance = distances[Math.floor(Math.random() * distances.length)];
    const startMethod = startMethods[Math.floor(Math.random() * startMethods.length)];
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    
    // Generate realistic time based on distance and start method
    let baseTime;
    if (distance === 1640) {
      baseTime = startMethod === "auto" ? 72 : 70; // ~72s for 1640m auto, ~70s for volte
    } else if (distance === 2140) {
      baseTime = startMethod === "auto" ? 75 : 73; // ~75s for 2140m auto, ~73s for volte
    } else { // 2640
      baseTime = startMethod === "auto" ? 78 : 76; // ~78s for 2640m auto, ~76s for volte
    }
    
    const variation = Math.random() * 4 - 2; // +/- 2 seconds variation
    const totalSeconds = baseTime + variation;
    
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);

    races.push({
      raceId: `simulated_${horseId}_${i}`,
      date: date.toISOString().split('T')[0],
      distance,
      startMethod,
      track,
      kmTime: { minutes, seconds, tenths },
      finishOrder: Math.floor(Math.random() * 12) + 1,
      postPosition: Math.floor(Math.random() * 12) + 1,
      galloped: Math.random() < 0.03, // 3% chance of galloping
      disqualified: Math.random() < 0.01 // 1% chance of disqualification
    });
  }

  return races;
};
