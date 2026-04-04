import { useState, useCallback } from 'react';
import { NormalizationWeights } from '@/services/modernKm/types';
import {
  fetchHistoricalDates,
  collectCalibrationData,
  evaluateWeights,
  CalibrationDataset,
  CalibrationEvaluation,
  CollectionProgress,
} from '@/services/calibration/historicalCalibrationService';
import { getCalibrationCacheInfo, clearCalibrationDataset } from '@/services/calibration/calibrationDatasetCache';
import {
  optimizeWeights,
  OptimizationResult,
  OptimizationProgress,
} from '@/services/calibration/weightOptimizer';

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
  progressFraction: number; // 0-1
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

export function useCalibration() {
  const [state, setState] = useState<CalibrationState>(INITIAL_STATE);

  const updateState = (patch: Partial<CalibrationState>) =>
    setState(prev => ({ ...prev, ...patch }));

  /**
   * Step 1: Collect historical data for the given number of months back.
   * Loads from localStorage cache if available; fetches fresh data otherwise.
   * Pass forceRefresh=true to bypass the cache.
   */
  const runDataCollection = useCallback(async (monthsBack: number, currentWeights: NormalizationWeights, forceRefresh = false) => {
    updateState({ ...INITIAL_STATE, phase: 'fetching-dates', progressMessage: 'Checking cache…', progressFraction: 0 });

    try {
      // Check if cached dataset exists first (skip date scanning if so)
      const cacheInfo = getCalibrationCacheInfo(monthsBack);
      let dates: string[] = [];

      if (!forceRefresh && cacheInfo.exists && cacheInfo.dateCount > 0) {
        // Dataset cache exists — collectCalibrationData will load it directly
        updateState({ phase: 'collecting', progressMessage: `Found cached dataset (${cacheInfo.dateCount} dates). Loading…` });
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
        updateState({ phase: 'error', error: 'Could not collect data for any historical date. Check that past race results are available.' });
        return;
      }

      updateState({ phase: 'evaluating', progressMessage: 'Computing baseline MAE with current weights…', progressFraction: 1 });
      const baselineEval = await evaluateWeights(dataset, currentWeights);

      updateState({
        phase: 'done',
        dataset,
        baselineEval,
        progressMessage: `${dataset.length} dates · ${dataset.reduce((s, d) => s + d.races.length, 0)} races · Baseline rank MAE: ${baselineEval.rankMAE.toFixed(3)}`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  /**
   * Step 2: Optimize weights against the already-collected dataset.
   * Can be called multiple times with different starting weights.
   */
  const runOptimization = useCallback(async (currentWeights: NormalizationWeights) => {
    if (!state.dataset) return;

    updateState({ phase: 'optimizing', progressMessage: 'Starting coordinate descent optimization…', optimizationResult: null });

    try {
      const result = await optimizeWeights(state.dataset, currentWeights, (p: OptimizationProgress) => {
        updateState({
          progressMessage: p.message,
          progressFraction: p.maxPasses > 0 ? p.pass / p.maxPasses : 0,
        });
      });

      updateState({
        phase: 'done',
        optimizationResult: result,
        progressMessage: `Optimization complete. Rank MAE: ${result.initialMAE.toFixed(3)} → ${result.finalMAE.toFixed(3)} (${result.improvementPct >= 0 ? '+' : ''}${result.improvementPct.toFixed(1)}% better)`,
        progressFraction: 1,
      });
    } catch (err) {
      updateState({ phase: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }, [state.dataset]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { state, runDataCollection, runOptimization, reset };
}
