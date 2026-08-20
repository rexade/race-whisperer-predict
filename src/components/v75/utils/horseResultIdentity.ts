import { makeHorseKey } from '@/services/horseIdentity';
import type { V75HorseResult } from '../types/raceResultTypes';

type HorseResultIdentityInput = Pick<
  V75HorseResult,
  'horseKey' | 'raceId' | 'horseId' | 'startNumber' | 'postPosition'
>;

export const horseResultKey = (horse: HorseResultIdentityInput): string =>
  horse.horseKey ?? makeHorseKey(
    horse.raceId,
    horse.horseId,
    horse.startNumber ?? horse.postPosition
  );

const toDomIdSegment = (value: string): string =>
  Array.from(value, character => character.codePointAt(0)!.toString(16)).join('-');

export const horseResultDomId = (horse: HorseResultIdentityInput): string =>
  `breakdown-${toDomIdSegment(horseResultKey(horse))}`;
