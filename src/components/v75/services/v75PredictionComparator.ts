
import { V75CacheService } from '../../../services/v75CacheService';
import { V75ActualResult, V75RaceAnalysis, V75PredictionAccuracy, V75PostRaceAnalysis } from '../types/postRaceAnalysisTypes';
import { calculateOverallPerformance } from '../utils/postRaceUtils';
import { 
  calculatePositionMAE, 
  calculateTimeMAE, 
  calculateTimeDifference,
  findBestTime 
} from '../utils/timeAnalysisUtils';

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
          actualHorses: actualResult.finishOrder.length,
          hasBestTime: !!actualResult.bestTime
        });
        
        // Calculate prediction accuracy for each horse
        const predictionAccuracy: V75PredictionAccuracy[] = [];
        const positionPredictions: Array<{ predicted: number; actual: number }> = [];
        const timePredictions: Array<{ predicted: any; actual: any }> = [];
        
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
          
          // Calculate time difference if both predicted and actual times are available
          let timeDifference;
          if (prediction.predictedTime && actualFinish.kmTime) {
            timeDifference = calculateTimeDifference(prediction.predictedTime, actualFinish.kmTime);
            timePredictions.push({
              predicted: prediction.predictedTime,
              actual: actualFinish.kmTime
            });
          }
          
          predictionAccuracy.push({
            horseId: prediction.horseId,
            horseName: prediction.horseName,
            postPosition: prediction.postPosition,
            predictedScore: prediction.finalScore,
            predictedRank: prediction.rank,
            predictedTime: prediction.predictedTime,
            actualFinishPosition: actualFinish.position,
            actualTime: actualFinish.kmTime,
            timeDifference,
            rankDifference,
            wasTopPick,
            actuallyPlaced,
            correctPrediction: wasTopPick && actuallyPlaced
          });
          
          // Collect position predictions for MAE calculation
          positionPredictions.push({
            predicted: prediction.rank,
            actual: actualFinish.position
          });
        });
        
        // Calculate MAE scores
        const meanAbsoluteError = calculatePositionMAE(positionPredictions);
        const timeMAE = timePredictions.length > 0 ? calculateTimeMAE(timePredictions) : undefined;
        
        // Calculate best time prediction accuracy
        let bestTimeAccuracy;
        if (actualResult.bestTime) {
          const predictedBestHorse = cachedPredictions.horses
            .filter(h => h.predictedTime)
            .reduce((best, current) => {
              if (!best.predictedTime || !current.predictedTime) return best;
              const bestSeconds = best.predictedTime.minutes * 60 + best.predictedTime.seconds + best.predictedTime.tenths / 10;
              const currentSeconds = current.predictedTime.minutes * 60 + current.predictedTime.seconds + current.predictedTime.tenths / 10;
              return currentSeconds < bestSeconds ? current : best;
            });
          
          const actualBestHorse = actualResult.finishOrder.find(h => 
            h.kmTime && 
            h.kmTime.minutes === actualResult.bestTime?.minutes &&
            h.kmTime.seconds === actualResult.bestTime?.seconds &&
            h.kmTime.tenths === actualResult.bestTime?.tenths
          );
          
          if (predictedBestHorse && actualBestHorse) {
            bestTimeAccuracy = {
              predictedBest: predictedBestHorse.horseName,
              actualBest: actualBestHorse.horseName,
              correctBestPrediction: predictedBestHorse.horseId === actualBestHorse.horseId
            };
          }
        }
        
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
            perfectPredictions,
            meanAbsoluteError,
            timeMAE,
            bestTimeAccuracy
          }
        });
        
        console.log(`✅ Race ${actualResult.raceNumber} analysis complete:`, {
          topPicksCorrect: `${topPicksCorrect}/${topPicks.length}`,
          avgRankDiff: Math.round(averageRankDifference * 10) / 10,
          perfectPredictions,
          mae: Math.round(meanAbsoluteError * 100) / 100,
          timeMAE: timeMAE ? Math.round(timeMAE * 100) / 100 : 'N/A',
          bestTimePredicted: bestTimeAccuracy?.correctBestPrediction || false
        });
        
      } catch (error) {
        console.error(`Error analyzing race ${actualResult.raceNumber}:`, error);
      }
    }
    
    if (raceAnalyses.length === 0) {
      throw new Error('No races could be analyzed - no matching predictions found');
    }
    
    // Calculate enhanced overall performance metrics
    const overallPerformance = this.calculateEnhancedOverallPerformance(raceAnalyses);
    
    return {
      gameId: `v75-${date}`,
      analysisDate: date,
      races: raceAnalyses,
      overallPerformance
    };
  }

  private static calculateEnhancedOverallPerformance(races: V75RaceAnalysis[]) {
    const totalRaces = races.length;
    
    // Calculate average accuracy
    const accuracies = races.map(race => race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal);
    const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / totalRaces;
    const bestRaceAccuracy = Math.max(...accuracies);
    const worstRaceAccuracy = Math.min(...accuracies);
    
    // Calculate overall MAE
    const allMAEs = races.map(race => race.overallAccuracy.meanAbsoluteError);
    const overallMAE = allMAEs.reduce((sum, mae) => sum + mae, 0) / totalRaces;
    
    // Calculate overall time MAE
    const timeMAEs = races
      .map(race => race.overallAccuracy.timeMAE)
      .filter(mae => mae !== undefined) as number[];
    const overallTimeMAE = timeMAEs.length > 0 ? 
      timeMAEs.reduce((sum, mae) => sum + mae, 0) / timeMAEs.length : undefined;
    
    // Count correct best time predictions
    const bestTimesPredicted = races.filter(race => 
      race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction
    ).length;
    
    return {
      totalRaces,
      averageAccuracy,
      bestRaceAccuracy,
      worstRaceAccuracy,
      overallMAE,
      overallTimeMAE,
      bestTimesPredicted
    };
  }
}
