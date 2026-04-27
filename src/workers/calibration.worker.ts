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

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'OPTIMIZE') {
    const { dataset, initialWeights, initialCurves, testDataset } = payload as {
      dataset: CalibrationDataset;
      initialWeights: NormalizationWeights;
      initialCurves?: PostPositionCurves;
      testDataset?: CalibrationDataset;
    };

    try {
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

  if (type === 'EVALUATE') {
    const { dataset, weights, curves } = payload as {
      dataset: CalibrationDataset;
      weights: NormalizationWeights;
      curves?: PostPositionCurves;
    };

    try {
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
