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

      // Baseline evaluation — run in worker to avoid blocking UI
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

      updateState({
        phase: 'done',
        dataset,
        baselineEval,
        progressMessage: `${dataset.length} dates · ${dataset.reduce((s, d) => s + d.races.length, 0)} races · ${driverCount} driver ratings · Win: ${(baselineEval.winAccuracy * 100).toFixed(1)}%`,
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

    updateState({ phase: 'optimizing', progressMessage: 'Starting optimization…', optimizationResult: null });

    try {
      const result = await runInWorker<OptimizationResult>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'OPTIMIZE', payload: { dataset, initialWeights: currentWeights, initialCurves: currentCurves } },
        'DONE',
        (p) => updateState({
          progressMessage: p.message,
          progressFraction: p.maxPasses > 0 ? p.pass / p.maxPasses : 0,
        })
      );

      updateState({
        phase: 'done',
        optimizationResult: result,
        progressMessage: `Done. Rank MAE: ${result.initialMAE.toFixed(3)} → ${result.finalMAE.toFixed(3)} · Win: ${(result.finalEvaluation.winAccuracy * 100).toFixed(1)}%`,
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

    // V19-based starting configurations — post-leakage-fix re-calibration
    const starts: Array<{ label: string; weights: NormalizationWeights }> = [
      // V19: last known best (48.7% pre-fix, form/earnings/age dominated)
      { label: 'V19', weights: {
        postPosition: 1.538, shoeType: 0.000, sulkyType: 0.827,
        driverPerformance: 1.215, driverForm: 0.837, driverEmpirical: 0.000,
        trackFamiliarity: 0.856, form: 4.922, distanceAdjustment: 2.083,
        raceDistanceAdjustment: 3.634, volteStartDistancePenalty: 1.882,
        startPoints: 2.355, placePercentage: 1.294, horseWinPercentage: 1.320,
        earningsPerStart: 4.489, gallopRisk: 2.664, layoffPenalty: 1.958,
        ageFactor: 3.098, genderAdjustment: 2.595, consistencyFactor: 1.542,
        trainerPerformance: 0.465,
      }},
      // V19+Empirical: V19 but with driverEmpirical active (was 0 — test if it helps clean data)
      { label: 'V19+Emp', weights: {
        postPosition: 1.538, shoeType: 0.000, sulkyType: 0.827,
        driverPerformance: 1.215, driverForm: 0.837, driverEmpirical: 2.000,
        trackFamiliarity: 0.856, form: 4.922, distanceAdjustment: 2.083,
        raceDistanceAdjustment: 3.634, volteStartDistancePenalty: 1.882,
        startPoints: 2.355, placePercentage: 1.294, horseWinPercentage: 1.320,
        earningsPerStart: 4.489, gallopRisk: 2.664, layoffPenalty: 1.958,
        ageFactor: 3.098, genderAdjustment: 2.595, consistencyFactor: 1.542,
        trainerPerformance: 0.465,
      }},
      // V19+LessForm: form was likely inflated by leakage — test with form pulled back
      { label: 'V19+LessForm', weights: {
        postPosition: 1.538, shoeType: 0.000, sulkyType: 0.827,
        driverPerformance: 1.215, driverForm: 0.837, driverEmpirical: 0.000,
        trackFamiliarity: 0.856, form: 2.000, distanceAdjustment: 2.083,
        raceDistanceAdjustment: 3.634, volteStartDistancePenalty: 1.882,
        startPoints: 2.355, placePercentage: 1.294, horseWinPercentage: 1.320,
        earningsPerStart: 4.489, gallopRisk: 2.664, layoffPenalty: 1.958,
        ageFactor: 3.098, genderAdjustment: 2.595, consistencyFactor: 1.542,
        trainerPerformance: 0.465,
      }},
      // V19+HighTrainer: trainer may be underweighted now that signals are clean
      { label: 'V19+Trainer', weights: {
        postPosition: 1.538, shoeType: 0.000, sulkyType: 0.827,
        driverPerformance: 1.215, driverForm: 0.837, driverEmpirical: 0.000,
        trackFamiliarity: 0.856, form: 4.922, distanceAdjustment: 2.083,
        raceDistanceAdjustment: 3.634, volteStartDistancePenalty: 1.882,
        startPoints: 2.355, placePercentage: 1.294, horseWinPercentage: 1.320,
        earningsPerStart: 4.489, gallopRisk: 2.664, layoffPenalty: 1.958,
        ageFactor: 3.098, genderAdjustment: 2.595, consistencyFactor: 1.542,
        trainerPerformance: 3.000,
      }},
      // V19+Balanced: all signals pulled toward equal — escape form/earnings local optimum
      { label: 'V19+Balanced', weights: {
        postPosition: 1.538, shoeType: 0.000, sulkyType: 0.827,
        driverPerformance: 1.500, driverForm: 1.500, driverEmpirical: 1.000,
        trackFamiliarity: 0.856, form: 2.500, distanceAdjustment: 2.083,
        raceDistanceAdjustment: 2.000, volteStartDistancePenalty: 1.882,
        startPoints: 2.000, placePercentage: 1.500, horseWinPercentage: 1.500,
        earningsPerStart: 2.500, gallopRisk: 2.664, layoffPenalty: 1.958,
        ageFactor: 2.000, genderAdjustment: 1.500, consistencyFactor: 1.542,
        trainerPerformance: 1.500,
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
          { type: 'OPTIMIZE', payload: { dataset, initialWeights: weights, initialCurves: currentCurves } },
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
        // Record this run — flag as best if it leads
        const isBest = winRate > bestWin;
        runSummary.push(
          `${isBest ? '★' : ' '} ${label.padEnd(14)} Win=${( winRate * 100).toFixed(1)}%  MRR=${mrr.toFixed(3)}`
        );
        if (isBest) {
          bestWin = winRate;
          bestResult = result;
          // Re-mark previous best entry (remove its ★ since a new best was found)
          for (let j = 0; j < runSummary.length - 1; j++) {
            runSummary[j] = runSummary[j].replace(/^★/, ' ');
          }
          runSummary[runSummary.length - 1] = `★ ${label.padEnd(14)} Win=${(winRate * 100).toFixed(1)}%  MRR=${mrr.toFixed(3)}`;
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

    const runTable = runSummary.join('\n');
    updateState({
      phase: 'done',
      optimizationResult: bestResult,
      runSummary: runTable,
      progressMessage: `Multi-start done · Best Win: ${(bestWin * 100).toFixed(1)}% · MRR: ${bestResult.finalMAE.toFixed(3)}`,
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
