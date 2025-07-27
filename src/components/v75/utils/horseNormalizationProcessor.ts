
import { KmTime } from '../../../services/types/kmTimeTypes';
import { 
  applyModernKmNormalization,
  NormalizationWeights,
  ModernNormalizationFactors
} from '../../../services/modernKm/index';
import { ExtractedHorseData } from './horseDataExtractor';
import { EnhancedXanderDebugger } from '../../../services/investigation/enhancedXanderDebugger';

/**
 * Create a fallback KM time based on horse statistics and race characteristics
 * ONLY used when absolutely necessary for UI display
 */
const createFallbackKmTime = (
  horse: any,
  race: any,
  extractedData: ExtractedHorseData
): KmTime => {
  console.log(`🎯 Creating fallback KM time for horse ${horse.horseId} (${extractedData.safeHorseName})`);
  console.log(`⚠️ WARNING: This is estimated data and will NOT be used for post-race comparisons`);
  
  // Base time calculation using race distance and typical trotting speed
  const baseKmSpeed = 1.65; // minutes per km
  const baseTimeMinutes = baseKmSpeed;
  
  // Apply adjustments based on available statistics
  let adjustedTimeMinutes = baseTimeMinutes;
  
  // Adjust based on horse performance statistics
  if (horse.statistics?.winPercentage > 0) {
    const winPercentageAdjustment = (20 - horse.statistics.winPercentage) * 0.001;
    adjustedTimeMinutes += winPercentageAdjustment;
    console.log(`  - Win % adjustment (${horse.statistics.winPercentage}%): ${winPercentageAdjustment.toFixed(4)} minutes`);
  }
  
  if (horse.statistics?.startPoints > 0) {
    const startPointsAdjustment = (70 - horse.statistics.startPoints) * 0.0002;
    adjustedTimeMinutes += startPointsAdjustment;
    console.log(`  - Start points adjustment (${horse.statistics.startPoints}): ${startPointsAdjustment.toFixed(4)} minutes`);
  }
  
  // Post position penalty
  const postPositionPenalty = (horse.postPosition - 1) * 0.002;
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
  
  console.log(`✅ Generated fallback KM time: ${minutes}:${seconds.toString().padStart(2, '0')}.${tenths} (ESTIMATED - NOT FOR PREDICTIONS)`);
  
  return fallbackTime;
};

export const applyHorseNormalization = (
  horse: any,
  race: any,
  rawKmTime: KmTime | undefined,
  extractedData: ExtractedHorseData,
  weights: NormalizationWeights
) => {
  const isXander = extractedData.safeHorseName.toLowerCase().includes('xander');
  
  if (isXander) {
    EnhancedXanderDebugger.addCheckpoint(
      'start_normalization',
      'horse_normalization',
      extractedData.safeHorseName,
      {
        horseId: horse.horseId,
        hasRawKmTime: !!rawKmTime,
        rawKmTime: rawKmTime ? `${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}` : 'None',
        postPosition: horse.postPosition,
        raceDistance: race.distance
      },
      true
    );
  }
  
  console.log(`🔍 STRICT NORMALIZATION - Horse ${horse.horseId} (${extractedData.safeHorseName}):`);
  console.log(`  - Has raw KM time: ${!!rawKmTime}`);
  
  // STRICT: Only process horses with actual raw KM times for predictions
  if (!rawKmTime) {
    console.log(`  🚫 NO RAW KM TIME - Creating fallback for UI display only`);
    
    if (isXander) {
      EnhancedXanderDebugger.logProcessingPhase(
        extractedData.safeHorseName,
        'fallback_creation',
        {
          reason: 'no_raw_km_time',
          willUseEstimatedData: true,
          notForPredictions: true
        }
      );
    }
    
    const fallbackTime = createFallbackKmTime(horse, race, extractedData);
    
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
      horseForm: horse.statistics.winPercentage,
      raceType: 'trot',
      timeOfDay: '',
      startPoints: horse.statistics.startPoints,
      placePercentage: horse.statistics.placePercentage,
      horseWinPercentage: horse.statistics.winPercentage,
      earningsPerStart: horse.statistics.earningsPerStart
    };

    const result = applyModernKmNormalization(fallbackTime, factors, weights);
    
    // Mark as estimated - this will prevent storage for post-race comparison
    (result as any).isEstimated = true;
    
    if (isXander) {
      EnhancedXanderDebugger.logNormalizationStep(
        extractedData.safeHorseName,
        'fallback_normalization',
        fallbackTime,
        result.modernNormalizedTime,
        result.adjustments.total,
        'Estimated fallback time normalization - UI display only'
      );
      
      EnhancedXanderDebugger.addCheckpoint(
        'fallback_normalization_complete',
        'horse_normalization',
        extractedData.safeHorseName,
        {
          fallbackTime: `${fallbackTime.minutes}:${fallbackTime.seconds.toString().padStart(2, '0')}.${fallbackTime.tenths}`,
          normalizedTime: `${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths}`,
          totalAdjustment: result.adjustments.total,
          isEstimated: true
        },
        true
      );
    }
    
    console.log(`  - Fallback normalized time: ${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths} (ESTIMATED - UI ONLY)`);
    
    return result;
  }

  // Process horses with actual raw KM times
  console.log(`  ✅ Processing with raw KM time: ${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`);

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
    
    horseForm: horse.statistics.winPercentage,
    raceType: 'trot',
    timeOfDay: '',
    startPoints: horse.statistics.startPoints,
    placePercentage: horse.statistics.placePercentage,
    horseWinPercentage: horse.statistics.winPercentage,
    earningsPerStart: horse.statistics.earningsPerStart
  };

  const result = applyModernKmNormalization(rawKmTime, factors, weights);
  
  // Mark as from raw data - this will be stored for post-race comparison
  (result as any).isEstimated = false;
  
  if (isXander) {
    EnhancedXanderDebugger.logNormalizationStep(
      extractedData.safeHorseName,
      'modern_km_normalization',
      rawKmTime,
      result.modernNormalizedTime,
      result.adjustments.total,
      'Full modern normalization from raw KM time'
    );
    
    // Log detailed adjustment breakdown
    EnhancedXanderDebugger.logProcessingPhase(
      extractedData.safeHorseName,
      'normalization_adjustments',
      {
        postPosition: result.adjustments.postPosition,
        equipment: result.adjustments.equipment,
        driver: result.adjustments.driver,
        track: result.adjustments.track,
        form: result.adjustments.form,
        distance: result.adjustments.distance,
        raceDistanceAdjustment: result.adjustments.raceDistanceAdjustment,
        raceType: result.adjustments.raceType,
        timeOfDay: result.adjustments.timeOfDay,
        startPoints: result.adjustments.startPoints,
        placePercentage: result.adjustments.placePercentage,
        horseWinPercentage: result.adjustments.horseWinPercentage,
        earningsPerStart: result.adjustments.earningsPerStart,
        total: result.adjustments.total
      }
    );
    
    EnhancedXanderDebugger.addCheckpoint(
      'modern_normalization_complete',
      'horse_normalization',
      extractedData.safeHorseName,
      {
        rawTime: `${rawKmTime.minutes}:${rawKmTime.seconds.toString().padStart(2, '0')}.${rawKmTime.tenths}`,
        normalizedTime: `${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths}`,
        totalAdjustment: result.adjustments.total,
        isEstimated: false,
        willBeCached: true
      },
      true
    );
  }
  
  console.log(`  - Final normalized time: ${result.modernNormalizedTime.minutes}:${result.modernNormalizedTime.seconds.toString().padStart(2, '0')}.${result.modernNormalizedTime.tenths} (FROM RAW DATA - WILL BE CACHED)`);
  
  return result;
};
