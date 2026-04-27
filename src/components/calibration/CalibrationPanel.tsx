import React, { useState, useEffect } from 'react';
import { BarChart2, Play, Zap, Check, AlertCircle, Loader2, RefreshCw, Copy, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { useCalibration } from './useCalibration';
import { getCalibrationCacheInfo } from '@/services/calibration/calibrationDatasetCache';

interface CalibrationPanelProps {
  currentWeights: NormalizationWeights;
  onApplyWeights: (weights: NormalizationWeights) => void;
  postPositionCurves?: PostPositionCurves;
  onPostPositionCurvesChange?: (curves: PostPositionCurves) => void;
}

const WEIGHT_LABELS: Record<keyof NormalizationWeights, string> = {
  postPosition: 'Post Position (global scale)',
  shoeType: 'Shoes (type)',
  sulkyType: 'Sulky Type',
  driverPerformance: 'Driver Performance',
  driverForm: 'Driver Form',
  trackFamiliarity: 'Track Familiarity',
  form: 'Form',
  distanceAdjustment: 'Distance Fit',
  raceDistanceAdjustment: 'Race Distance',
  volteStartDistancePenalty: 'Volte Penalty',
  startPoints: 'Start Points',
  placePercentage: 'Place %',
  horseWinPercentage: 'Win %',
  earningsPerStart: 'Earnings/Start',
  gallopRisk: 'Gallop Risk',
  layoffPenalty: 'Layoff Penalty',
  ageFactor: 'Age Factor',
  genderAdjustment: 'Gender (mare)',
  consistencyFactor: 'Consistency',
  trainerPerformance: 'Trainer Performance',
};

const MONTHS_OPTIONS = [1, 2, 3, 6];

function deltaColor(d: number): string {
  if (Math.abs(d) < 0.005) return 'text-muted-foreground';
  return d > 0 ? 'text-green-500' : 'text-red-500';
}

/** Returns the positions whose curve value changed by more than threshold. */
function curveChanges(
  original: Record<number, number>,
  optimized: Record<number, number>,
  threshold = 0.005
): Array<{ pos: number; from: number; to: number; delta: number }> {
  const results = [];
  for (let pos = 1; pos <= 15; pos++) {
    const from = original[pos] ?? 0;
    const to = optimized[pos] ?? 0;
    const delta = to - from;
    if (Math.abs(delta) >= threshold) results.push({ pos, from, to, delta });
  }
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  currentWeights,
  onApplyWeights,
  postPositionCurves,
  onPostPositionCurvesChange,
}) => {
  const [monthsBack, setMonthsBack] = useState(2);
  const [cacheInfo, setCacheInfo] = useState<{ exists: boolean; ageHours: number | null; dateCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { state, runDataCollection, runOptimization, acceptResult, reset } = useCalibration();

  const handleCopyWeights = () => {
    if (!state.optimizationResult) return;
    const r = state.optimizationResult;
    const w = r.optimizedWeights;
    // Use all keys present in optimizedWeights so nothing is dropped
    const keys = Object.keys(w) as (keyof NormalizationWeights)[];
    const lines = keys.map(k => `      ${k}: ${(w[k] ?? 0).toFixed(3)},`);
    const header = [
      `    // Calibrated ${new Date().toISOString().split('T')[0]}`,
      `    // MRR: ${r.initialMAE.toFixed(3)} → ${r.finalMAE.toFixed(3)}  Win: ${(r.finalEvaluation.winAccuracy * 100).toFixed(1)}%  Top-3: ${(r.finalEvaluation.topPickAccuracy * 100).toFixed(1)}%  Passes: ${r.passesCompleted}`,
    ].join('\n');
    const snippet = `${header}\n    weights: {\n${lines.join('\n')}\n    }`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    setCacheInfo(getCalibrationCacheInfo(monthsBack));
  }, [monthsBack, state.phase]);

  const isWorking = state.phase === 'fetching-dates' || state.phase === 'collecting' || state.phase === 'evaluating' || state.phase === 'optimizing';
  const hasDataset = !!state.dataset;
  const hasResult = !!state.optimizationResult;

  const handleApply = () => {
    if (!state.optimizationResult) return;
    onApplyWeights(state.optimizationResult.optimizedWeights);
    if (onPostPositionCurvesChange) {
      onPostPositionCurvesChange(state.optimizationResult.optimizedCurves);
    }
    // Promote the final eval to the new baseline so next optimization
    // tries to beat this result, not the original starting point.
    acceptResult();
  };

  const autoCurveChanges = (hasResult && postPositionCurves && state.optimizationResult?.optimizedCurves)
    ? curveChanges(postPositionCurves.auto, state.optimizationResult.optimizedCurves.auto)
    : [];
  const volteCurveChanges = (hasResult && postPositionCurves && state.optimizationResult?.optimizedCurves)
    ? curveChanges(postPositionCurves.volte, state.optimizationResult.optimizedCurves.volte)
    : [];

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
            saved · {cacheInfo.dateCount} dates · {
              cacheInfo.ageHours !== null
                ? cacheInfo.ageHours < 48
                  ? `${cacheInfo.ageHours.toFixed(0)}h ago`
                  : `${(cacheInfo.ageHours / 24).toFixed(0)}d ago`
                : ''
            }
          </span>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => runDataCollection(monthsBack, currentWeights, false, postPositionCurves)}
          disabled={isWorking}
          className="h-8 gap-1.5"
        >
          {isWorking && (state.phase === 'fetching-dates' || state.phase === 'collecting' || state.phase === 'evaluating')
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Play className="h-3.5 w-3.5" />}
          {cacheInfo?.exists ? 'Load Dataset' : 'Collect Data'}
        </Button>

        {(cacheInfo?.exists || hasDataset) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runDataCollection(monthsBack, currentWeights, true, postPositionCurves)}
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
            onClick={() => runOptimization(currentWeights, postPositionCurves)}
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
          <Stat label="Win %" value={`${(state.baselineEval.winAccuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="Top-3 %" value={`${(state.baselineEval.topPickAccuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="MRR" value={state.baselineEval.winnerMRR.toFixed(3)} />
          <Stat label="Winner Rank" value={state.baselineEval.winnerRankMAE.toFixed(3)} />
          <Stat label="Rank MAE" value={state.baselineEval.rankMAE.toFixed(3)} />
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
                Win: <span className="text-muted-foreground line-through">{(state.optimizationResult.initialEvaluation.winAccuracy * 100).toFixed(1)}%</span>
                {' → '}
                <span className="font-medium text-green-500">{(state.optimizationResult.finalEvaluation.winAccuracy * 100).toFixed(1)}%</span>
              </span>
              <span>
                MRR: <span className="text-muted-foreground line-through">{state.optimizationResult.initialMAE.toFixed(3)}</span>
                {' → '}
                <span className="font-medium">{state.optimizationResult.finalMAE.toFixed(3)}</span>
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
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyWeights}
                className="h-8 gap-1.5"
                title="Copy optimized weights as TypeScript for presetWeights.ts"
              >
                {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleApply}
                className="h-8 gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Apply Weights{state.optimizationResult.optimizedCurves ? ' & Curves' : ''}
              </Button>
            </div>
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

          {/* Per-position calibrated curves — always shown */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Per-Position Curves (seconds offset)
              {autoCurveChanges.length + volteCurveChanges.length === 0 && (
                <span className="ml-2 text-muted-foreground/60">· no change from starting values</span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CurveFullTable
                label="Auto Start"
                original={postPositionCurves?.auto ?? {}}
                optimized={state.optimizationResult.optimizedCurves.auto}
              />
              <CurveFullTable
                label="Volte Start"
                original={postPositionCurves?.volte ?? {}}
                optimized={state.optimizationResult.optimizedCurves.volte}
              />
            </div>
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

function CurveFullTable({
  label,
  original,
  optimized,
}: {
  label: string;
  original: Record<number, number>;
  optimized: Record<number, number>;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1 pr-3 font-medium">Pos</th>
            <th className="text-right py-1 px-2 font-medium">Before</th>
            <th className="text-right py-1 px-2 font-medium">Calibrated</th>
            <th className="text-right py-1 pl-2 font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 15 }, (_, i) => i + 1).map(pos => {
            const from = original[pos] ?? 0;
            const to = optimized[pos] ?? 0;
            const delta = to - from;
            const changed = Math.abs(delta) >= 0.005;
            return (
              <tr key={pos} className={`border-b border-border/30 ${changed ? '' : 'opacity-50'}`}>
                <td className="py-0.5 pr-3 text-muted-foreground">#{pos}</td>
                <td className="py-0.5 px-2 text-right tabular-nums">{from >= 0 ? '+' : ''}{from.toFixed(3)}s</td>
                <td className={`py-0.5 px-2 text-right tabular-nums font-medium ${changed ? '' : 'text-muted-foreground'}`}>
                  {to >= 0 ? '+' : ''}{to.toFixed(3)}s
                </td>
                <td className={`py-0.5 pl-2 text-right tabular-nums ${!changed ? 'text-muted-foreground' : delta < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {changed ? (delta >= 0 ? '+' : '') + delta.toFixed(3) + 's' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CalibrationPanel;
