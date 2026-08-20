// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { V75RaceResult } from '../../types/raceResultTypes';
import { buildRaceLegs } from '../raceTabs';

const race = (raceId: string, raceNumber: number): V75RaceResult => ({
  raceId,
  raceNumber,
  track: 'T',
  distance: 2140,
  startMethod: 'auto',
  name: 'Race',
  prize: 0,
  horses: [],
  analysisComplete: true,
});

describe('buildRaceLegs', () => {
  it('uses raceId for identity and array order for leg labels', () => {
    const legs = buildRaceLegs([
      race('track-a-7', 7),
      race('track-b-7', 7),
      race('track-c-3', 3),
    ]);

    expect(legs.map(leg => leg.tabValue)).toEqual([
      'race-track-a-7',
      'race-track-b-7',
      'race-track-c-3',
    ]);
    expect(legs.map(leg => leg.legNumber)).toEqual([1, 2, 3]);
  });
});
