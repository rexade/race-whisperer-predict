
import { useState } from 'react';
import { NormalizationWeights, applyModernKmNormalization, ModernNormalizationFactors } from '../../../services/modernKm/index';
import { processHorseResults } from '../utils/horseResultProcessor';
import { extractTrackNameAsString } from '../utils/dataExtraction';

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
}

export interface V75RaceResult {
  raceNumber: number;
  raceId: string;
  track: string;
  distance: number;
  startMethod: string;
  name: string;
  prize: number;
  horses: V75HorseResult[];
  analysisComplete: boolean;
}

export const useV75ResultsProcessor = () => {
  const [v75Results, setV75Results] = useState<V75RaceResult[]>([]);

  const processRaceResult = (race: any, rawKmTimes: any[], weights: NormalizationWeights): V75RaceResult => {
    const safeRaceTrack = extractTrackNameAsString(race.track);
    const safeRaceName = extractTrackNameAsString(race.name);
    
    try {
      const horseResults = processHorseResults(race, rawKmTimes, weights);
      
      return {
        raceNumber: race.raceNumber,
        raceId: race.raceId,
        track: safeRaceTrack,
        distance: race.distance,
        startMethod: race.startMethod,
        name: safeRaceName,
        prize: race.prize,
        horses: horseResults,
        analysisComplete: true
      };
    } catch (error) {
      console.error(`❌ Error processing race ${race.raceNumber}:`, error);
      
      return {
        raceNumber: race.raceNumber,
        raceId: race.raceId,
        track: safeRaceTrack,
        distance: race.distance,
        startMethod: race.startMethod,
        name: safeRaceName,
        prize: race.prize,
        horses: [],
        analysisComplete: false
      };
    }
  };

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
