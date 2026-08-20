// @vitest-environment node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDriverEmpiricalRate, saveDriverRatings } from '../../src/services/calibration/driverRatingService';
import { loadDataset, primeDriverRatings } from '../cli-common';
import type { CalibrationDataset } from '../../src/services/calibration/historicalCalibrationService';

let datasetPath: string;

describe('CLI driver-rating boundaries', () => {
  beforeEach(() => {
    saveDriverRatings(new Map());
    datasetPath = path.join(os.tmpdir(), `race-whisperer-${process.pid}-${Date.now()}.json`);
  });

  afterEach(() => {
    if (fs.existsSync(datasetPath)) fs.unlinkSync(datasetPath);
  });

  it('can hydrate a holdout without deriving ratings from its outcomes', () => {
    fs.writeFileSync(datasetPath, JSON.stringify([{
      date: '2026-08-01',
      races: [{ raceData: { horses: [] }, actualResults: {} }],
    }]));

    loadDataset(datasetPath, { primeDriverRatings: false });

    expect(getDriverEmpiricalRate('Holdout', 'Driver')).toBeNull();
  });

  it('installs ratings from the explicitly supplied training partition only', () => {
    const training = [{
      date: '2026-07-01',
      races: [{
        raceId: 'race-1',
        raceNumber: 1,
        raceData: {
          horses: [{
            horseKey: 'train-horse', horseId: 1,
            driver: { firstName: 'Train', lastName: 'Driver' },
          }],
        },
        rawKmTimes: [],
        actualResults: new Map([['train-horse', { position: 1 }]]),
      }],
    }] as CalibrationDataset;

    primeDriverRatings(training);

    expect(getDriverEmpiricalRate('Train', 'Driver')).not.toBeNull();
    expect(getDriverEmpiricalRate('Holdout', 'Driver')).toBeNull();
  });
});
