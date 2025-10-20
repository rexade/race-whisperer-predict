import { KmTime } from '../types/kmTimeTypes';

/**
 * Robust conversion to seconds with NaN and negative guards
 */
export function toSeconds(minutes = 0, seconds = 0, tenths = 0): number {
  const mm = Number.isFinite(minutes) ? minutes : 0;
  const ss = Number.isFinite(seconds) ? seconds : 0;
  const tt = Number.isFinite(tenths) ? tenths : 0;
  return Math.max(0, mm * 60 + ss + tt / 10);
}

/**
 * Convert KmTime to seconds with guards
 */
export function kmTimeToSeconds(time: KmTime): number {
  return toSeconds(time.minutes, time.seconds, time.tenths);
}

/**
 * Convert seconds to KmTime parts with overflow guards
 * Handles edge cases like 59.96 → 1:00.0 properly
 */
export function secondsToKmParts(totalSec: number): KmTime {
  if (!Number.isFinite(totalSec) || totalSec < 0) {
    return { minutes: 0, seconds: 0, tenths: 0 };
  }

  const minutes = Math.floor(totalSec / 60);
  let seconds = Math.floor(totalSec % 60);
  let tenths = Math.round((totalSec - Math.floor(totalSec)) * 10);

  // Handle rounding overflow
  if (tenths === 10) {
    tenths = 0;
    seconds += 1;
  }
  if (seconds === 60) {
    seconds = 0;
    return { minutes: minutes + 1, seconds, tenths };
  }

  return { minutes, seconds, tenths };
}

/**
 * Check if a time is an outlier (suspiciously fast or slow)
 * Returns { isOutlier: boolean, reason?: string }
 */
export function isOutlierTime(time: KmTime): { isOutlier: boolean; reason?: string } {
  const totalSec = kmTimeToSeconds(time);
  
  // Per-km time should be between 1:07.0 (67s) and 2:05.0 (125s)
  if (totalSec < 67) {
    return { isOutlier: true, reason: 'suspiciously_fast' };
  }
  if (totalSec > 125) {
    return { isOutlier: true, reason: 'suspiciously_slow' };
  }
  
  return { isOutlier: false };
}

/**
 * Compare two KmTimes for sorting (stable comparison)
 */
export function compareKmTimes(a: KmTime, b: KmTime): number {
  const aSec = kmTimeToSeconds(a);
  const bSec = kmTimeToSeconds(b);
  return aSec - bSec;
}

/**
 * Create a unique key for a race record (for deduplication)
 */
export function createRecordKey(record: { raceId?: string; race?: { id?: string }; normalizedTime: KmTime }): string {
  const raceId = record.raceId ?? record.race?.id ?? 'na';
  const timeSec = kmTimeToSeconds(record.normalizedTime);
  return `${raceId}|${timeSec.toFixed(1)}`;
}
