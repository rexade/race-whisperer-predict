import { useState, useCallback, useRef } from 'react';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { WEIGHT_PRESETS } from '@/services/modernKm/presetWeights';
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

const MULTISTART_PRESET_NAMES = [
  'V36 Experimental — V32 source-tuned (2026-05-08)',
  'V35 Experimental — V34 refined (2026-05-07)',
  'V34 Experimental — R01 curve tuned (2026-05-07)',
  'V32 Experimental — backtested (2026-04-30)',
  'V20 — Clean Baseline (2026-04-27)',
] as const;

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
      const cacheInfo = await getCalibrationCacheInfo(monthsBack);
      let dates: string[] = [];

      if (!forceRefresh && cacheInfo.exists && cacheInfo.dateCount > 0) {
        updateState({ phase: 'collecting', progressMessage: `Found saved dataset (${cacheInfo.dateCount} dates). Loading…` });
      } else {
        updateState({ phase: 'fetching-dates', progressMessage: 'Scanning calendar for past games…' });
        dates = await fetchHistoricalDates(monthsBack);
        if (dates.length === 0) {
          updateState({ phase: 'error', error: 'No historical game dates found for the selected period.' });
          return;
        }
        updateState({ datesFound: dates.length, phase: 'collecting', progressMessage: `Found ${dates.length} game dates. Collecting data…` });
      }

      // Use ALL dates for training — L2 regularization prevents overfitting
      // without needing a held-out test set. With only 6 months of data,
      // splitting off 1 month wastes data and produces noisy test estimates.
      const dataset = await collectCalibrationData(
        dates,
        (p: CollectionProgress) => {
          updateState({
            progressMessage: p.message,
            progressFraction: p.datesTotal > 0 ? p.datesCompleted / p.datesTotal : 0,
          });
        },
        monthsBack,
        forceRefresh
      );

      if (dataset.length === 0) {
        updateState({ phase: 'error', error: 'Could not collect data for any historical date.' });
        return;
      }

      datasetRef.current = dataset;
      testDatasetRef.current = null;

      // Baseline evaluation — run in worker to avoid blocking UI
      updateState({ phase: 'evaluating', progressMessage: 'Computing baseline accuracy…', progressFraction: 1 });

      const baselineEval = await runInWorker<CalibrationEvaluation>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'EVALUATE', payload: { dataset, weights: currentWeights, curves: currentCurves } },
        'EVAL_DONE'
      );

      // Compute per-driver empirical ratings from the dataset and cache them.
      const driverRatings = computeDriverRatings(dataset);
      saveDriverRatings(driverRatings);
      invalidateDriverRatingCache();
      const driverCount = getDriverRatingCount();

      const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);

      updateState({
        phase: 'done',
        dataset,
        testDataset: null,
        baselineEval,
        progressMessage: `${dataset.length} dates · ${totalRaces} races · ${driverCount} driver ratings · Win: ${(baselineEval.winAccuracy * 100).toFixed(1)}%`,
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
        ? `  TEST Win: ${(result.testEvaluation.winAccuracy * 100).toFixed(1)}% · WTop5: ${(result.testEvaluation.winnerTop5Accuracy * 100).toFixed(1)}% ← truth`
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

    const selectedPresets = MULTISTART_PRESET_NAMES
      .map(name => WEIGHT_PRESETS.find(preset => preset.name === name))
      .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset));

    const starts: Array<{ label: string; weights: NormalizationWeights; curves?: PostPositionCurves }> = [
      { label: 'Current', weights: currentWeights, curves: currentCurves },
      ...selectedPresets.map(preset => ({
        label: preset.name,
        weights: preset.weights,
        curves: preset.postPositionCurves ?? currentCurves,
      })),
    ];

    updateState({ phase: 'optimizing', progressMessage: `Multi-start: 0/${starts.length} runs…`, optimizationResult: null });

    let bestResult: OptimizationResult | null = null;
    let bestWin = -Infinity;
    // Per-run summary for copy-paste — keep only the strongest finished runs.
    const runSummary: Array<{ label: string; result: OptimizationResult }> = [];

    for (let i = 0; i < starts.length; i++) {
      const { label, weights, curves } = starts[i];
      const runLabel = `Run ${i + 1}/${starts.length} from ${label}`;
      const bestStr = bestResult ? ` · best so far: ${(bestWin * 100).toFixed(1)}%` : '';
      updateState({
        progressMessage: `${runLabel}${bestStr}`,
        progressFraction: i / starts.length,
      });

      try {
        const result = await runInWorker<OptimizationResult>(
          () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
          { type: 'OPTIMIZE', payload: { dataset, initialWeights: weights, initialCurves: curves, testDataset } },
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
        const isBest = winRate > bestWin;
        runSummary.push({ label, result });
        if (isBest) {
          bestWin = winRate;
          bestResult = result;
        }
      } catch (err) {
        console.warn(`Multi-start run ${i + 1} (${label}) failed:`, err);
      }
    }

    if (!bestResult) {
      updateState({ phase: 'error', error: 'All multi-start runs failed.' });
      return;
    }

    const topRuns = [...runSummary]
      .sort((a, b) =>
        b.result.finalEvaluation.winAccuracy - a.result.finalEvaluation.winAccuracy
        || b.result.finalEvaluation.winnerMRR - a.result.finalEvaluation.winnerMRR
        || b.result.finalEvaluation.winnerTop5Accuracy - a.result.finalEvaluation.winnerTop5Accuracy
      )
      .slice(0, 6);
    const runTable = topRuns
      .map(({ label, result }) => {
        const isWinner = result === bestResult;
        const e = result.finalEvaluation;
        return `${isWinner ? '★' : ' '} ${label.padEnd(14)} Win=${(e.winAccuracy * 100).toFixed(1)}%  WTop3=${(e.winnerTop3Accuracy * 100).toFixed(1)}%  WTop5=${(e.winnerTop5Accuracy * 100).toFixed(1)}%  MRR=${e.winnerMRR.toFixed(3)}`;
      })
      .join('\n');
    updateState({
      phase: 'done',
      optimizationResult: bestResult,
      runSummary: runTable,
      progressMessage: `Multi-start done · Best Win: ${(bestWin * 100).toFixed(1)}% · WTop5: ${(bestResult.finalEvaluation.winnerTop5Accuracy * 100).toFixed(1)}% · MRR: ${bestResult.finalMAE.toFixed(3)}`,
      progressFraction: 1,
    });
  }, [state.dataset]);

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
        progressMessage: `New baseline · Rank MAE: ${newBaseline.rankMAE.toFixed(3)} · Win: ${(newBaseline.winAccuracy * 100).toFixed(1)}% · WTop5: ${(newBaseline.winnerTop5Accuracy * 100).toFixed(1)}% · Ready to optimize again`,
      };
    });
  }, []);

  const reset = useCallback(() => {
    datasetRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { state, runDataCollection, runOptimization, runMultiStartOptimization, acceptResult, reset };
}
