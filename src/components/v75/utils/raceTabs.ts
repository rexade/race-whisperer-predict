import type { V75RaceResult } from '../types/raceResultTypes';

export interface RaceLeg {
  race: V75RaceResult;
  legNumber: number;
  tabValue: string;
}

export const raceTabValue = (race: Pick<V75RaceResult, 'raceId'>): string =>
  `race-${race.raceId}`;

export const buildRaceLegs = (races: V75RaceResult[]): RaceLeg[] =>
  races.map((race, index) => ({
    race,
    legNumber: index + 1,
    tabValue: raceTabValue(race),
  }));
