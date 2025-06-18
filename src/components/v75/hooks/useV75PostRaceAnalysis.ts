
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
      // Fetch results from ATG API
      const response = await fetch(`https://www.atg.se/services/racinginfo/v1/api/results/calendar/day/${date}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Results API response:', data);
      
      // Find V75 games in results
      const v75Games = data.games?.V75 || [];
      
      if (v75Games.length === 0) {
        throw new Error('No V75 results found for this date');
      }
      
      const v75Game = v75Games[0];
      const results: V75ActualResult[] = [];
      
      // Process each race result
      for (const raceResult of v75Game.races || []) {
        try {
          const raceResponse = await fetch(`https://www.atg.se/services/racinginfo/v1/api/races/${raceResult.id}/results`);
          
          if (!raceResponse.ok) {
            console.warn(`Failed to fetch detailed results for race ${raceResult.id}`);
            continue;
          }
          
          const raceData = await raceResponse.json();
          
          const finishOrder = (raceData.results || [])
            .sort((a: any, b: any) => a.finalPosition - b.finalPosition)
            .map((result: any, index: number) => ({
              position: index + 1,
              horseId: result.horse.id,
              horseName: result.horse.name,
              postPosition: result.postPosition,
              time: result.time || 'N/A',
              driver: `${result.driver.firstName} ${result.driver.lastName}`
            }));
          
          results.push({
            raceId: raceResult.id,
            raceNumber: raceResult.number,
            finishOrder,
            raceTime: raceData.raceTime || 'N/A',
            weather: raceData.weather,
            track: raceData.track?.name,
            distance: raceData.distance
          });
          
        } catch (error) {
          console.error(`Error fetching race ${raceResult.id} results:`, error);
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error fetching actual results:', error);
      throw error;
    }
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
          console.warn(`No cached predictions found for race ${actualResult.raceNumber}`);
          continue;
        }
        
        // Calculate prediction accuracy for each horse
        const predictionAccuracy: V75PredictionAccuracy[] = [];
        
        cachedPredictions.horses.forEach(prediction => {
          const actualFinish = actualResult.finishOrder.find(
            result => result.horseId === prediction.horseId
          );
          
          if (!actualFinish) {
            console.warn(`Horse ${prediction.horseId} not found in actual results`);
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
        const averageRankDifference = predictionAccuracy.reduce(
          (sum, p) => sum + Math.abs(p.rankDifference), 0
        ) / predictionAccuracy.length;
        const perfectPredictions = predictionAccuracy.filter(
          p => p.rankDifference === 0
        ).length;
        
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
        
      } catch (error) {
        console.error(`Error analyzing race ${actualResult.raceNumber}:`, error);
      }
    }
    
    // Calculate overall performance metrics
    const totalRaces = raceAnalyses.length;
    const averageAccuracy = raceAnalyses.reduce(
      (sum, race) => sum + (race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal), 0
    ) / totalRaces;
    
    const raceAccuracies = raceAnalyses.map(
      race => race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal
    );
    
    return {
      gameId: `v75-${date}`,
      analysisDate: date,
      races: raceAnalyses,
      overallPerformance: {
        totalRaces,
        averageAccuracy,
        bestRaceAccuracy: Math.max(...raceAccuracies),
        worstRaceAccuracy: Math.min(...raceAccuracies)
      }
    };
  };

  const analyzePostRace = async (date: string) => {
    setLoading(true);
    setError("");
    
    try {
      console.log(`🎯 Starting post-race analysis for V75 ${date}`);
      
      // Fetch actual race results
      const actualResults = await fetchActualResults(date);
      
      if (actualResults.length === 0) {
        throw new Error('No race results found for this date');
      }
      
      // Compare with predictions
      const postRaceAnalysis = await compareWithPredictions(date, actualResults);
      
      setAnalysis(postRaceAnalysis);
      
      toast({
        title: "Post-Race Analysis Complete",
        description: `Analyzed ${postRaceAnalysis.races.length} races with ${Math.round(postRaceAnalysis.overallPerformance.averageAccuracy * 100)}% average accuracy.`,
      });
      
      console.log(`✅ Post-race analysis complete:`, postRaceAnalysis);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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
