
import { useState, useCallback } from 'react';
import { NormalizationWeights, applyModernKmNormalization, ModernNormalizationFactors } from '../../../services/modernKm/index';
import { processHorseResults } from '../utils/horseResultProcessor';
import { extractTrackNameAsString } from '../utils/dataExtraction';
import { V75CacheService } from '../../../services/v75CacheService';

export interface V75HorseResult {
  raceNumber: number;
  raceId: string;
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: any;
  modernNormalizedResult?: any;
  driverName: string;
  track: string;
  distance: number;
  startMethod: string;
  statistics?: {
    startPoints: number;
    placePercentage: number;
    winPercentage: number;
    earningsPerStart: number;
  };
  driver2025WinPercentage?: number;
  sulkyType?: string;
  shoesFront?: boolean;
  shoesBack?: boolean;
  homeTrack?: string;
  finalScore?: number;
  rank?: number;
}

export interface V75RaceResult {
  raceNumber: number;
  raceId: string;
  track: string;
  distance: number;
  startMethod: string;
  name: string;
  prize: number;
  date?: string;
  horses: V75HorseResult[];
  analysisComplete: boolean;
  dataQuality?: {
    hasValidPostPositions: boolean;
    duplicatePositions: number[];
    missingData: number[];
  };
}

export const useV75ResultsProcessor = () => {
  const [v75Results, setV75Results] = useState<V75RaceResult[]>([]);

  const processRaceResult = useCallback((
    race: any,
    rawKmTimes: Array<{ horseId: number; best3Average: any }>,
    weights: NormalizationWeights,
    analysisDate?: string
  ): V75RaceResult => {
    const safeRaceTrack = extractTrackNameAsString(race.track);
    const safeRaceName = extractTrackNameAsString(race.name);
    
    try {
      const horseResults = processHorseResults(race, rawKmTimes, weights);
      
      // Calculate final scores and ranks for horses
      const horsesWithScores = horseResults.map((horse, index) => ({
        ...horse,
        finalScore: horse.modernNormalizedResult ? 
          (horse.modernNormalizedResult.modernNormalizedTime.minutes * 60 + 
           horse.modernNormalizedResult.modernNormalizedTime.seconds + 
           horse.modernNormalizedResult.modernNormalizedTime.tenths / 10) : 999,
        rank: index + 1
      }));

      // Sort by final score and update ranks
      horsesWithScores.sort((a, b) => a.finalScore - b.finalScore);
      horsesWithScores.forEach((horse, index) => {
        horse.rank = index + 1;
      });

      // Store analysis results with the correct date (race date, not today's date)
      const analysisHorses = horsesWithScores.map(horse => ({
        horseId: horse.horseId,
        horseName: horse.horseName,
        postPosition: horse.postPosition,
        finalScore: horse.finalScore || 999,
        rank: horse.rank || 999
      }));

      // Use the race date for analysis storage instead of today's date
      const cacheDate = analysisDate || race.date || new Date().toISOString().split('T')[0];
      
      console.log(`💾 Storing race analysis for race ${race.raceNumber} with date: ${cacheDate}`);
      
      // Store the analysis asynchronously (don't block the UI)
      V75CacheService.storeRaceAnalysis(
        race.raceId,
        race.raceNumber,
        cacheDate,
        analysisHorses
      ).catch(error => {
        console.warn('Failed to store race analysis:', error);
      });

      return {
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        distance: race.distance,
        startMethod: race.startMethod,
        track: safeRaceTrack,
        name: safeRaceName,
        date: race.date,
        prize: race.prize,
        horses: horsesWithScores,
        analysisComplete: true,
        dataQuality: race.dataQuality || {
          hasValidPostPositions: true,
          duplicatePositions: [],
          missingData: []
        }
      };
    } catch (error) {
      console.error(`❌ Error processing race ${race.raceNumber}:`, error);
      
      return {
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        distance: race.distance,
        startMethod: race.startMethod,
        track: safeRaceTrack,
        name: safeRaceName,
        date: race.date,
        prize: race.prize,
        horses: [],
        analysisComplete: false,
        dataQuality: {
          hasValidPostPositions: true,
          duplicatePositions: [],
          missingData: []
        }
      };
    }
  }, []);

  const reanalyzeWithNewWeights = (weights: NormalizationWeights) => {
    if (v75Results.length === 0) return;
    
    console.log('🔄 Re-applying modern normalization with updated weights to fresh data...');
    
    const updatedResults = v75Results.map(race => {
      if (!race.analysisComplete || race.horses.length === 0) return race;
      
      const updatedHorses = race.horses.map(horse => {
        if (!horse.rawKmTime) return horse;
        
        if (typeof horse.horseName !== 'string') {
          console.error('🚨 CRITICAL ERROR during reanalysis - Horse name is not a string!', horse.horseName);
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
          driverExperience: 0,
          driverWinPercentage: 0,
          driverWinPercentage2025: horse.driver2025WinPercentage || 0,
          horseForm: horse.statistics?.winPercentage || 0,
          raceType: 'trot',
          timeOfDay: '',
          startPoints: horse.statistics?.startPoints || 500,
          placePercentage: horse.statistics?.placePercentage || 5000,
          horseWinPercentage: horse.statistics?.winPercentage || 1500,
          earningsPerStart: horse.statistics?.earningsPerStart || 300000
        };
        
        const modernNormalizedResult = applyModernKmNormalization(horse.rawKmTime, factors, weights);
        
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
    
    setV75Results(updatedResults);
  };

  return {
    v75Results,
    setV75Results,
    processRaceResult,
    reanalyzeWithNewWeights
  };
};
