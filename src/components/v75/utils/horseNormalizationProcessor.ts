
import { KmTime } from '../../../services/types/kmTimeTypes';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { ExtractedHorseData } from './horseDataExtractor';

/**
 * Create a fallback KM time based on horse statistics and race characteristics
 */
const createFallbackKmTime = (
  horse: any,
  race: any,
  extractedData: ExtractedHorseData
): KmTime => {
  console.log(`🎯 Creating fallback KM time for horse ${horse.horseId} (${extractedData.safeHorseName})`);
  
  // Base time calculation using race distance and typical trotting speed
  // Average trotting speed is approximately 1.65 minutes per km
  const baseKmSpeed = 1.65; // minutes per km
  const baseTimeMinutes = baseKmSpeed;
  
  // Apply adjustments based on available statistics
  let adjustedTimeMinutes = baseTimeMinutes;
  
  // Adjust based on horse performance statistics
  if (horse.statistics?.winPercentage > 0) {
    const winPercentageAdjustment = (20 - horse.statistics.winPercentage) * 0.001; // Max ±0.02 minutes
    adjustedTimeMinutes += winPercentageAdjustment;
    console.log(`  - Win % adjustment (${horse.statistics.winPercentage}%): ${winPercentageAdjustment.toFixed(4)} minutes`);
  }
  
  if (horse.statistics?.startPoints > 0) {
    const startPointsAdjustment = (70 - horse.statistics.startPoints) * 0.0002; // Max ±0.014 minutes
    adjustedTimeMinutes += startPointsAdjustment;
    console.log(`  - Start points adjustment (${horse.statistics.startPoints}): ${startPointsAdjustment.toFixed(4)} minutes`);
  }
  
  // Post position penalty (later positions generally slower)
  const postPositionPenalty = (horse.postPosition - 1) * 0.002; // 0.002 minutes per position
  adjustedTimeMinutes += postPositionPenalty;
  console.log(`  - Post position penalty (${horse.postPosition}): ${postPositionPenalty.toFixed(4)} minutes`);
  
  // Convert to KmTime format
  const totalSeconds = adjustedTimeMinutes * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const seconds = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - seconds) * 10);
  
  const fallbackTime: KmTime = {
    minutes,
    seconds,
    tenths
  };
  
  console.log(`✅ Generated fallback KM time: ${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`);
  console.log(`  - Based on: win% ${horse.statistics?.winPercentage || 0}%, start points ${horse.statistics?.startPoints || 0}, post ${horse.postPosition}`);
  
  return fallbackTime;
};

export const applyHorseNormalization = (
  horse: any,
  race: any,
  rawKmTime: KmTime | undefined,
  extractedData: ExtractedHorseData,
  weights: NormalizationWeights
) => {
  console.log(`🔍 NORMALIZATION DEBUG - Horse ${horse.horseId} (${extractedData.safeHorseName}):`);
  console.log(`  - Has raw KM time: ${!!rawKmTime}`);
  
  // Use raw KM time if available, otherwise create a fallback
  let effectiveKmTime: KmTime;
  let isEstimated = false;
  
  if (rawKmTime) {
    effectiveKmTime = rawKmTime;
    console.log(`  - Using raw KM time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);
  } else {
    effectiveKmTime = createFallbackKmTime(horse, race, extractedData);
    isEstimated = true;
    console.log(`  - Using estimated KM time: ${effectiveKmTime.minutes}:${effectiveKmTime.seconds.toString().padStart(2, '0')}.${effectiveKmTime.tenths}`);
  }

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

  const result = applyModernKmNormalization(effectiveKmTime, factors, weights);
  
  // Add a flag to indicate if this was estimated
  (result as any).isEstimated = isEstimated;
  
  console.log(`  - Final normalized time: ${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths} ${isEstimated ? '(ESTIMATED)' : '(FROM RAW DATA)'}`);
  
  return result;
};
