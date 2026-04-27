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

    // Diverse starting configurations — post-driverForm-fix, covers new signal space
    const starts: Array<{ label: string; weights: NormalizationWeights }> = [
      // V12: best post-fix result (40.0%, real driverForm)
      { label: 'V12', weights: {
        postPosition: 1.100, shoeType: 0.275, sulkyType: 0.500,
        driverPerformance: 1.200, driverForm: 1.800, trackFamiliarity: 0.000,
        form: 0.900, distanceAdjustment: 1.200, raceDistanceAdjustment: 0.700,
        volteStartDistancePenalty: 1.000, startPoints: 0.500,
        placePercentage: 0.800, horseWinPercentage: 0.200, earningsPerStart: 0.100,
        gallopRisk: 0.500, layoffPenalty: 0.600, ageFactor: 0.500,
        genderAdjustment: 0.000, consistencyFactor: 0.500, driverEmpirical: 1.000, trainerPerformance: 0.700,
      }},
      // Push both driver signals high — explores new ceiling (10.0) for driverForm
      { label: 'MaxDrivers', weights: {
        postPosition: 0.700, shoeType: 0.275, sulkyType: 0.500,
        driverPerformance: 4.000, driverForm: 8.000, trackFamiliarity: 0.000,
        form: 0.900, distanceAdjustment: 0.800, raceDistanceAdjustment: 1.100,
        volteStartDistancePenalty: 1.400, startPoints: 0.500,
        placePercentage: 0.600, horseWinPercentage: 0.200, earningsPerStart: 0.100,
        gallopRisk: 0.500, layoffPenalty: 0.600, ageFactor: 0.500,
        genderAdjustment: 0.300, consistencyFactor: 0.500, driverEmpirical: 1.000, trainerPerformance: 3.000,
      }},
      // V10-style layout (was best before fix) — let optimizer re-tune from old best
      { label: 'V10-style', weights: {
        postPosition: 0.900, shoeType: 0.275, sulkyType: 0.500,
        driverPerformance: 3.000, driverForm: 5.000, trackFamiliarity: 0.100,
        form: 0.900, distanceAdjustment: 0.800, raceDistanceAdjustment: 1.100,
        volteStartDistancePenalty: 1.400, startPoints: 0.500,
        placePercentage: 0.600, horseWinPercentage: 0.200, earningsPerStart: 0.100,
        gallopRisk: 0.500, layoffPenalty: 0.600, ageFactor: 0.500,
        genderAdjustment: 0.300, consistencyFactor: 0.500, driverEmpirical: 1.000, trainerPerformance: 3.000,
      }},
      // Balanced — moderate all signals, let optimizer find its own direction
      { label: 'Balanced', weights: {
        postPosition: 0.800, shoeType: 0.400, sulkyType: 0.500,
        driverPerformance: 1.500, driverForm: 3.000, trackFamiliarity: 0.100,
        form: 1.000, distanceAdjustment: 1.000, raceDistanceAdjustment: 1.200,
        volteStartDistancePenalty: 1.200, startPoints: 0.700,
        placePercentage: 0.800, horseWinPercentage: 0.400, earningsPerStart: 0.200,
        gallopRisk: 0.700, layoffPenalty: 0.700, ageFactor: 0.500,
        genderAdjustment: 0.400, consistencyFactor: 0.500, driverEmpirical: 1.000, trainerPerformance: 1.500,
      }},
      // Max stats — push frozen signals (gallopRisk, age, consistency) to ceiling
      { label: 'MaxStats', weights: {
        postPosition: 0.700, shoeType: 0.275, sulkyType: 0.500,
        driverPerformance: 1.200, driverForm: 2.000, trackFamiliarity: 0.000,
        form: 1.100, distanceAdjustment: 1.000, raceDistanceAdjustment: 1.300,
        volteStartDistancePenalty: 1.000, startPoints: 2.000,
        placePercentage: 2.000, horseWinPercentage: 2.000, earningsPerStart: 1.500,
        gallopRisk: 3.000, layoffPenalty: 2.000, ageFactor: 2.000,
        genderAdjustment: 1.500, consistencyFactor: 2.000, driverEmpirical: 1.000, trainerPerformance: 2.000,
      }},
      { label: 'Current', weights: currentWeights },
    ];

    updateState({ phase: 'optimizing', progressMessage: `Multi-start: 0/${starts.length} runs…`, optimizationResult: null });

    let bestResult: OptimizationResult | null = null;
    let bestWin = -Infinity;

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
        if (winRate > bestWin) {
          bestWin = winRate;
          bestResult = result;
        }
      } catch (err) {
        // Skip failed runs — log but continue
        console.warn(`Multi-start run ${i + 1} (${label}) failed:`, err);
      }
    }

    if (!bestResult) {
      updateState({ phase: 'error', error: 'All multi-start runs failed.' });
      return;
    }

    updateState({
      phase: 'done',
      optimizationResult: bestResult,
      progressMessage: `Multi-start done · ${starts.length} runs · Best Win: ${(bestWin * 100).toFixed(1)}% · MRR: ${bestResult.finalMAE.toFixed(3)}`,
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
