
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { V75CacheService } from '../../../services/v75CacheService';
import { NormalizationWeights } from '../../../services/modernKm/index';

export interface V75ActualResult {
  raceId: string;
  raceNumber: number;
  finishOrder: Array<{
    position: number;
    horseId: number;
    horseName: string;
    postPosition: number;
    time: string; // Actual race time
    driver: string;
  }>;
  raceTime: string;
  weather?: string;
  track?: string;
  distance: number;
}

export interface V75PredictionAccuracy {
  horseId: number;
  horseName: string;
  postPosition: number;
  predictedScore: number;
  predictedRank: number;
  actualFinishPosition: number;
  rankDifference: number; // predicted rank - actual position
  wasTopPick: boolean; // was in top 3 predictions
  actuallyPlaced: boolean; // finished in top 3
  correctPrediction: boolean; // top pick that actually placed
}

export interface V75RaceAnalysis {
  raceId: string;
  raceNumber: number;
  raceDate: string;
  distance: number;
  actualResults: V75ActualResult;
  predictionAccuracy: V75PredictionAccuracy[];
  overallAccuracy: {
    topPicksCorrect: number; // how many top picks actually placed
    topPicksTotal: number;
    averageRankDifference: number;
    perfectPredictions: number; // exact position matches
  };
}

export interface V75PostRaceAnalysis {
  gameId: string;
  analysisDate: string;
  races: V75RaceAnalysis[];
  overallPerformance: {
    totalRaces: number;
    averageAccuracy: number;
    bestRaceAccuracy: number;
    worstRaceAccuracy: number;
    recommendedWeightAdjustments?: Partial<NormalizationWeights>;
  };
}

export const useV75PostRaceAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<V75PostRaceAnalysis | null>(null);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const fetchActualResults = async (date: string): Promise<V75ActualResult[]> => {
    console.log(`🏁 Fetching actual V75 results for ${date}`);
    
    try {
      // Step 1: Get V75 games for the date using the correct calendar endpoint
      console.log(`📅 Step 1: Fetching V75 games for date ${date}`);
      const calendarResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/calendar/day/${date}`);
      
      if (!calendarResponse.ok) {
        throw new Error(`Failed to fetch calendar: ${calendarResponse.statusText}`);
      }
      
      const calendarData = await calendarResponse.json();
      console.log('📅 Calendar response received:', {
        date: calendarData.date,
        hasGames: !!calendarData.games,
        v75Count: calendarData.games?.V75?.length || 0
      });
      
      // Find V75 games
      const v75Games = calendarData.games?.V75 || [];
      
      if (v75Games.length === 0) {
        throw new Error('No V75 games found for this date');
      }
      
      const v75Game = v75Games[0];
      console.log('🎯 V75 Game found:', {
        gameId: v75Game.id,
        raceCount: v75Game.races?.length || 0,
        raceIds: v75Game.races
      });
      
      if (!v75Game.races || v75Game.races.length === 0) {
        throw new Error('No races found in V75 game');
      }
      
      // Step 2: Fetch results for each race
      const results: V75ActualResult[] = [];
      
      for (let i = 0; i < v75Game.races.length; i++) {
        const raceId = v75Game.races[i];
        console.log(`🏇 Step 2.${i + 1}: Fetching results for race ${raceId}`);
        
        try {
          // First get race info to determine if results are available
          const raceInfoResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceId}`);
          
          if (!raceInfoResponse.ok) {
            console.warn(`Failed to fetch race info for ${raceId}: ${raceInfoResponse.statusText}`);
            continue;
          }
          
          const raceInfo = await raceInfoResponse.json();
          console.log(`📋 Race ${raceId} info:`, {
            status: raceInfo.status,
            number: raceInfo.number,
            distance: raceInfo.distance,
            hasResults: !!raceInfo.results
          });
          
          // Check if race has finished and has results
          if (raceInfo.status !== 'FINISHED' && raceInfo.status !== 'RESULTS') {
            console.warn(`Race ${raceId} not finished yet (status: ${raceInfo.status})`);
            continue;
          }
          
          // Try multiple result endpoints
          let raceResults = null;
          const resultEndpoints = [
            `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/results`,
            `https://www.atg.se/services/racinginfo/v1/api/races/${raceId}/result`,
            `https://www.atg.se/services/racinginfo/v1/api/results/${raceId}`
          ];
          
          for (const endpoint of resultEndpoints) {
            try {
              console.log(`🔍 Trying results endpoint: ${endpoint}`);
              const resultResponse = await fetch(endpoint);
              
              if (resultResponse.ok) {
                raceResults = await resultResponse.json();
                console.log(`✅ Results found at ${endpoint}`);
                break;
              } else {
                console.log(`❌ Failed at ${endpoint}: ${resultResponse.statusText}`);
              }
            } catch (endpointError) {
              console.log(`❌ Error at ${endpoint}:`, endpointError);
            }
          }
          
          // If no results from endpoints, try to extract from race info
          if (!raceResults && raceInfo.results) {
            console.log(`📊 Using results from race info`);
            raceResults = { results: raceInfo.results };
          }
          
          if (!raceResults || !raceResults.results) {
            console.warn(`No results available for race ${raceId}`);
            continue;
          }
          
          // Process the results
          const finishOrder = (raceResults.results || [])
            .filter((result: any) => result.finalPosition && result.finalPosition > 0)
            .sort((a: any, b: any) => a.finalPosition - b.finalPosition)
            .map((result: any) => ({
              position: result.finalPosition,
              horseId: result.horse?.id || result.horseId || 0,
              horseName: result.horse?.name || result.horseName || 'Unknown',
              postPosition: result.postPosition || result.number || 0,
              time: result.kmTime ? this.formatKmTime(result.kmTime) : (result.time || 'N/A'),
              driver: result.driver ? 
                `${result.driver.firstName || ''} ${result.driver.lastName || ''}`.trim() : 
                'Unknown Driver'
            }));
          
          if (finishOrder.length === 0) {
            console.warn(`No valid finish positions found for race ${raceId}`);
            continue;
          }
          
          results.push({
            raceId: raceId,
            raceNumber: raceInfo.number || (i + 1),
            finishOrder,
            raceTime: raceResults.raceTime || raceInfo.startTime || 'N/A',
            weather: raceResults.weather || raceInfo.weather,
            track: raceInfo.track?.name || 'Unknown',
            distance: raceInfo.distance || 0
          });
          
          console.log(`✅ Successfully processed race ${raceId} with ${finishOrder.length} horses`);
          
        } catch (raceError) {
          console.error(`Error processing race ${raceId}:`, raceError);
          // Continue with other races
        }
      }
      
      console.log(`🏁 Results fetch complete: ${results.length}/${v75Game.races.length} races processed`);
      return results;
      
    } catch (error) {
      console.error('❌ Error fetching actual results:', error);
      throw error;
    }
  };

  const formatKmTime = (kmTime: any): string => {
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

  const compareWithPredictions = async (
    date: string,
    actualResults: V75ActualResult[]
  ): Promise<V75PostRaceAnalysis> => {
    console.log(`🔍 Comparing predictions with actual results for ${date}`);
    
    const raceAnalyses: V75RaceAnalysis[] = [];
    
    for (const actualResult of actualResults) {
      try {
        // Get cached predictions for this race
        const cachedPredictions = await V75CacheService.getRaceAnalysis(actualResult.raceId);
        
        if (!cachedPredictions) {
          console.warn(`No cached predictions found for race ${actualResult.raceNumber} (${actualResult.raceId})`);
          continue;
        }
        
        console.log(`📊 Analyzing race ${actualResult.raceNumber}:`, {
          predictedHorses: cachedPredictions.horses.length,
          actualHorses: actualResult.finishOrder.length
        });
        
        // Calculate prediction accuracy for each horse
        const predictionAccuracy: V75PredictionAccuracy[] = [];
        
        cachedPredictions.horses.forEach(prediction => {
          const actualFinish = actualResult.finishOrder.find(
            result => result.horseId === prediction.horseId
          );
          
          if (!actualFinish) {
            console.warn(`Horse ${prediction.horseId} (${prediction.horseName}) not found in actual results`);
            return;
          }
          
          const rankDifference = prediction.rank - actualFinish.position;
          const wasTopPick = prediction.rank <= 3;
          const actuallyPlaced = actualFinish.position <= 3;
          
          predictionAccuracy.push({
            horseId: prediction.horseId,
            horseName: prediction.horseName,
            postPosition: prediction.postPosition,
            predictedScore: prediction.finalScore,
            predictedRank: prediction.rank,
            actualFinishPosition: actualFinish.position,
            rankDifference,
            wasTopPick,
            actuallyPlaced,
            correctPrediction: wasTopPick && actuallyPlaced
          });
        });
        
        // Calculate overall accuracy for this race
        const topPicks = predictionAccuracy.filter(p => p.wasTopPick);
        const topPicksCorrect = topPicks.filter(p => p.actuallyPlaced).length;
        const averageRankDifference = predictionAccuracy.length > 0 ? 
          predictionAccuracy.reduce((sum, p) => sum + Math.abs(p.rankDifference), 0) / predictionAccuracy.length : 0;
        const perfectPredictions = predictionAccuracy.filter(p => p.rankDifference === 0).length;
        
        raceAnalyses.push({
          raceId: actualResult.raceId,
          raceNumber: actualResult.raceNumber,
          raceDate: date,
          distance: actualResult.distance,
          actualResults: actualResult,
          predictionAccuracy,
          overallAccuracy: {
            topPicksCorrect,
            topPicksTotal: topPicks.length,
            averageRankDifference,
            perfectPredictions
          }
        });
        
        console.log(`✅ Race ${actualResult.raceNumber} analysis complete:`, {
          topPicksCorrect: `${topPicksCorrect}/${topPicks.length}`,
          avgRankDiff: Math.round(averageRankDifference * 10) / 10,
          perfectPredictions
        });
        
      } catch (error) {
        console.error(`Error analyzing race ${actualResult.raceNumber}:`, error);
      }
    }
    
    if (raceAnalyses.length === 0) {
      throw new Error('No races could be analyzed - no matching predictions found');
    }
    
    // Calculate overall performance metrics
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
      gameId: `v75-${date}`,
      analysisDate: date,
      races: raceAnalyses,
      overallPerformance: {
        totalRaces,
        averageAccuracy,
        bestRaceAccuracy,
        worstRaceAccuracy
      }
    };
  };

  const analyzePostRace = async (date: string) => {
    setLoading(true);
    setError("");
    
    try {
      console.log(`🎯 Starting post-race analysis for V75 ${date}`);
      
      // Step 1: Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      
      // Step 2: Check if date is not in the future
      const analysisDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      
      if (analysisDate > today) {
        throw new Error('Cannot analyze future races. Please select a past date.');
      }
      
      // Step 3: Fetch actual race results
      console.log(`📊 Fetching actual results for ${date}...`);
      const actualResults = await fetchActualResults(date);
      
      if (actualResults.length === 0) {
        throw new Error('No completed V75 races found for this date. The races may not have finished yet or no V75 was held.');
      }
      
      console.log(`✅ Found ${actualResults.length} completed races`);
      
      // Step 4: Compare with predictions
      console.log(`🔍 Comparing with cached predictions...`);
      const postRaceAnalysis = await compareWithPredictions(date, actualResults);
      
      setAnalysis(postRaceAnalysis);
      
      const accuracyPercentage = Math.round(postRaceAnalysis.overallPerformance.averageAccuracy * 100);
      
      toast({
        title: "Post-Race Analysis Complete",
        description: `Analyzed ${postRaceAnalysis.races.length} races with ${accuracyPercentage}% average accuracy.`,
      });
      
      console.log(`✅ Post-race analysis complete:`, {
        racesAnalyzed: postRaceAnalysis.races.length,
        averageAccuracy: `${accuracyPercentage}%`,
        bestRace: `${Math.round(postRaceAnalysis.overallPerformance.bestRaceAccuracy * 100)}%`,
        worstRace: `${Math.round(postRaceAnalysis.overallPerformance.worstRaceAccuracy * 100)}%`
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Post-Race Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      console.error('❌ Post-race analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setError("");
  };

  return {
    loading,
    analysis,
    error,
    analyzePostRace,
    clearAnalysis
  };
};
