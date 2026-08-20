import type { HorseRawKmTime, KmTime, ProcessedKmTime } from '../types/kmTimeTypes';
import type { CachedRawTime } from './types';

export type RawTimeCacheInput = Pick<CachedRawTime, 'horseKey' | 'horseId' | 'horseName' | 'postPosition'> &
  Partial<Omit<HorseRawKmTime, 'horseKey' | 'horseId' | 'horseName'>> & {
    rawKmTime?: KmTime;
  };

export const toCachedRawTime = (
  rawTime: RawTimeCacheInput,
  updatedAt: string
): CachedRawTime => ({
  horseKey: rawTime.horseKey,
  horseId: rawTime.horseId,
  horseName: rawTime.horseName,
  postPosition: rawTime.postPosition,
  allTimes: rawTime.allTimes,
  rawKmTime: rawTime.rawKmTime ?? rawTime.rawBestTime ?? rawTime.bestTime,
  bestTime: rawTime.bestTime,
  rawBestTime: rawTime.rawBestTime,
  bestRecordTime: rawTime.bestRecordTime,
  validTimesCount: rawTime.validTimesCount ?? 0,
  updatedAt,
  isNotifiee: rawTime.isNotifiee,
  dataSource: rawTime.dataSource,
  oldestRecordDate: rawTime.oldestRecordDate,
  newestRecordDate: rawTime.newestRecordDate,
  gallopRate: rawTime.gallopRate,
  gallopCount: rawTime.gallopCount,
  gallopDates: rawTime.gallopDates,
  disqualificationCount: rawTime.disqualificationCount,
  lastRaceDate: rawTime.lastRaceDate,
  consistencyScore: rawTime.consistencyScore,
  averageOdds: rawTime.averageOdds,
  lastOdds: rawTime.lastOdds,
  horseAge: rawTime.horseAge,
  dataSourceChain: rawTime.dataSourceChain,
  usedStatisticsFallback: rawTime.usedStatisticsFallback,
  usedExtendedFallback: rawTime.usedExtendedFallback,
  usedInvalidTimeFallback: rawTime.usedInvalidTimeFallback,
  confidenceMultiplier: rawTime.confidenceMultiplier,
  warning: rawTime.warning,
});

const zeroTime = (): KmTime => ({ minutes: 0, seconds: 0, tenths: 0 });

export const fromCachedRawTime = (cached: CachedRawTime): HorseRawKmTime => ({
  horseKey: cached.horseKey,
  horseId: cached.horseId,
  horseName: cached.horseName || `Horse ${cached.horseId}`,
  allTimes: (cached.allTimes as ProcessedKmTime[] | undefined) ?? [],
  bestTime: cached.bestTime ?? cached.rawBestTime ?? cached.rawKmTime ?? zeroTime(),
  rawBestTime: cached.rawBestTime ?? cached.rawKmTime,
  bestRecordTime: cached.bestRecordTime ?? cached.rawKmTime ?? zeroTime(),
  validTimesCount: cached.validTimesCount ?? 0,
  isNotifiee: cached.isNotifiee,
  dataSource: cached.dataSource,
  oldestRecordDate: cached.oldestRecordDate,
  newestRecordDate: cached.newestRecordDate,
  gallopRate: cached.gallopRate,
  gallopCount: cached.gallopCount ?? cached.gallopDates?.length,
  gallopDates: cached.gallopDates,
  disqualificationCount: cached.disqualificationCount,
  lastRaceDate: cached.lastRaceDate,
  consistencyScore: cached.consistencyScore,
  averageOdds: cached.averageOdds,
  lastOdds: cached.lastOdds,
  horseAge: cached.horseAge,
  dataSourceChain: cached.dataSourceChain,
  usedStatisticsFallback: cached.usedStatisticsFallback,
  usedExtendedFallback: cached.usedExtendedFallback,
  usedInvalidTimeFallback: cached.usedInvalidTimeFallback,
  confidenceMultiplier: cached.confidenceMultiplier,
  warning: cached.warning,
});
