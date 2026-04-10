
import { NormalizationWeights, applyModernKmNormalization, ModernNormalizationFactors } from '../../../services/modernKm/index';
import { PostPositionCurves } from '../../../services/modernKm/index';
import { V75RaceResult } from '../types/raceResultTypes';

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
        if (!horse.rawKmTime) return horse;
        
        if (typeof horse.horseName !== 'string') {
          throw new Error(`Horse name type error during reanalysis for horse ${horse.horseId}`);
        }
        
        const factors: ModernNormalizationFactors = {
          postPosition: horse.postPosition,
          distance: horse.distance,
          raceDistance: race.distance,
          startMethod: race.startMethod,
          shoesFront: horse.shoesFront ? "1" : "0",
          shoesBack: horse.shoesBack ? "1" : "0",
          sulkyType: horse.sulkyType || "VA",
          homeTrack: horse.homeTrack || "Unknown",
          raceTrack: race.track || "Unknown",
          driverExperience: 0,
          driverWinPercentage: horse.driver2025WinPercentage || 0,
          startPoints: horse.statistics?.startPoints || 500,
          placePercentage: horse.statistics?.placePercentage || 5000,
          horseWinPercentage: horse.statistics?.winPercentage || 1500,
          earningsPerStart: horse.statistics?.earningsPerStart || 300000 // 3000 SEK in öre
        };
        
        const modernNormalizedResult = applyModernKmNormalization(horse.rawKmTime, factors, weights, postPositionCurves);
        
        return {
          ...horse,
          modernNormalizedResult
        };
      });
      
      return {
        ...race,
        horses: updatedHorses
      };
    });
  }
}
