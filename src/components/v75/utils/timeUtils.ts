/**
 * Time conversion utilities for handling various time formats
 */

export type TimeParts = { minutes: number; seconds: number; tenths: number };

/**
 * Convert time parts (minutes:seconds.tenths) to total seconds
 */
export const partsToSeconds = (t?: TimeParts | null): number | undefined => {
  if (!t) return undefined;
  return (t.minutes ?? 0) * 60 + (t.seconds ?? 0) + (t.tenths ?? 0) / 10;
};

/**
 * Convert total seconds to time parts (minutes:seconds.tenths)
 */
export const secondsToParts = (sec?: number | null): TimeParts | null => {
  if (sec == null || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const t = Math.round((sec - Math.floor(sec)) * 10); // tenths
  return { minutes: m, seconds: s, tenths: t };
};

/**
 * Calculate per-km time from total race time and distance
 * Best-effort km time from a race total time when distance is known
 */
export const totalToKmSeconds = (totalSeconds?: number, distanceMeters?: number): number | undefined => {
  if (!totalSeconds || !distanceMeters || distanceMeters <= 0) return undefined;
  const km = distanceMeters / 1000;
  return totalSeconds / km;
};

/**
 * Convert time parts directly to per-km seconds based on distance
 */
export const partsToKmSeconds = (t?: TimeParts | null, distanceMeters?: number): number | undefined => {
  const totalSec = partsToSeconds(t);
  return totalToKmSeconds(totalSec, distanceMeters);
};
