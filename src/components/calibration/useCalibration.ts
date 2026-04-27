import { useState, useCallback, useRef } from 'react';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import {
  fetchHistoricalDates,
  collectCalibrationData,
  evaluateWeights,
  CalibrationDataset,
  CalibrationEvaluation,
  CollectionProgress,
} from '@/services/calibration/historicalCalibrationService';
import { getCalibrationCacheInfo } from '@/services/calibration/calibrationDatasetCache';
import { OptimizationResult } from '@/services/calibration/weightOptimizer';
import { computeDriverRatings, saveDriverRatings, invalidateDriverRatingCache, getDriverRatingCount } from '@/services/calibration/driverRatingService';

export type CalibrationPhase =
  | 'idle'
  | 'fetching-dates'
  | 'collecting'
  | 'evaluating'
  | 'optimizing'
  | 'done'
  | 'error';

export interface CalibrationState {
  phase: CalibrationPhase;
  progressMessage: string;
  progressFraction: number;
  datesFound: number;
  dataset: CalibrationDataset | null;
  /** Held-out test set — last 1 month, never seen by the optimizer. */
  testDataset: CalibrationDataset | null;
  baselineEval: CalibrationEvaluation | null;
  optimizationResult: OptimizationResult | null;
  /** Per-run summary table from multi-start — each line is one run's win/MRR result. */
  runSummary: string | null;
  error: string | null;
}

const INITIAL_STATE: CalibrationState = {
  phase: 'idle',
  progressMessage: '',
  progressFraction: 0,
  datesFound: 0,
  dataset: null,
  testDataset: null,
  baselineEval: null,
  optimizationResult: null,
  runSummary: null,
  error: null,
};

function runInWorker<T>(
  workerFactory: () => Worker,
  message: unknown,
  doneType: string,
  onProgress?: (p: any) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = workerFactory();

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload, error } = event.data;
      if (type === 'PROGRESS') {
        onProgress?.(payload);
      } else if (type === doneType) {
        worker.terminate();
        resolve(payload as T);
      } else if (type === 'ERROR') {
        worker.terminate();
        reject(new Error(error));
      }
    };

    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Worker error'));
    };

    worker.postMessage(message);
  });
}

export function useCalibration() {
  const [state, setState] = useState<CalibrationState>(INITIAL_STATE);
  const datasetRef = useRef<CalibrationDataset | null>(null);
  const testDatasetRef = useRef<CalibrationDataset | null>(null);

  const updateState = (patch: Partial<CalibrationState>) =>
    setState(prev => ({ ...prev, ...patch }));

  /**
   * Step 1: Collect historical data. Loads from localStorage cache if available.
   * The baseline evaluation runs in the calibration worker to keep UI responsive.
   */
  const runDataCollection = useCallback(async (
    monthsBack: number,
    currentWeights: NormalizationWeights,
    forceRefresh = false,
    currentCurves?: PostPositionCurves
  ) => {
    updateState({ ...INITIAL_STATE, phase: 'fetching-dates', progressMessage: 'Checking cache…', progressFraction: 0 });
    datasetRef.current = null;

    try {
      const cacheInfo = getCalibrationCacheInfo(monthsBack);
      let allDates: string[] = [];

      if (!forceRefresh && cacheInfo.exists && cacheInfo.dateCount > 0) {
        updateState({ phase: 'collecting', progressMessage: `Found saved dataset (${cacheInfo.dateCount} dates). Loading…` });
      } else {
        updateState({ phase: 'fetching-dates', progressMessage: 'Scanning calendar for past games…' });
        allDates = await fetchHistoricalDates(monthsBack);
        if (allDates.length === 0) {
          updateState({ phase: 'error', error: 'No historical game dates found for the selected period.' });
          return;
        }
        updateState({ datesFound: allDates.length, phase: 'collecting', progressMessage: `Found ${allDates.length} game dates. Collecting data…` });
      }

      // Split into train (older than 1 month) and test (last 1 month).
      // The optimizer NEVER sees test dates — they are the honest evaluation set.
      const testCutoff = new Date();
      testCutoff.setMonth(testCutoff.getMonth() - 1);
      const testCutoffStr = testCutoff.toISOString().split('T')[0];

      const testDates  = allDates.filter(d => d >= testCutoffStr);
      const trainDates = allDates.filter(d => d <  testCutoffStr);

      // Collect training dataset (cached by monthsBack)
      const dataset = await collectCalibrationData(
        trainDates,
        (p: CollectionProgress) => {
          updateState({
            progressMessage: `[Train] ${p.message}`,
            progressFraction: p.datesTotal > 0 ? p.datesCompleted / p.datesTotal * 0.8 : 0,
          });
        },
        monthsBack,
        forceRefresh
      );

      if (dataset.length === 0) {
        updateState({ phase: 'error', error: 'Could not collect training data for any historical date.' });
        return;
      }

      // Collect test dataset — no cache key, never touches the optimizer
      updateState({ progressMessage: `Collecting test set (${testDates.length} dates, last 1 month)…`, progressFraction: 0.8 });
      const testDataset = await collectCalibrationData(
        testDates,
        (p: CollectionProgress) => {
          updateState({
            progressMessage: `[Test] ${p.message}`,
            progressFraction: 0.8 + (p.datesTotal > 0 ? p.datesCompleted / p.datesTotal * 0.2 : 0),
          });
        }
        // no monthsBack → not saved to calibration dataset cache
      );

      datasetRef.current = dataset;
      testDatasetRef.current = testDataset.length > 0 ? testDataset : null;

      // Baseline evaluation on training set — run in worker to avoid blocking UI
      updateState({ phase: 'evaluating', progressMessage: 'Computing baseline accuracy…', progressFraction: 1 });

      const baselineEval = await runInWorker<CalibrationEvaluation>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'EVALUATE', payload: { dataset, weights: currentWeights, curves: currentCurves } },
        'EVAL_DONE'
      );

      // Compute per-driver empirical ratings from the dataset and cache them.
      // This runs synchronously (pure JS map operations) so no await needed.
      const driverRatings = computeDriverRatings(dataset);
      saveDriverRatings(driverRatings);
      invalidateDriverRatingCache();
      const driverCount = getDriverRatingCount();

      const trainRaces = dataset.reduce((s, d) => s + d.races.length, 0);
      const testRaces  = testDataset.reduce((s, d) => s + d.races.length, 0);

      updateState({
        phase: 'done',
        dataset,
        testDataset: testDataset.length > 0 ? testDataset : null,
        baselineEval,
        progressMessage: `Train: ${dataset.length} dates/${trainRaces} races · Test: ${testDataset.length} dates/${testRaces} races · ${driverCount} driver ratings · Baseline Win: ${(baselineEval.winAccuracy * 100).toFixed(1)}%`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  /**
   * Step 2: Optimize weights (and curves) in a Web Worker — UI stays fully responsive.
   */
  const runOptimization = useCallback(async (
    currentWeights: NormalizationWeights,
    currentCurves?: PostPositionCurves
  ) => {
    const dataset = datasetRef.current ?? state.dataset;
    if (!dataset) return;
    const testDataset = testDatasetRef.current ?? state.testDataset ?? undefined;

    updateState({ phase: 'optimizing', progressMessage: 'Starting optimization…', optimizationResult: null });

    try {
      const result = await runInWorker<OptimizationResult>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'OPTIMIZE', payload: { dataset, initialWeights: currentWeights, initialCurves: currentCurves, testDataset } },
        'DONE',
        (p) => updateState({
          progressMessage: p.message,
          progressFraction: p.maxPasses > 0 ? p.pass / p.maxPasses : 0,
        })
      );

      const testStr = result.testEvaluation
        ? `  TEST Win: ${(result.testEvaluation.winAccuracy * 100).toFixed(1)}% ← truth`
        : '';
      updateState({
        phase: 'done',
        optimizationResult: result,
        progressMessage: `Train Win: ${(result.finalEvaluation.winAccuracy * 100).toFixed(1)}%${testStr}`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, [state.dataset]);

  /**
   * Multi-start optimization: runs the optimizer from several diverse starting
   * configurations and returns the single best result by win accuracy.
   * Each run is independent — different starting points explore different local optima.
   */
  const runMultiStartOptimization = useCallback(async (
    currentWeights: NormalizationWeights,
    currentCurves?: PostPositionCurves
  ) => {
    const dataset = datasetRef.current ?? state.dataset;
    if (!dataset) return;
    const testDataset = testDatasetRef.current ?? state.testDataset ?? undefined;

    // V21-based starting configurations
    const starts: Array<{ label: string; weights: NormalizationWeights }> = [
      // V21: current best (41.3%, trainer confirmed, driver/layoff dominate)
      { label: 'V21', weights: {
        postPosition: 1.597, shoeType: 2.608, sulkyType: 0.483,
        driverPerformance: 5.125, driverForm: 0.258, driverEmpirical: 3.438,
        trackFamiliarity: 0.721, form: 1.892, distanceAdjustment: 1.581,
        raceDistanceAdjustment: 2.447, volteStartDistancePenalty: 1.901,
        startPoints: 4.098, placePercentage: 0.200, horseWinPercentage: 1.047,
        earningsPerStart: 1.848, gallopRisk: 0.000, layoffPenalty: 6.609,
        ageFactor: 2.515, genderAdjustment: 1.111, consistencyFactor: 1.998,
        trainerPerformance: 3.000,
      }},
      // V21+Gallop: gallopRisk still zero — test if it contributes on clean data
      { label: 'V21+Gallop', weights: {
        postPosition: 1.597, shoeType: 2.608, sulkyType: 0.483,
        driverPerformance: 5.125, driverForm: 0.258, driverEmpirical: 3.438,
        trackFamiliarity: 0.721, form: 1.892, distanceAdjustment: 1.581,
        raceDistanceAdjustment: 2.447, volteStartDistancePenalty: 1.901,
        startPoints: 4.098, placePercentage: 0.200, horseWinPercentage: 1.047,
        earningsPerStart: 1.848, gallopRisk: 2.000, layoffPenalty: 6.609,
        ageFactor: 2.515, genderAdjustment: 1.111, consistencyFactor: 1.998,
        trainerPerformance: 3.000,
      }},
      // V21+Form: form is still low (1.892) — push and let SA explore
      { label: 'V21+Form', weights: {
        postPosition: 1.597, shoeType: 2.608, sulkyType: 0.483,
        driverPerformance: 5.125, driverForm: 0.258, driverEmpirical: 3.438,
        trackFamiliarity: 0.721, form: 3.500, distanceAdjustment: 1.581,
        raceDistanceAdjustment: 2.447, volteStartDistancePenalty: 1.901,
        startPoints: 4.098, placePercentage: 0.200, horseWinPercentage: 1.047,
        earningsPerStart: 1.848, gallopRisk: 0.000, layoffPenalty: 6.609,
        ageFactor: 2.515, genderAdjustment: 1.111, consistencyFactor: 1.998,
        trainerPerformance: 3.000,
      }},
      // V21+LessDriver: driverPerformance 5.125 is extreme — test if it's overfit
      { label: 'V21+LessDriver', weights: {
        postPosition: 1.597, shoeType: 2.608, sulkyType: 0.483,
        driverPerformance: 2.500, driverForm: 1.000, driverEmpirical: 2.000,
        trackFamiliarity: 0.721, form: 2.500, distanceAdjustment: 1.581,
        raceDistanceAdjustment: 2.447, volteStartDistancePenalty: 1.901,
        startPoints: 4.098, placePercentage: 0.200, horseWinPercentage: 1.047,
        earningsPerStart: 1.848, gallopRisk: 0.000, layoffPenalty: 6.609,
        ageFactor: 2.515, genderAdjustment: 1.111, consistencyFactor: 1.998,
        trainerPerformance: 3.000,
      }},
      // V21+LessLayoff: layoffPenalty 6.609 is extreme — test if it's overfit
      { label: 'V21+LessLayoff', weights: {
        postPosition: 1.597, shoeType: 2.608, sulkyType: 0.483,
        driverPerformance: 5.125, driverForm: 0.258, driverEmpirical: 3.438,
        trackFamiliarity: 0.721, form: 1.892, distanceAdjustment: 1.581,
        raceDistanceAdjustment: 2.447, volteStartDistancePenalty: 1.901,
        startPoints: 4.098, placePercentage: 0.200, horseWinPercentage: 1.047,
        earningsPerStart: 1.848, gallopRisk: 0.000, layoffPenalty: 2.500,
        ageFactor: 2.515, genderAdjustment: 1.111, consistencyFactor: 1.998,
        trainerPerformance: 3.000,
      }},
      { label: 'Current', weights: currentWeights },
    ];

    updateState({ phase: 'optimizing', progressMessage: `Multi-start: 0/${starts.length} runs…`, optimizationResult: null });

    let bestResult: OptimizationResult | null = null;
    let bestWin = -Infinity;
    // Per-run summary for copy-paste — tracks each run's final win% and MRR
    const runSummary: string[] = [];

    for (let i = 0; i < starts.length; i++) {
      const { label, weights } = starts[i];
      const runLabel = `Run ${i + 1}/${starts.length} from ${label}`;
      const bestStr = bestResult ? ` · best so far: ${(bestWin * 100).toFixed(1)}%` : '';
      updateState({
        progressMessage: `${runLabel}${bestStr}`,
        progressFraction: i / starts.length,
      });

      try {
        const result = await runInWorker<OptimizationResult>(
          () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
          { type: 'OPTIMIZE', payload: { dataset, initialWeights: weights, initialCurves: currentCurves, testDataset } },
          'DONE',
          (p) => {
            const best = bestResult ? ` · best: ${(bestWin * 100).toFixed(1)}%` : '';
            updateState({
              progressMessage: `${runLabel}${best} · ${p.message}`,
              progressFraction: (i + (p.maxPasses > 0 ? p.pass / p.maxPasses : 0)) / starts.length,
            });
          }
        );

        const winRate = result.finalEvaluation.winAccuracy;
        const mrr = result.finalMAE;
        // Pick best by TRAIN win% only — never by test (that would contaminate the blind set)
        const isBest = winRate > bestWin;
        const testStr = result.testEvaluation
          ? `  TEST=${( result.testEvaluation.winAccuracy * 100).toFixed(1)}%`
          : '';
        runSummary.push(
          `${isBest ? '★' : ' '} ${label.padEnd(14)} Train=${(winRate * 100).toFixed(1)}%  MRR=${mrr.toFixed(3)}${testStr}`
        );
        if (isBest) {
          bestWin = winRate;
          bestResult = result;
          // Re-mark previous best entries
          for (let j = 0; j < runSummary.length - 1; j++) {
            runSummary[j] = runSummary[j].replace(/^★/, ' ');
          }
          runSummary[runSummary.length - 1] = `★ ${label.padEnd(14)} Train=${(winRate * 100).toFixed(1)}%  MRR=${mrr.toFixed(3)}${testStr}`;
        }
      } catch (err) {
        runSummary.push(`  ${label.padEnd(14)} FAILED`);
        console.warn(`Multi-start run ${i + 1} (${label}) failed:`, err);
      }
    }

    if (!bestResult) {
      updateState({ phase: 'error', error: 'All multi-start runs failed.' });
      return;
    }

    const testWin = bestResult.testEvaluation?.winAccuracy;
    const testLine = testWin !== undefined
      ? `\n\nTEST (truth): ${(testWin * 100).toFixed(1)}%  MRR: ${(bestResult.testEvaluation!.winnerMRR).toFixed(3)}  Top-3: ${(bestResult.testEvaluation!.topPickAccuracy * 100).toFixed(1)}%`
      : '';
    const runTable = runSummary.join('\n') + testLine;

    updateState({
      phase: 'done',
      optimizationResult: bestResult,
      runSummary: runTable,
      progressMessage: testWin !== undefined
        ? `Multi-start done · Train: ${(bestWin * 100).toFixed(1)}% · TEST (truth): ${(testWin * 100).toFixed(1)}%`
        : `Multi-start done · Train Win: ${(bestWin * 100).toFixed(1)}%`,
      progressFraction: 1,
    });
  }, [state.dataset, state.testDataset]);

  /**
   * Promote the last optimization result to the new baseline.
   * Keeps the dataset loaded so the user can immediately optimize again.
   * Call this after applying optimized weights so each round improves on the last.
   */
  const acceptResult = useCallback(() => {
    setState(prev => {
      if (!prev.optimizationResult) return prev;
      const newBaseline = prev.optimizationResult.finalEvaluation;
      return {
        ...prev,
        baselineEval: newBaseline,
        optimizationResult: null,
        phase: 'done',
        progressMessage: `New baseline · Rank MAE: ${newBaseline.rankMAE.toFixed(3)} · Win: ${(newBaseline.winAccuracy * 100).toFixed(1)}% · Ready to optimize again`,
      };
    });
  }, []);

  const reset = useCallback(() => {
    datasetRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { state, runDataCollection, runOptimization, runMultiStartOptimization, acceptResult, reset };
}
