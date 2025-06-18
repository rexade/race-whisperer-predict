
import { V75PostRaceAnalysis, V75RaceAnalysis, V75PredictionAccuracy } from '../types/postRaceAnalysisTypes';
import { V75CacheService } from '../../../services/v75CacheService';
import { RaceAnalysisData } from '../../../services/v75Cache/types';

export class V75PredictionComparator {
  /**
   * Compare cached predictions with actual race results - NO FALLBACK REGENERATION
   */
  static async compareWithPredictions(
    analysisDate: string,
    actualResults: any[]
  ): Promise<V75PostRaceAnalysis> {
    console.log(`🎯 STRICT prediction comparison for ${analysisDate} - NO FALLBACK REGENERATION`);
    console.log(`📊 Actual results received: ${actualResults.length} races`);

    const races: V75RaceAnalysis[] = [];
    
    // Get all cached race analyses for this date
    console.log(`🔍 Fetching all cached race analyses...`);
    const allRaceAnalyses = await V75CacheService.getAllRaceAnalyses();
    
    const relevantAnalyses = allRaceAnalyses.filter(analysis => analysis.analysisDate === analysisDate);
    console.log(`📋 Found ${relevantAnalyses.length} relevant analyses for ${analysisDate}`);
    
    if (relevantAnalyses.length === 0) {
      console.log(`❌ No cached predictions found for ${analysisDate}`);
      console.log(`🗂️ Available analysis dates:`, [...new Set(allRaceAnalyses.map(a => a.analysisDate))]);
      throw new Error(`No races could be analyzed - no matching predictions found for ${analysisDate}`);
    }

    for (const actualRace of actualResults) {
      console.log(`\n🏁 Processing race ${actualRace.raceNumber} (${actualRace.raceId})`);
      
      // Find matching cached prediction
      const cachedAnalysis = await V75CacheService.getRaceAnalysis(actualRace.raceId);
      
      if (!cachedAnalysis) {
        console.log(`⚠️ No cached prediction found for race ${actualRace.raceNumber} (${actualRace.raceId})`);
        continue;
      }
      
      console.log(`✅ Found cached prediction for race ${actualRace.raceNumber}`);
      console.log(`🐎 Cached horses: ${cachedAnalysis.horses.length}`);
      
      // STRICT: No fallback regeneration - use only what's in cache
      const horsesWithoutPredictedTimes = cachedAnalysis.horses.filter(h => !h.predictedTime);
      console.log(`⚠️ Horses without predicted times: ${horsesWithoutPredictedTimes.length}/${cachedAnalysis.horses.length}`);
      
      if (horsesWithoutPredictedTimes.length > 0) {
        console.log(`🚫 STRICT MODE: NOT regenerating missing predicted times`);
        console.log(`📝 Horses without predicted times will have undefined time comparisons`);
        horsesWithoutPredictedTimes.forEach(horse => {
          console.log(`  - ${horse.horseName}: No predicted time (likely estimated data)`);
        });
      }
      
      // Compare predictions with actual results using only cached data
      const raceAnalysis = this.compareRaceResults(actualRace, cachedAnalysis);
      races.push(raceAnalysis);
    }

    if (races.length === 0) {
      console.log(`❌ No races could be compared successfully`);
      throw new Error('No races could be analyzed - no matching predictions found');
    }

    console.log(`✅ Successfully compared ${races.length} races`);

    // Calculate overall performance metrics
    const overallPerformance = this.calculateOverallPerformance(races);

    return {
      gameId: `v75-${analysisDate}`,
      analysisDate,
      races,
      overallPerformance
    };
  }

  private static compareRaceResults(
    actualRace: any,
    cachedAnalysis: RaceAnalysisData
  ): V75RaceAnalysis {
    console.log(`🔍 Comparing race ${actualRace.raceNumber}:`);
    console.log(`  Actual finishers: ${actualRace.finishOrder.length}`);
    console.log(`  Cached predictions: ${cachedAnalysis.horses.length}`);

    const predictionAccuracy: V75PredictionAccuracy[] = [];

    // Compare each horse's prediction vs actual result
    for (const cachedHorse of cachedAnalysis.horses) {
      const actualFinish = actualRace.finishOrder.find(
        (finish: any) => finish.horseId === cachedHorse.horseId
      );

      if (!actualFinish) {
        console.log(`⚠️ Horse ${cachedHorse.horseName} (${cachedHorse.horseId}) not found in actual results`);
        continue;
      }

      // STRICT: Only use cached predicted times - no regeneration
      console.log(`🐎 COMPARING ${cachedHorse.horseName}:`);
      console.log(`  - Cached predicted time:`, cachedHorse.predictedTime);
      console.log(`  - Actual finish time:`, actualFinish.kmTime);

      const accuracy: V75PredictionAccuracy = {
        horseId: cachedHorse.horseId,
        horseName: cachedHorse.horseName,
        postPosition: cachedHorse.postPosition,
        predictedScore: cachedHorse.finalScore,
        predictedRank: cachedHorse.rank,
        predictedTime: cachedHorse.predictedTime, // STRICT: Use only cached data
        actualFinishPosition: actualFinish.position,
        actualTime: actualFinish.kmTime,
        timeDifference: this.calculateTimeDifference(cachedHorse.predictedTime, actualFinish.kmTime),
        rankDifference: cachedHorse.rank - actualFinish.position,
        wasTopPick: cachedHorse.rank <= 3,
        actuallyPlaced: actualFinish.position <= 3,
        correctPrediction: cachedHorse.rank <= 3 && actualFinish.position <= 3
      };

      console.log(`  - Time difference calculated: ${accuracy.timeDifference}`);
      predictionAccuracy.push(accuracy);
    }

    console.log(`📊 Prediction accuracy calculated for ${predictionAccuracy.length} horses`);

    // Calculate race-level accuracy metrics
    const overallAccuracy = this.calculateRaceAccuracy(predictionAccuracy);

    return {
      raceId: actualRace.raceId,
      raceNumber: actualRace.raceNumber,
      raceDate: actualRace.date || cachedAnalysis.analysisDate,
      distance: actualRace.distance,
      actualResults: actualRace,
      predictionAccuracy,
      overallAccuracy
    };
  }

  private static calculateTimeDifference(
    predictedTime?: { minutes: number; seconds: number; tenths: number },
    actualTime?: { minutes: number; seconds: number; tenths: number }
  ): number | undefined {
    console.log(`⏱️ CALCULATING TIME DIFFERENCE:`);
    console.log(`  - Predicted:`, predictedTime);
    console.log(`  - Actual:`, actualTime);
    
    if (!predictedTime || !actualTime) {
      console.log(`  - Missing time data, returning undefined`);
      return undefined;
    }

    if (predictedTime.minutes === undefined || predictedTime.seconds === undefined || predictedTime.tenths === undefined ||
        actualTime.minutes === undefined || actualTime.seconds === undefined || actualTime.tenths === undefined) {
      console.log(`  - Invalid time data structure, returning undefined`);
      return undefined;
    }

    const predictedSeconds = predictedTime.minutes * 60 + predictedTime.seconds + predictedTime.tenths * 0.1;
    const actualSeconds = actualTime.minutes * 60 + actualTime.seconds + actualTime.tenths * 0.1;
    const difference = Math.abs(predictedSeconds - actualSeconds);

    console.log(`  - Predicted seconds: ${predictedSeconds.toFixed(1)}`);
    console.log(`  - Actual seconds: ${actualSeconds.toFixed(1)}`);
    console.log(`  - Difference: ${difference.toFixed(1)} seconds`);

    return difference;
  }

  private static calculateRaceAccuracy(predictionAccuracy: V75PredictionAccuracy[]) {
    const topPicksCorrect = predictionAccuracy.filter(p => p.correctPrediction).length;
    const topPicksTotal = predictionAccuracy.filter(p => p.wasTopPick).length;
    const perfectPredictions = predictionAccuracy.filter(p => p.rankDifference === 0).length;
    
    const rankDifferences = predictionAccuracy.map(p => Math.abs(p.rankDifference));
    const averageRankDifference = rankDifferences.length > 0 
      ? rankDifferences.reduce((sum, diff) => sum + diff, 0) / rankDifferences.length 
      : 0;
    
    const meanAbsoluteError = averageRankDifference;

    // Calculate time MAE only for horses with predicted times
    const timeDifferences = predictionAccuracy
      .map(p => p.timeDifference)
      .filter(diff => diff !== undefined) as number[];
    
    const timeMAE = timeDifferences.length > 0
      ? timeDifferences.reduce((sum, diff) => sum + diff, 0) / timeDifferences.length
      : undefined;

    console.log(`📊 Race accuracy metrics:`);
    console.log(`  - Time comparisons available: ${timeDifferences.length}/${predictionAccuracy.length}`);
    console.log(`  - Time MAE: ${timeMAE?.toFixed(2) || 'N/A'} seconds`);

    // Find best time predictions
    const bestActualHorse = predictionAccuracy.reduce((best, current) => 
      !best || (current.actualFinishPosition < best.actualFinishPosition) ? current : best
    );
    
    const bestPredictedHorse = predictionAccuracy.reduce((best, current) => 
      !best || (current.predictedRank < best.predictedRank) ? current : best
    );

    return {
      topPicksCorrect,
      topPicksTotal,
      averageRankDifference,
      perfectPredictions,
      meanAbsoluteError,
      timeMAE,
      bestTimeAccuracy: {
        predictedBest: bestPredictedHorse.horseName,
        actualBest: bestActualHorse.horseName,
        correctBestPrediction: bestPredictedHorse.horseId === bestActualHorse.horseId
      }
    };
  }

  private static calculateOverallPerformance(races: V75RaceAnalysis[]) {
    const totalRaces = races.length;
    
    const accuracySum = races.reduce((sum, race) => 
      sum + (race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal), 0
    );
    const averageAccuracy = accuracySum / totalRaces;

    const raceAccuracies = races.map(race => 
      race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal
    );
    const bestRaceAccuracy = Math.max(...raceAccuracies);
    const worstRaceAccuracy = Math.min(...raceAccuracies);

    const overallMAE = races.reduce((sum, race) => 
      sum + race.overallAccuracy.meanAbsoluteError, 0
    ) / totalRaces;

    const overallTimeMAE = races
      .map(race => race.overallAccuracy.timeMAE)
      .filter(mae => mae !== undefined)
      .reduce((sum, mae, _, arr) => sum + mae! / arr.length, 0) || undefined;

    const bestTimesPredicted = races.filter(race => 
      race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction
    ).length;

    console.log(`📊 Overall performance summary:`);
    console.log(`  - Time MAE available for ${races.filter(r => r.overallAccuracy.timeMAE !== undefined).length}/${totalRaces} races`);
    console.log(`  - Overall time MAE: ${overallTimeMAE?.toFixed(2) || 'N/A'} seconds`);

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
