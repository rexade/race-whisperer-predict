/**
 * Dataset splitting helpers for honest weight calibration.
 *
 * Chronological holdout + date-level k-fold. Splits operate on whole dates
 * (never individual races) because races within a date share drivers, track
 * conditions, and form data — splitting mid-date would leak information.
 */

import { CalibrationDataset } from './historicalCalibrationService';

export interface HoldoutSplit {
  /** Older dates — safe to optimize on. */
  train: CalibrationDataset;
  /** Most recent dates — reserved for the final honest evaluation only. */
  holdout: CalibrationDataset;
}

export interface FoldSplit {
  train: CalibrationDataset;
  test: CalibrationDataset;
}

/**
 * Reserve the most recent dates as a holdout set.
 *
 * @param fraction  Target holdout share of dates (e.g. 0.2)
 * @param minDates  Lower bound on holdout size (fraction of a small dataset
 *                  can round to too few dates to measure anything)
 */
export function chronologicalHoldout(
  dataset: CalibrationDataset,
  fraction: number,
  minDates: number
): HoldoutSplit {
  const sorted = [...dataset].sort((a, b) => a.date.localeCompare(b.date));
  let n = Math.max(Math.round(sorted.length * fraction), minDates);
  // Never let the holdout swallow the training data
  n = Math.min(n, sorted.length - 1);
  return {
    train: sorted.slice(0, sorted.length - n),
    holdout: sorted.slice(sorted.length - n),
  };
}

/**
 * Seeded-shuffle date-level k-fold. Every date lands in exactly one test fold;
 * each fold's train is the complement of its test.
 */
export function createDateFolds(
  dataset: CalibrationDataset,
  k: number,
  seed: number
): FoldSplit[] {
  const indices = dataset.map((_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const foldSize = Math.ceil(dataset.length / k);
  const folds: FoldSplit[] = [];
  for (let f = 0; f < k; f++) {
    const testIndices = new Set(indices.slice(f * foldSize, (f + 1) * foldSize));
    folds.push({
      train: dataset.filter((_, i) => !testIndices.has(i)),
      test: dataset.filter((_, i) => testIndices.has(i)),
    });
  }
  return folds;
}
