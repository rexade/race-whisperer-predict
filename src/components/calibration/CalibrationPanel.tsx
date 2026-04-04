import React, { useState, useEffect } from 'react';
import { BarChart2, Play, Zap, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizationWeights } from '@/services/modernKm/types';
import { useCalibration } from './useCalibration';
import { getCalibrationCacheInfo } from '@/services/calibration/calibrationDatasetCache';

interface CalibrationPanelProps {
  currentWeights: NormalizationWeights;
  onApplyWeights: (weights: NormalizationWeights) => void;
}

const WEIGHT_LABELS: Record<keyof NormalizationWeights, string> = {
  postPosition: 'Post Position',
  shoeType: 'Shoes (type)',
  sulkyType: 'Sulky Type',
  driverPerformance: 'Driver Performance',
  trackFamiliarity: 'Track Familiarity',
  form: 'Form',
  distanceAdjustment: 'Distance Fit',
  raceDistanceAdjustment: 'Race Distance',
  volteStartDistancePenalty: 'Volte Penalty',
  startPoints: 'Start Points',
  placePercentage: 'Place %',
  horseWinPercentage: 'Win %',
  earningsPerStart: 'Earnings/Start',
};

const MONTHS_OPTIONS = [1, 2, 3, 6];

function deltaColor(d: number): string {
  if (Math.abs(d) < 0.005) return 'text-muted-foreground';
  return d > 0 ? 'text-green-500' : 'text-red-500';
}

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ currentWeights, onApplyWeights }) => {
  const [monthsBack, setMonthsBack] = useState(2);
  const [cacheInfo, setCacheInfo] = useState<{ exists: boolean; ageHours: number | null; dateCount: number } | null>(null);
  const { state, runDataCollection, runOptimization, reset } = useCalibration();

  // Check cache status whenever monthsBack changes
  useEffect(() => {
    setCacheInfo(getCalibrationCacheInfo(monthsBack));
  }, [monthsBack, state.phase]);

  const isWorking = state.phase === 'fetching-dates' || state.phase === 'collecting' || state.phase === 'evaluating' || state.phase === 'optimizing';
  const hasDataset = !!state.dataset;
  const hasResult = !!state.optimizationResult;

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">Historical Weight Calibration</span>
        <span className="text-xs text-muted-foreground ml-1">
          — optimize weights against real past results
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">History:</span>
          <div className="flex gap-1">
            {MONTHS_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setMonthsBack(m)}
                disabled={isWorking}
                className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                  monthsBack === m
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {m}mo
              </button>
            ))}
          </div>
        </div>

        {/* Cache status badge */}
        {cacheInfo?.exists && !hasDataset && (
          <span className="text-xs text-muted-foreground border border-border rounded px-2 py-0.5">
            cached · {cacheInfo.dateCount} dates · {cacheInfo.ageHours?.toFixed(0)}h ago
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => runDataCollection(monthsBack, currentWeights, false)}
          disabled={isWorking}
          className="h-8 gap-1.5"
        >
          {isWorking && (state.phase === 'fetching-dates' || state.phase === 'collecting' || state.phase === 'evaluating')
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Play className="h-3.5 w-3.5" />}
          {cacheInfo?.exists ? 'Load Dataset' : 'Collect Data'}
        </Button>

        {/* Force refresh — only show when cache exists or dataset is loaded */}
        {(cacheInfo?.exists || hasDataset) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runDataCollection(monthsBack, currentWeights, true)}
            disabled={isWorking}
            title="Re-fetch from ATG (ignores cache)"
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}

        {hasDataset && (
          <Button
            size="sm"
            onClick={() => runOptimization(currentWeights)}
            disabled={isWorking}
            className="h-8 gap-1.5"
          >
            {isWorking && state.phase === 'optimizing'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />}
            Optimize Weights
          </Button>
        )}

        {(hasDataset || state.phase === 'error') && (
          <Button size="sm" variant="ghost" onClick={reset} disabled={isWorking} className="h-8">
            Reset
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {isWorking && (
        <div className="space-y-1.5">
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(state.progressFraction * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{state.progressMessage}</p>
        </div>
      )}

      {/* Error */}
      {state.phase === 'error' && state.error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Baseline stats */}
      {state.baselineEval && !isWorking && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Dates" value={state.dataset?.length ?? 0} />
          <Stat label="Races" value={state.dataset?.reduce((s, d) => s + d.races.length, 0) ?? 0} />
          <Stat label="Horses (real data)" value={state.baselineEval.horsesEvaluated} />
          <Stat label="Estimated skipped" value={state.baselineEval.estimatedHorsesSkipped} />
          <Stat label="Rank MAE" value={state.baselineEval.rankMAE.toFixed(3)} highlight />
          <Stat label="Win accuracy" value={`${(state.baselineEval.winAccuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="Top-3 accuracy" value={`${(state.baselineEval.topPickAccuracy * 100).toFixed(1)}%`} />
          {state.baselineEval.timeMAE !== null && (
            <Stat label="Time MAE" value={`${state.baselineEval.timeMAE.toFixed(2)}s`} />
          )}
        </div>
      )}

      {/* Optimization result */}
      {hasResult && !isWorking && state.optimizationResult && (
        <div className="space-y-3 border border-border rounded-lg p-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Optimization complete</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                Rank MAE: <span className="text-muted-foreground line-through">{state.optimizationResult.initialMAE.toFixed(3)}</span>
                {' → '}
                <span className="font-medium text-green-500">{state.optimizationResult.finalMAE.toFixed(3)}</span>
              </span>
              <span>
                Win: <span className="font-medium text-green-500">{(state.optimizationResult.finalEvaluation.winAccuracy * 100).toFixed(1)}%</span>
              </span>
              <span>
                Top-3: <span className="font-medium">{(state.optimizationResult.finalEvaluation.topPickAccuracy * 100).toFixed(1)}%</span>
              </span>
              <span className={deltaColor(state.optimizationResult.improvementPct)}>
                {state.optimizationResult.improvementPct >= 0 ? '▲' : '▼'}{Math.abs(state.optimizationResult.improvementPct).toFixed(1)}% better
              </span>
              <span className="text-muted-foreground text-xs">
                {state.optimizationResult.passesCompleted} passes
              </span>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={() => onApplyWeights(state.optimizationResult!.optimizedWeights)}
              className="h-8 gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Weights
            </Button>
          </div>

          {/* Per-weight comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-medium">Factor</th>
                  <th className="text-right py-1.5 px-3 font-medium">Current</th>
                  <th className="text-right py-1.5 px-3 font-medium">Optimized</th>
                  <th className="text-right py-1.5 pl-3 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(WEIGHT_LABELS) as (keyof NormalizationWeights)[]).map(key => {
                  const cur = currentWeights[key];
                  const opt = state.optimizationResult!.optimizedWeights[key];
                  const delta = opt - cur;
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-1.5 pr-4 text-muted-foreground">{WEIGHT_LABELS[key]}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{cur.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-medium">{opt.toFixed(3)}</td>
                      <td className={`py-1.5 pl-3 text-right tabular-nums ${deltaColor(delta)}`}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status message when done without optimization */}
      {state.phase === 'done' && !hasResult && state.progressMessage && (
        <p className="text-xs text-muted-foreground">{state.progressMessage}</p>
      )}
    </div>
  );
};

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</span>
    </div>
  );
}

export default CalibrationPanel;
