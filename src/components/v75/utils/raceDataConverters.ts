
import { V75RaceData } from '../../../services/v75CalendarApi';
import { EnhancedRaceData, EnhancedHorseData } from '../../../services/enhancedAtgApi';
import { extractHorseNameAsString, extractTrackNameAsString } from './dataExtraction';
import { log } from '@/lib/logger';
import { makeHorseKey } from '@/services/horseIdentity';

// Convert V75RaceData to EnhancedRaceData format for validation
export const convertV75ToEnhancedRaceData = (v75Race: V75RaceData): EnhancedRaceData => {
  log.debug(`🔄 Converting V75 race ${v75Race.raceNumber} to EnhancedRaceData format for validation`);
  log.debug(`  Race has ${v75Race.horses.length} horses with positions: ${v75Race.horses.map(h => h.postPosition).sort((a, b) => a - b).join(', ')}`);

  const enhancedHorses: EnhancedHorseData[] = v75Race.horses.map(horse => ({
    horseKey: horse.horseKey,
    horseId: horse.horseId,
    name: extractHorseNameAsString(horse.name),
    postPosition: horse.postPosition,
    distance: horse.distance,
    startMethod: v75Race.startMethod,
    driver: {
      firstName: horse.driver.firstName,
      lastName: horse.driver.lastName,
      experience: horse.driver.experience,
      winPercentage: horse.driver.winPercentage,
      winPercentage2025: horse.driver.winPercentage2025
    },
    trainer: horse.trainer ? {
      firstName: horse.trainer.firstName,
      lastName: horse.trainer.lastName,
      winPercentage: horse.trainer.winPercentage,
      winPercentage2025: horse.trainer.winPercentage2025
    } : undefined,
    statistics: {
      startPoints: horse.statistics.startPoints,
      placePercentage: horse.statistics.placePercentage,
      winPercentage: horse.statistics.winPercentage,
      earningsPerStart: horse.statistics.earningsPerStart
    },
    shoes: {
      front: horse.shoes.front,
      back: horse.shoes.back
    },
    sulky: {
      type: horse.sulky.type
    },
    homeTrack: horse.homeTrack
  }));

  return {
    raceId: v75Race.raceId,
    raceNumber: v75Race.raceNumber,
    distance: v75Race.distance,
    startMethod: v75Race.startMethod,
    track: extractTrackNameAsString(v75Race.track),
    name: v75Race.name,
    date: v75Race.date,
    prize: v75Race.prize,
    horses: enhancedHorses,
    dataQuality: {
      hasValidPostPositions: true,
      duplicatePositions: [],
      missingData: []
    }
  };
};

// Convert EnhancedRaceData back to V75RaceData format after validation
export const convertEnhancedToV75RaceData = (enhancedRace: EnhancedRaceData): V75RaceData => {
  log.debug(`🔄 Converting enhanced race ${enhancedRace.raceNumber} back to V75RaceData format`);
  log.debug(`  Fixed race has ${enhancedRace.horses.length} horses with positions: ${enhancedRace.horses.map(h => h.postPosition).sort((a, b) => a - b).join(', ')}`);

  return {
    raceId: enhancedRace.raceId,
    raceNumber: enhancedRace.raceNumber,
    distance: enhancedRace.distance,
    startMethod: enhancedRace.startMethod,
    track: enhancedRace.track,
    name: enhancedRace.name,
    date: enhancedRace.date,
    prize: enhancedRace.prize,
    horses: enhancedRace.horses.map(horse => ({
      horseKey: (horse as any).horseKey ?? makeHorseKey(enhancedRace.raceId, horse.horseId, horse.postPosition),
      horseId: horse.horseId,
      name: horse.name,
      postPosition: horse.postPosition,
      distance: horse.distance,
      driver: {
        firstName: horse.driver.firstName,
        lastName: horse.driver.lastName,
        experience: horse.driver.experience,
        winPercentage: horse.driver.winPercentage,
        winPercentage2025: horse.driver.winPercentage2025
      },
      trainer: horse.trainer ? {
        firstName: horse.trainer.firstName,
        lastName: horse.trainer.lastName,
        winPercentage: horse.trainer.winPercentage,
        winPercentage2025: horse.trainer.winPercentage2025
      } : undefined,
      statistics: {
        startPoints: horse.statistics.startPoints,
        placePercentage: horse.statistics.placePercentage,
        winPercentage: horse.statistics.winPercentage,
        earningsPerStart: horse.statistics.earningsPerStart
      },
      shoes: {
        front: horse.shoes.front,
        back: horse.shoes.back
      },
      sulky: {
        type: horse.sulky.type
      },
      homeTrack: horse.homeTrack
    }))
  };
};
