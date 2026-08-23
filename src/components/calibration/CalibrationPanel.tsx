import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Play, Zap, Shuffle, Check, AlertCircle, Loader2, RefreshCw, Copy, ClipboardCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizationWeights } from '@/services/modernKm/types';
import { PostPositionCurves } from '@/services/modernKm/index';
import { useCalibration } from './useCalibration';
import { getCalibrationCacheInfo } from '@/services/calibration/calibrationDatasetCache';
import type { GameType } from '@/config/game';

interface CalibrationPanelProps {
  currentWeights: NormalizationWeights;
  onApplyWeights: (weights: NormalizationWeights) => void;
  postPositionCurves?: PostPositionCurves;
  onPostPositionCurvesChange?: (curves: PostPositionCurves) => void;
  gameType: GameType;
}

const WEIGHT_LABELS: Record<keyof NormalizationWeights, string> = {
  postPosition: 'Post Position (global scale)',
  shoeType: 'Shoes (type)',
  sulkyType: 'Sulky Type',
  driverPerformance: 'Driver Performance',
  driverForm: 'Driver Form (field-relative)',
  driverEmpirical: 'Driver Empirical',
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
  oddsHistorical: 'Odds (historical)',
  oddsLive: 'Odds (live)',
  betDistribution: 'Bet Distribution (spelprocent)',
  shoeChange: 'Shoe Change',
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

/** Seed byDistance from the current legacy curves so opt-in starts from a sensible baseline.
 *  If byDistance is already populated (e.g. from server-applied calibration), preserve it
 *  rather than overwriting with flat-curve copies. */
function withDistanceBuckets(c: PostPositionCurves): PostPositionCurves {
  if (c.byDistance) return c;
  return {
    ...c,
    byDistance: {
      auto:  { short: { ...c.auto },  medium: { ...c.auto },  long: { ...c.auto }  },
      volte: { short: { ...c.volte }, medium: { ...c.volte }, long: { ...c.volte } },
    },
  };
}

function serializeDataset(dataset: NonNullable<ReturnType<typeof useCalibration>['state']['dataset']>) {
  return dataset.map(dateData => ({
    ...dateData,
    races: dateData.races.map(race => ({
      ...race,
      actualResults: Object.fromEntries(race.actualResults),
    })),
  }));
}

function downloadJson(filename: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({
  currentWeights,
  onApplyWeights,
  postPositionCurves,
  onPostPositionCurvesChange,
  gameType,
}) => {
  const [monthsBack, setMonthsBack] = useState(2);
  const [cacheInfo, setCacheInfo] = useState<{ exists: boolean; ageHours: number | null; dateCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [bucketedCurves, setBucketedCurves] = useState(false);
  const { state, runDataCollection, runOptimization, runMultiStartOptimization, runKFold, acceptResult, reset, cancelRun } = useCalibration(gameType);

  // The curves passed to the optimizer — bucketed when toggle on, otherwise the
  // raw legacy curves. We always seed byDistance from the current legacy curves
  // so the bucketed start has a reasonable baseline.
  const curvesForOptimizer = postPositionCurves
    ? (bucketedCurves ? withDistanceBuckets(postPositionCurves) : postPositionCurves)
    : undefined;

  const handleCopyWeights = () => {
    if (!state.optimizationResult) return;
    const r = state.optimizationResult;
    const w = r.optimizedWeights;
    // Use all keys present in optimizedWeights so nothing is dropped
    const keys = Object.keys(w) as (keyof NormalizationWeights)[];
    const formatNumber = (value: number | undefined) => Number(value ?? 0).toFixed(6);
    const lines = keys.map(k => `      ${k}: ${formatNumber(w[k])},`);
    const formatCurve = (curve: Record<number, number>) => Object.entries(curve)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([position, value]) => `        ${position}: ${formatNumber(value)},`)
      .join('\n');
    const header = [
      `    // Calibrated ${new Date().toISOString().split('T')[0]}`,
      `    // MRR: ${r.initialMAE.toFixed(3)} → ${r.finalMAE.toFixed(3)}  Win: ${(r.finalEvaluation.winAccuracy * 100).toFixed(1)}%  WTop3: ${(r.finalEvaluation.winnerTop3Accuracy * 100).toFixed(1)}%  WTop5: ${(r.finalEvaluation.winnerTop5Accuracy * 100).toFixed(1)}%  TopPickTop3: ${(r.finalEvaluation.topPickAccuracy * 100).toFixed(1)}%  Passes: ${r.passesCompleted}`,
    ].join('\n');
    const bd = r.optimizedCurves.byDistance;
    const byDistanceBlock = bd
      ? `,\n      byDistance: {\n        auto: {\n          short: {\n${formatCurve(bd.auto.short)}\n          },\n          medium: {\n${formatCurve(bd.auto.medium)}\n          },\n          long: {\n${formatCurve(bd.auto.long)}\n          },\n        },\n        volte: {\n          short: {\n${formatCurve(bd.volte.short)}\n          },\n          medium: {\n${formatCurve(bd.volte.medium)}\n          },\n          long: {\n${formatCurve(bd.volte.long)}\n          },\n        },\n      }`
      : '';
    const snippet = `${header}\n    weights: {\n${lines.join('\n')}\n    },\n    postPositionCurves: {\n      auto: {\n${formatCurve(r.optimizedCurves.auto)}\n      },\n      volte: {\n${formatCurve(r.optimizedCurves.volte)}\n      }${byDistanceBlock},\n    }`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    let cancelled = false;
    getCalibrationCacheInfo(monthsBack, gameType).then(info => {
      if (!cancelled) setCacheInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [gameType, monthsBack, state.phase]);

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

  /** Train + holdout, chronological. Exports must not ship only the training split. */
  const collectedDataset = useMemo(() => {
    if (!state.dataset) return null;
    return [...state.dataset, ...(state.testDataset ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.dataset, state.testDataset]);

  const handleDownloadDataset = () => {
    if (!collectedDataset) return;
    downloadJson(`calibration-dataset-${gameType}-${monthsBack}mo.json`, serializeDataset(collectedDataset));
  };

  const handleDownloadBundle = () => {
    if (!collectedDataset) return;
    const dataset = serializeDataset(collectedDataset);
    const totalRaces = collectedDataset.reduce((sum, dateData) => sum + dateData.races.length, 0);
    const totalRawTimes = collectedDataset.reduce(
      (sum, dateData) => sum + dateData.races.reduce((raceSum, race) => raceSum + race.rawKmTimes.length, 0),
      0
    );
    const totalAllTimes = collectedDataset.reduce(
      (sum, dateData) => sum + dateData.races.reduce(
        (raceSum, race) => raceSum + race.rawKmTimes.reduce((horseSum, rt) => horseSum + (rt.allTimes?.length ?? 0), 0),
        0
      ),
      0
    );
    downloadJson(`calibration-bundle-${gameType}-${monthsBack}mo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      purpose: 'Exact browser calibration replay bundle. Use this to reproduce the displayed score from the same dataset/rawtimes/weights.',
      monthsBack,
      gameType,
      bucketedCurves,
      cacheInfo,
      stats: {
        dates: collectedDataset.length,
        trainDates: state.dataset?.length ?? 0,
        holdoutDates: state.testDataset?.length ?? 0,
        races: totalRaces,
        rawTimeRows: totalRawTimes,
        allTimesRows: totalAllTimes,
      },
      currentWeights,
      currentPostPositionCurves: postPositionCurves ?? null,
      optimizerInputCurves: curvesForOptimizer ?? null,
      baselineEval: state.baselineEval,
      optimizationResult: state.optimizationResult,
      runSummary: state.runSummary,
      dataset,
    });
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

        <label
          className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
          title="Optimize separate post-position curves per distance bucket (≤1640m / 1641–2400m / >2400m). 90 curve params instead of 30 — overfit risk on small datasets."
        >
          <input
            type="checkbox"
            checked={bucketedCurves}
            onChange={e => setBucketedCurves(e.target.checked)}
            disabled={isWorking}
            className="h-3.5 w-3.5"
          />
          <span className="text-muted-foreground">Distance-bucketed curves (S/M/L)</span>
        </label>

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
          onClick={() => runDataCollection(monthsBack, currentWeights, false, curvesForOptimizer)}
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
            onClick={() => runDataCollection(monthsBack, currentWeights, true, curvesForOptimizer)}
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
            variant="ghost"
            onClick={handleDownloadDataset}
            title="Download dataset as JSON for offline analysis"
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        )}

        {hasDataset && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadBundle}
            title="Download exact dataset, raw times, weights, curves, metrics, and run summary for replay"
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Bundle
          </Button>
        )}

        {hasDataset && (
          <Button
            size="sm"
            onClick={() => runOptimization(currentWeights, curvesForOptimizer)}
            disabled={isWorking}
            className="h-8 gap-1.5"
          >
            {isWorking && state.phase === 'optimizing'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />}
            Optimize Weights
          </Button>
        )}

        {hasDataset && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => runMultiStartOptimization(currentWeights, curvesForOptimizer)}
            disabled={isWorking}
            title="Run optimizer from 5 diverse starting points and keep the best result"
            className="h-8 gap-1.5"
          >
            {isWorking && state.phase === 'optimizing'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Shuffle className="h-3.5 w-3.5" />}
            Multi-Start
          </Button>
        )}

        {hasDataset && (
          <Button
            size="sm"
            onClick={() => runKFold(currentWeights, curvesForOptimizer)}
            disabled={isWorking}
            className="h-8"
            title="Ranks starts by out-of-fold score instead of training fit, refits the winner, then reports the holdout. Slower, but the only mode whose comparison between starts means anything."
          >
            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
            K-Fold (honest)
          </Button>
        )}

        {/* A full multi-start is six sequential searches over the whole dataset; without
            this the only way out is closing the tab. */}
        {isWorking && state.phase === 'optimizing' && (
          <Button size="sm" variant="outline" onClick={cancelRun} className="h-8">
            Cancel
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
          <Stat label="Train dates" value={state.dataset?.length ?? 0} />
          <Stat label="Holdout dates" value={state.testDataset?.length ?? 0} />
          <Stat label="Train races" value={state.dataset?.reduce((s, d) => s + d.races.length, 0) ?? 0} />
          <Stat label="Horses (real data)" value={state.baselineEval.horsesEvaluated} />
          <Stat label="Estimated skipped" value={state.baselineEval.estimatedHorsesSkipped} />
          <Stat label="Win %" value={`${(state.baselineEval.winAccuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="Top-3 %" value={`${(state.baselineEval.topPickAccuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="Winner Top-5" value={`${(state.baselineEval.winnerTop5Accuracy * 100).toFixed(1)}%`} highlight />
          <Stat label="MRR" value={state.baselineEval.winnerMRR.toFixed(3)} />
          <Stat label="Winner Rank" value={state.baselineEval.winnerRankMAE.toFixed(3)} />
          <Stat label="Rank MAE" value={state.baselineEval.rankMAE.toFixed(3)} />
          <Stat label="Top-3 accuracy" value={`${(state.baselineEval.topPickAccuracy * 100).toFixed(1)}%`} />
          {state.baselineEval.timeMAE !== null && (
            <Stat label="Time MAE" value={`${state.baselineEval.timeMAE.toFixed(2)}s`} />
          )}
        </div>
      )}

      {/* K-fold result — out-of-fold rankings, then the untouched holdout. */}
      {state.kfoldResult && !isWorking && (
        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">
              K-fold complete · winner “{state.kfoldResult.winnerName}”
            </span>
            <span className="text-xs text-muted-foreground">
              {state.kfoldResult.trainDates} train dates · {state.kfoldResult.holdoutDates} held out
            </span>
          </div>

          {/* The verdict comes first: a refit that loses to current weights on unseen
              data is a result, and the useful action is to discard it. */}
          {state.kfoldResult.refitBeatsBaseline === false && (
            <div className="text-xs rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2">
              The refit does <span className="font-medium">not</span> beat your current weights
              on the holdout. Keep what you have — applying this would be fitting noise.
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Start rankings by mean out-of-fold MRR — scored on folds each run never saw
            </div>
            {state.kfoldResult.rankings.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2 text-xs tabular-nums">
                <span className="w-4 text-muted-foreground">{i === 0 ? '★' : ''}</span>
                <span className="w-40 truncate">{r.name}</span>
                <span className="font-medium">{r.meanOofMRR.toFixed(4)}</span>
                <span className="text-muted-foreground">±{r.stdOofMRR.toFixed(4)}</span>
                <span className="text-muted-foreground">win {(r.meanOofWin * 100).toFixed(1)}%</span>
              </div>
            ))}
            {state.kfoldResult.rankings.length > 1 && (() => {
              const [first, second] = state.kfoldResult!.rankings;
              // Spread across folds is the honest error bar. When the gap between the top
              // two is inside it, the ranking is not evidence and saying so beats a badge.
              const inNoise = Math.abs(first.meanOofMRR - second.meanOofMRR) < first.stdOofMRR;
              return inNoise ? (
                <div className="text-xs text-muted-foreground pt-1">
                  Top two are within one fold-to-fold standard deviation — treat this ordering
                  as a coin flip, not a finding.
                </div>
              ) : null;
            })()}
          </div>

          {state.kfoldResult.holdout.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Holdout — {state.kfoldResult.holdoutDates} dates the optimizer never touched
              </div>
              {state.kfoldResult.holdout.map(entry => (
                <div key={entry.label} className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="w-44 truncate">{entry.label}</span>
                  <span className="font-medium">MRR {entry.evaluation.winnerMRR.toFixed(4)}</span>
                  <span>win {(entry.evaluation.winAccuracy * 100).toFixed(1)}%</span>
                  <span className="text-muted-foreground">
                    top-3 {(entry.evaluation.winnerTop3Accuracy * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            size="sm"
            variant={state.kfoldResult.refitBeatsBaseline === false ? 'outline' : 'default'}
            className="h-8"
            onClick={() => {
              onApplyWeights(state.kfoldResult!.refit.optimizedWeights);
              onPostPositionCurvesChange?.(state.kfoldResult!.refit.optimizedCurves);
            }}
          >
            Apply refit weights
          </Button>
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
            {/* The holdout goes first and on its own line. Training win always improves —
                that is what was maximised — so it is not evidence, and putting the two
                side by side invites reading the bigger number as the real one. */}
            {state.optimizationResult.testEvaluation ? (
              <div className="flex flex-wrap items-center gap-2 text-sm rounded-md border border-border/60 px-3 py-2">
                <span className="font-medium">Holdout win</span>
                {state.baselineTestEval && (
                  <>
                    <span className="text-muted-foreground line-through">
                      {(state.baselineTestEval.winAccuracy * 100).toFixed(1)}%
                    </span>
                    <span>→</span>
                  </>
                )}
                <span className="font-medium">
                  {(state.optimizationResult.testEvaluation.winAccuracy * 100).toFixed(1)}%
                </span>
                {state.baselineTestEval && (() => {
                  const delta =
                    (state.optimizationResult!.testEvaluation!.winAccuracy
                      - state.baselineTestEval.winAccuracy) * 100;
                  return (
                    <span className={deltaColor(delta)}>
                      {delta >= 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}pp
                    </span>
                  );
                })()}
                <span className="text-muted-foreground text-xs">
                  on {state.testDataset?.length ?? 0} unseen date{(state.testDataset?.length ?? 0) !== 1 ? 's' : ''} — the only number here the optimizer did not fit
                </span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground rounded-md border border-border/60 px-3 py-2">
                No holdout — the dataset was too small to hold dates back. Everything below
                is measured on the data that was optimized against, so treat it as a fit,
                not as accuracy.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                Train win: <span className="text-muted-foreground line-through">{(state.optimizationResult.initialEvaluation.winAccuracy * 100).toFixed(1)}%</span>
                {' → '}
                <span className="font-medium">{(state.optimizationResult.finalEvaluation.winAccuracy * 100).toFixed(1)}%</span>
              </span>
              <span>
                MRR: <span className="text-muted-foreground line-through">{state.optimizationResult.initialMAE.toFixed(3)}</span>
                {' → '}
                <span className="font-medium">{state.optimizationResult.finalMAE.toFixed(3)}</span>
              </span>
              <span>
                Top-3: <span className="font-medium">{(state.optimizationResult.finalEvaluation.topPickAccuracy * 100).toFixed(1)}%</span>
                {' · '}
                Winner Top-5: <span className="font-medium">{(state.optimizationResult.finalEvaluation.winnerTop5Accuracy * 100).toFixed(1)}%</span>
              </span>
              <span className="text-muted-foreground">
                {state.optimizationResult.improvementPct >= 0 ? '▲' : '▼'}{Math.abs(state.optimizationResult.improvementPct).toFixed(1)}% in-sample
              </span>
              <span className="text-muted-foreground text-xs">
                {state.optimizationResult.passesCompleted} passes
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadBundle}
                className="h-8 gap-1.5"
                title="Download exact calibration bundle for offline replay"
              >
                <Download className="h-3.5 w-3.5" />
                Bundle
              </Button>
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
                  const cur = currentWeights[key] ?? 0;
                  const opt = state.optimizationResult!.optimizedWeights[key] ?? 0;
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

      {/* Multi-start run summary — copyable table */}
      {state.runSummary && !isWorking && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Run Summary</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(state.runSummary!);
                setCopiedSummary(true);
                setTimeout(() => setCopiedSummary(false), 2000);
              }}
            >
              {copiedSummary ? <ClipboardCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copiedSummary ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className="text-xs font-mono bg-muted/50 rounded p-2 whitespace-pre overflow-x-auto">{state.runSummary}</pre>
        </div>
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
