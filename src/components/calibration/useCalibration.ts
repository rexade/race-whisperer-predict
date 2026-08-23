import { useState, useCallback, useRef } from 'react';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { WEIGHT_PRESETS } from '@/services/modernKm/presetWeights';
import {
  fetchHistoricalDates,
  collectCalibrationData,
  CalibrationDataset,
  CalibrationEvaluation,
  CollectionProgress,
} from '@/services/calibration/historicalCalibrationService';
import { getCalibrationCacheInfo } from '@/services/calibration/calibrationDatasetCache';
import { chronologicalHoldout } from '@/services/calibration/datasetSplits';
import type { KFoldResult, KFoldStart } from '@/services/calibration/kfoldCalibration';
import { OptimizationResult } from '@/services/calibration/weightOptimizer';
import { computeDriverRatings, saveDriverRatings, getDriverRatingCount } from '@/services/calibration/driverRatingService';
import type { GameType } from '@/config/game';

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
  /** Held-out most recent dates — never seen by the optimizer. Null when the dataset
   *  was too small to split, in which case no honest out-of-sample number exists. */
  testDataset: CalibrationDataset | null;
  /** Current weights measured on the training dates. */
  baselineEval: CalibrationEvaluation | null;
  /** Current weights measured on the holdout — the before half of the honest delta. */
  baselineTestEval: CalibrationEvaluation | null;
  optimizationResult: OptimizationResult | null;
  /** Per-run summary table from multi-start — each line is one run's win/MRR result. */
  runSummary: string | null;
  /** Result of the k-fold protocol: out-of-fold rankings plus the honest holdout table. */
  kfoldResult: KFoldResult | null;
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
  baselineTestEval: null,
  optimizationResult: null,
  runSummary: null,
  kfoldResult: null,
  error: null,
};

// V3X family. V38 dropped — placed last (38.5% Win) in the 2026-05-10 run.
// V39 lives in DEFAULT_WEIGHTS so "Current" already inherits it; no need to
// duplicate it here. Trimmed because bucketed mode triples Phase B dims.
/** Split parameters shared with the CLI reports so the numbers line up. */
const HOLDOUT_FRACTION = 0.2;
const HOLDOUT_MIN_DATES = 6;
/** Under this, the 6-date floor leaves too little training data to be worth it. */
const MIN_DATES_FOR_HOLDOUT = 12;

const MULTISTART_PRESET_NAMES = [
  'V40 Multistart — 6mo 44.2% (2026-05-11)',
  'V37 Experimental — V36 refined (2026-05-08)',
  'V36 Experimental — V32 source-tuned (2026-05-08)',
  'V35 Experimental — V34 refined (2026-05-07)',
  'V34 Experimental — R01 curve tuned (2026-05-07)',
] as const;

/**
 * One-line outcome. Leads with the holdout, because the training figure always
 * improves — that is what the optimizer was maximising — and is not evidence on its
 * own. When there is no holdout, say so rather than letting a training number stand
 * unqualified.
 */
function describeOutcome(
  result: OptimizationResult,
  baselineTest: CalibrationEvaluation | null
): string {
  const train = `Train win ${(result.finalEvaluation.winAccuracy * 100).toFixed(1)}%`;
  const test = result.testEvaluation;
  if (!test) return `${train} · no holdout — unverified out-of-sample`;

  const testWin = (test.winAccuracy * 100).toFixed(1);
  if (!baselineTest) return `Holdout win ${testWin}% · ${train}`;

  const delta = (test.winAccuracy - baselineTest.winAccuracy) * 100;
  const arrow = delta >= 0 ? '+' : '';
  return `Holdout win ${(baselineTest.winAccuracy * 100).toFixed(1)}% → ${testWin}% (${arrow}${delta.toFixed(1)}pp) · ${train}`;
}

export class CalibrationCancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CalibrationCancelled';
  }
}

function runInWorker<T>(
  workerFactory: () => Worker,
  message: unknown,
  doneType: string,
  onProgress?: (p: any) => void,
  registerWorker?: (worker: Worker | null) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = workerFactory();
    registerWorker?.(worker);
    const finish = () => {
      registerWorker?.(null);
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload, error } = event.data;
      if (type === 'PROGRESS') {
        onProgress?.(payload);
      } else if (type === doneType) {
        finish();
        resolve(payload as T);
      } else if (type === 'ERROR') {
        finish();
        reject(new Error(error));
      }
    };

    worker.onerror = (e) => {
      finish();
      reject(new Error(e.message || 'Worker error'));
    };

    worker.postMessage(message);
  });
}

export function useCalibration(gameType: GameType) {
  const [state, setState] = useState<CalibrationState>(INITIAL_STATE);
  const datasetRef = useRef<CalibrationDataset | null>(null);
  const testDatasetRef = useRef<CalibrationDataset | null>(null);
  const baselineTestEvalRef = useRef<CalibrationEvaluation | null>(null);
  const activeWorkerRef = useRef<Worker | null>(null);
  const cancelledRef = useRef(false);

  const registerWorker = useCallback((worker: Worker | null) => {
    activeWorkerRef.current = worker;
  }, []);

  /**
   * Stop the run in flight. The optimizer is a tight CPU loop with no interruption
   * point, so the worker is terminated outright; partial results are discarded rather
   * than reported, since a half-finished search says nothing about the weights.
   */
  const cancelRun = useCallback(() => {
    cancelledRef.current = true;
    activeWorkerRef.current?.terminate();
    activeWorkerRef.current = null;
    setState(prev => ({
      ...prev,
      phase: prev.dataset ? 'done' : 'idle',
      progressMessage: 'Cancelled.',
      progressFraction: 0,
    }));
  }, []);

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
      const cacheInfo = await getCalibrationCacheInfo(monthsBack, gameType);
      let dates: string[] = [];

      if (!forceRefresh && cacheInfo.exists && cacheInfo.dateCount > 0) {
        updateState({ phase: 'collecting', progressMessage: `Found saved dataset (${cacheInfo.dateCount} dates). Loading…` });
      } else {
        updateState({ phase: 'fetching-dates', progressMessage: 'Scanning calendar for past games…' });
        dates = await fetchHistoricalDates(monthsBack, gameType);
        if (dates.length === 0) {
          updateState({ phase: 'error', error: 'No historical game dates found for the selected period.' });
          return;
        }
        updateState({ datesFound: dates.length, phase: 'collecting', progressMessage: `Found ${dates.length} game dates. Collecting data…` });
      }

      // L2 alone does not make a training score an unbiased estimate of real
      // performance: with 25 weights and 30-90 curve values fitted by direct search
      // against the training set, the training number is optimistic by construction.
      // The most recent dates are held back so there is one number on screen that the
      // optimizer never touched.
      const fullDataset = await collectCalibrationData(
        dates,
        (p: CollectionProgress) => {
          updateState({
            progressMessage: p.message,
            progressFraction: p.datesTotal > 0 ? p.datesCompleted / p.datesTotal : 0,
          });
        },
        monthsBack,
        forceRefresh,
        gameType
      );

      if (fullDataset.length === 0) {
        updateState({ phase: 'error', error: 'Could not collect data for any historical date.' });
        return;
      }

      // Same split parameters the CLI reports use (20% of dates, at least 6), so a
      // holdout number here is directly comparable with kfold-multistart / eval-holdout.
      // Below MIN_DATES_FOR_HOLDOUT the 6-date floor would eat most of the dataset and
      // leave too little to fit on, so nothing is held back and the UI says as much.
      const { train: dataset, holdout: testDataset } = fullDataset.length >= MIN_DATES_FOR_HOLDOUT
        ? chronologicalHoldout(fullDataset, HOLDOUT_FRACTION, HOLDOUT_MIN_DATES)
        : { train: fullDataset, holdout: [] as CalibrationDataset };
      datasetRef.current = dataset;
      testDatasetRef.current = testDataset.length > 0 ? testDataset : null;
      baselineTestEvalRef.current = null;

      // Baseline evaluation — run in worker to avoid blocking UI
      updateState({ phase: 'evaluating', progressMessage: 'Computing baseline accuracy…', progressFraction: 1 });

      const evalWorker = () =>
        new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' });

      const baselineEval = await runInWorker<CalibrationEvaluation>(
        evalWorker,
        { type: 'EVALUATE', payload: { dataset, weights: currentWeights, curves: currentCurves, gameType } },
        'EVAL_DONE'
      );

      // Same weights on the holdout, so the result screen can show a before/after that
      // is out-of-sample on both ends rather than an in-sample delta.
      const baselineTestEval = testDataset.length > 0
        ? await runInWorker<CalibrationEvaluation>(
            evalWorker,
            {
              type: 'EVALUATE',
              payload: {
                dataset: testDataset,
                weights: currentWeights,
                curves: currentCurves,
                gameType,
                // Ratings from training dates only — deriving them from the holdout
                // would encode its own winners into the predictions scoring it.
                ratingsDataset: dataset,
              },
            },
            'EVAL_DONE'
          )
        : null;

      // Compute per-driver empirical ratings from the dataset and cache them.
      // Ratings come from training dates only — deriving them from the holdout would
      // feed its results back into every prediction the holdout then scores.
      const driverRatings = computeDriverRatings(dataset);
      saveDriverRatings(driverRatings, gameType);
      const driverCount = getDriverRatingCount(gameType);

      baselineTestEvalRef.current = baselineTestEval;

      const totalRaces = dataset.reduce((s, d) => s + d.races.length, 0);
      const holdoutNote = testDataset.length > 0
        ? ` · holdout ${testDataset.length} dates`
        : ' · no holdout (dataset too small)';

      updateState({
        phase: 'done',
        dataset,
        testDataset: testDataset.length > 0 ? testDataset : null,
        baselineEval,
        baselineTestEval,
        progressMessage: `${dataset.length} train dates · ${totalRaces} races · ${driverCount} driver ratings${holdoutNote} · Train win: ${(baselineEval.winAccuracy * 100).toFixed(1)}%`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, [gameType]);

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

    cancelledRef.current = false;
    updateState({
      phase: 'optimizing', progressMessage: 'Starting optimization…',
      optimizationResult: null, kfoldResult: null,
    });

    try {
      const result = await runInWorker<OptimizationResult>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        { type: 'OPTIMIZE', payload: { dataset, initialWeights: currentWeights, initialCurves: currentCurves, testDataset, gameType } },
        'DONE',
        (p) => updateState({
          progressMessage: p.message,
          progressFraction: p.maxPasses > 0 ? p.pass / p.maxPasses : 0,
        }),
        registerWorker
      );

      updateState({
        phase: 'done',
        optimizationResult: result,
        progressMessage: describeOutcome(result, baselineTestEvalRef.current),
        progressFraction: 1,
      });
    } catch (err) {
      if (cancelledRef.current) return;
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, [state.dataset, gameType, registerWorker]);

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

    cancelledRef.current = false;
    updateState({
      phase: 'optimizing', progressMessage: `Multi-start: 0/${starts.length} runs…`,
      optimizationResult: null, kfoldResult: null,
    });

    let bestResult: OptimizationResult | null = null;
    let bestWin = -Infinity;
    // Per-run summary for copy-paste — keep only the strongest finished runs.
    const runSummary: Array<{ label: string; result: OptimizationResult }> = [];

    for (let i = 0; i < starts.length; i++) {
      if (cancelledRef.current) return;
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
          { type: 'OPTIMIZE', payload: { dataset, initialWeights: weights, initialCurves: curves, testDataset, gameType } },
          'DONE',
          (p) => {
            const best = bestResult ? ` · best: ${(bestWin * 100).toFixed(1)}%` : '';
            updateState({
              progressMessage: `${runLabel}${best} · ${p.message}`,
              progressFraction: (i + (p.maxPasses > 0 ? p.pass / p.maxPasses : 0)) / starts.length,
            });
          },
          registerWorker
        );

        // Selection stays on the training score. Picking the run that scores best on
        // the holdout would fit the holdout through the back door and forfeit the one
        // honest number on the screen — choosing between candidates is still fitting.
        const winRate = result.finalEvaluation.winAccuracy;
        const isBest = winRate > bestWin;
        runSummary.push({ label, result });
        if (isBest) {
          bestWin = winRate;
          bestResult = result;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        console.warn(`Multi-start run ${i + 1} (${label}) failed:`, err);
      }
    }

    if (cancelledRef.current) return;
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
        const holdout = result.testEvaluation
          ? `  Holdout=${(result.testEvaluation.winAccuracy * 100).toFixed(1)}%`
          : '';
        return `${isWinner ? '★' : ' '} ${label.padEnd(14)} Train=${(e.winAccuracy * 100).toFixed(1)}%  WTop3=${(e.winnerTop3Accuracy * 100).toFixed(1)}%  WTop5=${(e.winnerTop5Accuracy * 100).toFixed(1)}%  MRR=${e.winnerMRR.toFixed(3)}${holdout}`;
      })
      .join('\n');
    updateState({
      phase: 'done',
      optimizationResult: bestResult,
      runSummary: runTable,
      progressMessage: `Multi-start · ${describeOutcome(bestResult, baselineTestEvalRef.current)}`,
      progressFraction: 1,
    });
  }, [state.dataset, gameType, registerWorker]);

  /**
   * K-fold multi-start — the honest protocol. Starts are ranked by out-of-fold score
   * rather than by training fit, the winner is refit on the full training window, and
   * only then is the holdout touched. Slower than plain multi-start by roughly the fold
   * count, which is the price of a selection signal that means something.
   */
  const runKFold = useCallback(async (
    currentWeights: NormalizationWeights,
    currentCurves?: PostPositionCurves
  ) => {
    const trainWindow = datasetRef.current ?? state.dataset;
    if (!trainWindow) return;
    const holdout = testDatasetRef.current ?? [];

    const starts: KFoldStart[] = [
      { name: 'Current', weights: currentWeights, curves: currentCurves },
      ...MULTISTART_PRESET_NAMES
        .map(name => WEIGHT_PRESETS.find(preset => preset.name === name))
        .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset))
        .map(preset => ({
          name: preset.name.split(' —')[0],
          weights: preset.weights,
          curves: preset.postPositionCurves ?? currentCurves,
        })),
    ];

    cancelledRef.current = false;
    updateState({
      phase: 'optimizing',
      progressMessage: 'Starting k-fold calibration…',
      optimizationResult: null,
      kfoldResult: null,
    });

    try {
      const result = await runInWorker<KFoldResult>(
        () => new Worker(new URL('../../workers/calibration.worker.ts', import.meta.url), { type: 'module' }),
        {
          type: 'KFOLD',
          payload: {
            trainWindow,
            holdout,
            starts,
            // The weights in use today, so the holdout table answers the only question
            // that matters: is this actually better than what is already shipped?
            baselines: [{ name: 'Current (production)', weights: currentWeights, curves: currentCurves }],
            options: { gameType, optimizeCurves: false },
          },
        },
        'KFOLD_DONE',
        p => updateState({
          progressMessage: p.message,
          progressFraction: p.total > 0 ? p.completed / p.total : 0,
        }),
        registerWorker
      );

      const verdict = result.refitBeatsBaseline === false
        ? ' · refit does NOT beat current weights on the holdout — keep what you have'
        : '';
      updateState({
        phase: 'done',
        kfoldResult: result,
        progressMessage: `K-fold done · winner "${result.winnerName}"${verdict}`,
        progressFraction: 1,
      });
    } catch (err) {
      if (cancelledRef.current) return;
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, [state.dataset, gameType, registerWorker]);

  /**
   * Promote the last optimization result to the new baseline.
   * Keeps the dataset loaded so the user can immediately optimize again.
   * Call this after applying optimized weights so each round improves on the last.
   */
  const acceptResult = useCallback(() => {
    setState(prev => {
      if (!prev.optimizationResult) return prev;
      const newBaseline = prev.optimizationResult.finalEvaluation;
      // Promote the holdout baseline too, or the next run's delta would be measured
      // against the weights from two rounds ago and read as a bigger gain than it is.
      const newTestBaseline = prev.optimizationResult.testEvaluation ?? prev.baselineTestEval;
      baselineTestEvalRef.current = newTestBaseline;
      const holdoutNote = newTestBaseline
        ? ` · Holdout win: ${(newTestBaseline.winAccuracy * 100).toFixed(1)}%`
        : '';
      return {
        ...prev,
        baselineEval: newBaseline,
        baselineTestEval: newTestBaseline,
        optimizationResult: null,
        kfoldResult: null,
        phase: 'done',
        progressMessage: `New baseline · Train win: ${(newBaseline.winAccuracy * 100).toFixed(1)}%${holdoutNote} · Ready to optimize again`,
      };
    });
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    activeWorkerRef.current?.terminate();
    activeWorkerRef.current = null;
    datasetRef.current = null;
    testDatasetRef.current = null;
    baselineTestEvalRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return {
    state, runDataCollection, runOptimization, runMultiStartOptimization, runKFold,
    acceptResult, reset, cancelRun,
  };
}
