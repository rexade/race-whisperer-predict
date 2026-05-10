/**
 * Distance bucket classification for race-distance-aware post-position curves.
 *
 * IMPORTANT: these thresholds MUST match whatever the bucketed-curve PRODUCER
 * uses when populating `postPositionCurves.byDistance.{auto,volte}.{short,medium,long}`.
 * If a different module owns the bucket boundaries (e.g. an optimizer pass on
 * another branch, or a data-source convention), import from there instead and
 * delete the constants below to avoid drift.
 *
 * Defaults follow Swedish trotting convention:
 *   short:  ≤ 1900 m   (Kort,  e.g. 1640 m sprint)
 *   medium: 1901-2400 m (most races, including the 2140 m reference)
 *   long:   > 2400 m    (Lång,  e.g. 2640 m+)
 */

export type DistanceBucket = 'short' | 'medium' | 'long';

export const DISTANCE_BUCKET_BOUNDS = {
  SHORT_MAX: 1900,
  MEDIUM_MAX: 2400,
} as const;

export function getDistanceBucket(raceDistance: number): DistanceBucket {
  if (!Number.isFinite(raceDistance) || raceDistance <= 0) return 'medium';
  if (raceDistance <= DISTANCE_BUCKET_BOUNDS.SHORT_MAX) return 'short';
  if (raceDistance <= DISTANCE_BUCKET_BOUNDS.MEDIUM_MAX) return 'medium';
  return 'long';
}
