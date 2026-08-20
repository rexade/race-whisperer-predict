
import { NormalizationWeights, applyModernKmNormalization } from '../../../services/modernKm/index';
import { PostPositionCurves } from '../../../services/modernKm/index';
import { V75RaceResult } from '../types/raceResultTypes';
import { RaceScoreCalculator } from './raceScoreCalculator';

export class RaceReanalysisService {
  /**
   * Re-apply modern normalization with updated weights to existing results
   */
  static reanalyzeWithNewWeights(
    v75Results: V75RaceResult[], 
    weights: NormalizationWeights,
    postPositionCurves?: PostPositionCurves
  ): V75RaceResult[] {
    if (v75Results.length === 0) return v75Results;
    
    
    
    return v75Results.map(race => {
      if (!race.analysisComplete || race.horses.length === 0) return race;
      
      const updatedHorses = race.horses.map(horse => {
        const previousResult = horse.modernNormalizedResult;
        const factors = previousResult?.normalizationFactors;
        if (!horse.rawKmTime || !factors) return horse;
        
        const modernNormalizedResult = applyModernKmNormalization(horse.rawKmTime, factors, weights, postPositionCurves);
        modernNormalizedResult.isEstimated = previousResult.isEstimated;
        modernNormalizedResult.normalizationFactors = factors;
        const predictedTime = modernNormalizedResult.isEstimated
          ? undefined
          : modernNormalizedResult.modernNormalizedTime;
        
        return {
          ...horse,
          modernNormalizedResult,
          predictedTime
        };
      });
      
      return {
        ...race,
        horses: RaceScoreCalculator.calculateScoresAndRanks(updatedHorses)
      };
    });
  }
}
