/**
 * Shared helpers for CLI evaluation scripts.
 * Handles dataset loading, hydration, and driver rating bootstrap.
 */

import './node-polyfills';
import * as fs from 'fs';
import { CalibrationDataset } from '../src/services/calibration/historicalCalibrationService';
import { computeDriverRatings, saveDriverRatings } from '../src/services/calibration/driverRatingService';

/** Reconstruct Maps from plain objects (JSON→Map conversion) */
export function hydrateDataset(raw: any[]): CalibrationDataset {
  return raw.map(dateData => ({
    ...dateData,
    races: dateData.races.map((race: any) => ({
      ...race,
      actualResults: new Map(Object.entries(race.actualResults).map(
        ([k, v]) => [String(k), v]
      )),
    })),
  }));
}

export interface LoadDatasetOptions {
  /** Keep false for holdout/fold datasets; ratings must come from training data only. */
  primeDriverRatings?: boolean;
}

/** Install empirical ratings derived only from the supplied training partition. */
export function primeDriverRatings(dataset: CalibrationDataset): number {
  const driverRatings = computeDriverRatings(dataset);
  saveDriverRatings(driverRatings);
  console.log(`Driver empirical ratings: ${driverRatings.size} drivers`);
  return driverRatings.size;
}

/** Load and hydrate a dataset. Rating priming is opt-out for legacy full-dataset tools. */
export function loadDataset(
  path: string,
  options: LoadDatasetOptions = {}
): CalibrationDataset {
  console.log(`Loading ${path}…`);
  const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const dataset = hydrateDataset(raw);

  if (options.primeDriverRatings !== false) primeDriverRatings(dataset);

  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
  console.log(`Dataset: ${dataset.length} dates, ${totalRaces} races\n`);

  return dataset;
}
