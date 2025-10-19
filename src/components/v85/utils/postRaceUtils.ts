
export const formatKmTime = (kmTime: any): string => {
  if (!kmTime) return 'N/A';
  
  if (typeof kmTime === 'string') return kmTime;
  
  if (kmTime && typeof kmTime === 'object' && kmTime.minutes !== undefined && kmTime.seconds !== undefined) {
    const minutes = kmTime.minutes || 0;
    const seconds = kmTime.seconds || 0;
    const tenths = kmTime.tenths || 0;
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
  
  return String(kmTime);
};

export const validateDateFormat = (date: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
};

export const checkDateNotInFuture = (date: string): void => {
  const analysisDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  if (analysisDate > today) {
    throw new Error('Cannot analyze future races. Please select a past date.');
  }
};

export const calculateOverallPerformance = (raceAnalyses: any[]) => {
  const totalRaces = raceAnalyses.length;
  const validAccuracyRaces = raceAnalyses.filter(race => race.overallAccuracy.topPicksTotal > 0);
  
  const averageAccuracy = validAccuracyRaces.length > 0 ? 
    validAccuracyRaces.reduce((sum, race) => 
      sum + (race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal), 0
    ) / validAccuracyRaces.length : 0;
  
  const raceAccuracies = validAccuracyRaces.map(race => 
    race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal
  );
  
  const bestRaceAccuracy = raceAccuracies.length > 0 ? Math.max(...raceAccuracies) : 0;
  const worstRaceAccuracy = raceAccuracies.length > 0 ? Math.min(...raceAccuracies) : 0;

  return {
    totalRaces,
    averageAccuracy,
    bestRaceAccuracy,
    worstRaceAccuracy
  };
};
