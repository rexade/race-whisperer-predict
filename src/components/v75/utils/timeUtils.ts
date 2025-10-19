/**
 * Time conversion utilities for handling various time formats
 */

export type TimeParts = { minutes: number; seconds: number; tenths: number };

/**
 * Check if time parts represent zero/invalid time
 */
export const isZeroParts = (t?: TimeParts | null): boolean =>
  !t || (t.minutes === 0 && t.seconds === 0 && t.tenths === 0);

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

/**
 * Choose best display time from available sources
 * Priority: normalized → best record → raw km → none
 */
export const pickDisplayTime = ({
  normalized,
  bestRecordTime,
  rawKmTime,
  distanceMeters,
}: {
  normalized?: TimeParts | null;
  bestRecordTime?: TimeParts | null;
  rawKmTime?: TimeParts | null;
  distanceMeters?: number;
}): { parts: TimeParts | null; source: "normalized" | "best_raw" | "raw" | "none" } => {
  // First priority: normalized time
  if (!isZeroParts(normalized)) {
    return { parts: normalized!, source: "normalized" };
  }

  // Second priority: best record converted to km
  const bestTotalSec = partsToSeconds(bestRecordTime);
  const kmSecFromBest = totalToKmSeconds(bestTotalSec, distanceMeters);
  if (kmSecFromBest && kmSecFromBest > 0) {
    return { parts: secondsToParts(kmSecFromBest)!, source: "best_raw" };
  }

  // Third priority: raw km time
  if (!isZeroParts(rawKmTime)) {
    return { parts: rawKmTime!, source: "raw" };
  }

  // No valid time available
  return { parts: null, source: "none" };
};
