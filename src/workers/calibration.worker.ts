/**
 * Calibration Web Worker
 *
 * Runs the weight optimization entirely off the main thread so the UI
 * stays responsive.  The CalibrationDataset is passed via postMessage —
 * Map objects are supported by the structured-clone algorithm so no manual
 * serialization is needed.
 */

import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { CalibrationDataset, evaluateWeights } from '@/services/calibration/historicalCalibrationService';
import { optimizeWeights, OptimizationProgress, OptimizationResult } from '@/services/calibration/weightOptimizer';
import { computeDriverRatings, saveDriverRatings } from '@/services/calibration/driverRatingService';
import type { GameType } from '@/config/game';
import {
  runKFoldCalibration,
  type KFoldStart,
  type KFoldOptions,
} from '@/services/calibration/kfoldCalibration';

/**
 * Ratings are derived from the dataset in hand and kept in this worker's module cache.
 * The gameType is passed through rather than defaulting, so a V86 calibration never
 * labels its ratings as the ambient game type.
 */
function primeDriverEmpiricalRatings(dataset: CalibrationDataset, gameType?: GameType): void {
  saveDriverRatings(computeDriverRatings(dataset), gameType);
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'OPTIMIZE') {
    const { dataset, initialWeights, initialCurves, testDataset, gameType } = payload as {
      dataset: CalibrationDataset;
      initialWeights: NormalizationWeights;
      initialCurves?: PostPositionCurves;
      testDataset?: CalibrationDataset;
      gameType?: GameType;
    };

    try {
      primeDriverEmpiricalRatings(dataset, gameType);
      const result: OptimizationResult = await optimizeWeights(
        dataset,
        initialWeights,
        (p: OptimizationProgress) => {
          (self as any).postMessage({ type: 'PROGRESS', payload: p });
        },
        initialCurves,
        testDataset
      );

      (self as any).postMessage({ type: 'DONE', payload: result });
    } catch (error) {
      (self as any).postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Optimization failed',
      });
    }
  }

  if (type === 'KFOLD') {
    const { trainWindow, holdout, starts, baselines, options } = payload as {
      trainWindow: CalibrationDataset;
      holdout: CalibrationDataset;
      starts: KFoldStart[];
      baselines?: KFoldStart[];
      options?: KFoldOptions;
    };

    try {
      // Ratings are primed per fold inside the protocol, so nothing is primed here —
      // doing so would derive them from data the folds are about to be scored on.
      const result = await runKFoldCalibration(
        trainWindow,
        holdout,
        starts,
        baselines ?? [],
        options ?? {},
        p => (self as any).postMessage({ type: 'PROGRESS', payload: p })
      );
      (self as any).postMessage({ type: 'KFOLD_DONE', payload: result });
    } catch (error) {
      (self as any).postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'K-fold calibration failed',
      });
    }
  }

  if (type === 'EVALUATE') {
    const { dataset, weights, curves, gameType, ratingsDataset } = payload as {
      dataset: CalibrationDataset;
      weights: NormalizationWeights;
      curves?: PostPositionCurves;
      gameType?: GameType;
      /** Dates to derive driver ratings from. Supplied when evaluating a holdout, so
       *  ratings still come from training data and the holdout stays out-of-sample. */
      ratingsDataset?: CalibrationDataset;
    };

    try {
      primeDriverEmpiricalRatings(ratingsDataset ?? dataset, gameType);
      const result = await evaluateWeights(dataset, weights, curves);
      (self as any).postMessage({ type: 'EVAL_DONE', payload: result });
    } catch (error) {
      (self as any).postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Evaluation failed',
      });
    }
  }
};
