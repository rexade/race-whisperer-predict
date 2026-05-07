/**
 * Shared helpers for CLI evaluation scripts.
 * Handles dataset loading, hydration, and driver rating bootstrap.
 */

import './node-polyfills';
import * as fs from 'fs';
import { CalibrationDataset } from '../src/services/calibration/historicalCalibrationService';
import { computeDriverRatings, saveDriverRatings, invalidateDriverRatingCache } from '../src/services/calibration/driverRatingService';

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

/** Load dataset, hydrate, and bootstrap driver empirical ratings into localStorage */
export function loadDataset(path: string): CalibrationDataset {
  console.log(`Loading ${path}…`);
  const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const dataset = hydrateDataset(raw);

  // Bootstrap driver empirical ratings so driverEmpirical weight works
  const driverRatings = computeDriverRatings(dataset);
  saveDriverRatings(driverRatings);
  invalidateDriverRatingCache();
  console.log(`Driver empirical ratings: ${driverRatings.size} drivers`);

  const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
  console.log(`Dataset: ${dataset.length} dates, ${totalRaces} races\n`);

  return dataset;
}
