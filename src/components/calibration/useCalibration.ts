import { useState, useCallback, useRef } from 'react';
import { NormalizationWeights } from '@/services/modernKm/types';
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
  // Keep dataset in a ref so runOptimization always sees the latest value
  const datasetRef = useRef<CalibrationDataset | null>(null);

  const updateState = (patch: Partial<CalibrationState>) =>
    setState(prev => ({ ...prev, ...patch }));

  /**
   * Step 1: Collect historical data. Loads from localStorage cache if available.
   * The baseline evaluation runs in the calibration worker to keep UI responsive.
   */
  const runDataCollection = useCallback(async (monthsBack: number, currentWeights: NormalizationWeights, forceRefresh = false) => {
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
        { type: 'EVALUATE', payload: { dataset, weights: currentWeights } },
        'EVAL_DONE'
      );

      updateState({
        phase: 'done',
        dataset,
        baselineEval,
        progressMessage: `${dataset.length} dates · ${dataset.reduce((s, d) => s + d.races.length, 0)} races · Baseline rank MAE: ${baselineEval.rankMAE.toFixed(3)} · Win: ${(baselineEval.winAccuracy * 100).toFixed(1)}%`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  /**
   * Step 2: Optimize weights in a Web Worker — UI stays fully responsive.
   */
  const runOptimization = useCallback(async (currentWeights: NormalizationWeights) => {
    const dataset = datasetRef.current ?? state.dataset;
    if (!dataset) return;

    updateState({ phase: 'optimizing', progressMessage: 'Starting optimization…', optimizationResult: null });

    try {
      const result = await runInWorker<OptimizationResult>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'OPTIMIZE', payload: { dataset, initialWeights: currentWeights } },
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

  const reset = useCallback(() => {
    datasetRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { state, runDataCollection, runOptimization, reset };
}
