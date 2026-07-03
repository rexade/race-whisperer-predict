// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { chronologicalHoldout, createDateFolds } from '../datasetSplits';
import type { CalibrationDataset } from '../historicalCalibrationService';

/** Minimal DateCalibrationData stub — splits operate at the date level only. */
const makeDataset = (dates: string[]): CalibrationDataset =>
  dates.map(date => ({ date, races: [] as any[] }));

const dates20 = Array.from({ length: 20 }, (_, i) =>
  `2026-01-${String(i + 1).padStart(2, '0')}`
);

describe('chronologicalHoldout', () => {
  it('reserves the most recent fraction of dates as holdout', () => {
    const { train, holdout } = chronologicalHoldout(makeDataset(dates20), 0.2, 2);
    expect(holdout).toHaveLength(4);
    expect(train).toHaveLength(16);
    expect(holdout.map(d => d.date)).toEqual(dates20.slice(16));
  });

  it('every holdout date is strictly newer than every train date', () => {
    // Shuffled input — helper must sort, not trust input order
    const shuffled = [...dates20].reverse();
    const { train, holdout } = chronologicalHoldout(makeDataset(shuffled), 0.25, 2);
    const maxTrain = train.map(d => d.date).sort().at(-1)!;
    const minHoldout = holdout.map(d => d.date).sort()[0];
    expect(minHoldout > maxTrain).toBe(true);
  });

  it('respects minDates when fraction is too small', () => {
    const { holdout } = chronologicalHoldout(makeDataset(dates20), 0.05, 6);
    expect(holdout).toHaveLength(6);
  });

  it('never consumes the whole dataset as holdout', () => {
    const { train, holdout } = chronologicalHoldout(makeDataset(dates20.slice(0, 4)), 0.5, 10);
    expect(train.length).toBeGreaterThan(0);
    expect(train.length + holdout.length).toBe(4);
  });
});

describe('createDateFolds', () => {
  it('puts every date in exactly one test fold', () => {
    const ds = makeDataset(dates20);
    const folds = createDateFolds(ds, 4, 42);
    const testDates = folds.flatMap(f => f.test.map(d => d.date));
    expect(testDates.sort()).toEqual([...dates20].sort());
  });

  it('train and test are disjoint and cover the dataset in each fold', () => {
    const ds = makeDataset(dates20);
    for (const fold of createDateFolds(ds, 5, 42)) {
      const trainSet = new Set(fold.train.map(d => d.date));
      for (const t of fold.test) expect(trainSet.has(t.date)).toBe(false);
      expect(fold.train.length + fold.test.length).toBe(20);
    }
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const ds = makeDataset(dates20);
    const a = createDateFolds(ds, 4, 42).map(f => f.test.map(d => d.date));
    const b = createDateFolds(ds, 4, 42).map(f => f.test.map(d => d.date));
    const c = createDateFolds(ds, 4, 7).map(f => f.test.map(d => d.date));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
