
import { V75CacheService } from '../../../services/v75CacheService';
import { V75ActualResult, V75RaceAnalysis, V75PredictionAccuracy, V75PostRaceAnalysis } from '../types/postRaceAnalysisTypes';
import { calculateOverallPerformance } from '../utils/postRaceUtils';

export class V75PredictionComparator {
  static async compareWithPredictions(
    date: string,
    actualResults: V75ActualResult[]
  ): Promise<V75PostRaceAnalysis> {
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
    const overallPerformance = calculateOverallPerformance(raceAnalyses);
    
    return {
      gameId: `v75-${date}`,
      analysisDate: date,
      races: raceAnalyses,
      overallPerformance
    };
  }
}
