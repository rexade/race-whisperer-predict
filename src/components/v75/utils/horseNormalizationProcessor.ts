
import { KmTime } from '../../../services/types/kmTimeTypes';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { ExtractedHorseData } from './horseDataExtractor';

export const applyHorseNormalization = (
  horse: any,
  race: any,
  rawKmTime: KmTime,
  extractedData: ExtractedHorseData,
  weights: NormalizationWeights
) => {
  const factors: ModernNormalizationFactors = {
    postPosition: horse.postPosition,
    distance: horse.distance,
    raceDistance: race.distance,
    startMethod: race.startMethod,
    shoesFront: extractedData.frontShoesStr,
    shoesBack: extractedData.backShoesStr,
    sulkyType: extractedData.sulkyTypeString,
    homeTrack: extractedData.safeHorseTrack,
    driverExperience: horse.driver.experience,
    driverWinPercentage: horse.driver.winPercentage,
    driverWinPercentage2025: horse.driver.winPercentage2025,
    horseForm: horse.statistics.winPercentage,
    raceType: 'trot',
    timeOfDay: '',
    startPoints: horse.statistics.startPoints,
    placePercentage: horse.statistics.placePercentage,
    horseWinPercentage: horse.statistics.winPercentage,
    earningsPerStart: horse.statistics.earningsPerStart
  };

  return applyModernKmNormalization(rawKmTime, factors, weights);
};
