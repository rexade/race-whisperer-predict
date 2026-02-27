import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

import { V75HorseResult } from '../types/raceResultTypes';
import { useXanderDebugger } from '../hooks/useXanderDebugger';
import V75RaceHistoryBreakdown from './V75RaceHistoryBreakdown';
import { formatKmTime } from '../utils/v75DisplayUtils';

interface V75TimeCalculationDebugProps {
  horse: V75HorseResult;
}

export const V75TimeCalculationDebug: React.FC<V75TimeCalculationDebugProps> = ({ horse }) => {
  const { getLiveDebugLogs, exportDebugReport, clearLogs } = useXanderDebugger();
  // Get live debug logs for this specific horse
  const horseLogs = getLiveDebugLogs().filter(log =>
    log.horseId === horse.horseId ||
    log.horseName.toLowerCase().includes(horse.horseName.toLowerCase())
  );

  const getTimeCalculationData = () => {
    const historicalDataLog = horseLogs.find(log => log.stage === 'HISTORICAL_DATA_RECEIVED');

    // Get detailed processed times for breakdown (single best time, ≤5 months)
    const processedTimesDetailLog = horseLogs.find(log =>
      log.stage === 'PROCESSED_TIMES' && log.data?.processedTimes
    );
    const historicalRaces = processedTimesDetailLog?.data?.processedTimes || [];
    // Value actually used for ranking and normalization (may include confidence penalty)
    const rawKmTimeUsed = horse.rawKmTime;
    // Best from history before any confidence adjustment (from log)
    const bestFromHistory = historicalRaces[0]?.normalizedTime ?? processedTimesDetailLog?.data?.bestTime;

    return {
      historicalRecords: historicalDataLog?.data?.length || 0,
      processedTimes: historicalRaces,
      historicalRaces,
      bestTime: rawKmTimeUsed, // Changed from best3Average
      rawKmTime: rawKmTimeUsed,
      bestFromHistory,
      modernNormalizedTime: horse.modernNormalizedResult?.modernNormalizedTime,
      adjustments: horse.modernNormalizedResult?.adjustments
    };
  };

  const data = getTimeCalculationData();

  return (
    <Card className="mt-2 sm:mt-3">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Normalization Breakdown — {horse.horseName}</span>
            <Badge variant="outline">ID: {horse.horseId}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="text-[11px] sm:text-xs"
            >
              Clear Logs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDebugReport}
              className="text-[11px] sm:text-xs"
            >
              Export
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="space-y-3 sm:space-y-4 mt-0">
          {/* Raw Data Summary */}
          <div>
            <h4 className="font-medium text-sm mb-2">Data Processing Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-muted-foreground">Historical Records:</span>
                <div className="font-mono">{data.historicalRecords}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Valid Times Used:</span>
                <div className="font-mono">{data.processedTimes.length || 'N/A'}</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Time Calculation Flow */}
          <div>
            <h4 className="font-medium text-sm mb-2">Time Calculation Flow</h4>
            <div className="space-y-3">
              {/* Best from history vs used: show when confidence adjustment was applied */}
              {data.bestFromHistory && data.rawKmTime && (() => {
                const same = data.bestFromHistory.minutes === data.rawKmTime.minutes
                  && data.bestFromHistory.seconds === data.rawKmTime.seconds
                  && (data.bestFromHistory.tenths ?? 0) === (data.rawKmTime.tenths ?? 0);
                if (!same) {
                  return (
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-warning/10 dark:bg-warning/20 rounded border border-warning/30">
                      <span className="text-xs text-muted-foreground">Best from history:</span>
                      <Badge variant="outline" className="font-mono tabular-nums text-xs">{formatKmTime(data.bestFromHistory)}</Badge>
                      <span className="text-xs text-muted-foreground">→ After confidence (used):</span>
                      <Badge variant="secondary" className="font-mono tabular-nums text-xs">{formatKmTime(data.rawKmTime)}</Badge>
                      <span className="text-[11px] text-muted-foreground italic">(statistics-sourced data)</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Raw KM Time: value actually used for normalization and ranking */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <span className="text-sm text-muted-foreground">Raw KM Time (used):</span>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {data.rawKmTime ? formatKmTime(data.rawKmTime) : '—'}
                </Badge>
              </div>

              {/* Normalization Arrow */}
              {data.adjustments && (
                <>
                  <div className="flex justify-center">
                    <div className="text-xs text-muted-foreground">↓ Normalization Applied ↓</div>
                  </div>

                  {/* Adjustments */}
                  <div className="p-3 bg-primary/5 rounded border">
                    <div className="text-xs text-muted-foreground mb-2">
                      All Normalization Adjustments
                      <span className="ml-2 text-[10px]">
                        (<span className="text-success">green</span> = faster, <span className="text-destructive">red</span> = slower)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] sm:text-xs">
                      {(
                        [
                          ['Post Position',      data.adjustments.postPosition],
                          ['Equipment',          data.adjustments.equipment],
                          ['Driver',             data.adjustments.driver],
                          ['Track',              data.adjustments.track],
                          ['Form',               data.adjustments.form],
                          ['Distance',           data.adjustments.distance],
                          ['Race Distance',      data.adjustments.raceDistanceAdjustment],
                          ['Volte Start',        data.adjustments.volteStartDistancePenalty],
                          ['Start Points',       data.adjustments.startPoints],
                          ['Place %',            data.adjustments.placePercentage],
                          ['Horse Win %',        data.adjustments.horseWinPercentage],
                          ['Earnings/Start',     data.adjustments.earningsPerStart],
                        ] as [string, number | undefined][]
                      ).map(([label, val]) => {
                        const v = val ?? 0;
                        const color = v < -0.005 ? 'text-success' : v > 0.005 ? 'text-destructive' : 'text-muted-foreground';
                        const sign = v > 0.005 ? '+' : '';
                        return (
                          <div key={label} className="flex justify-between gap-1">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-mono tabular-nums font-medium ${color}`}>
                              {sign}{v.toFixed(2)}s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Total Adjustment</span>
                        <span className={`font-mono tabular-nums ${
                          (data.adjustments.total ?? 0) < -0.005 ? 'text-success'
                          : (data.adjustments.total ?? 0) > 0.005 ? 'text-destructive'
                          : 'text-muted-foreground'
                        }`}>
                          {(data.adjustments.total ?? 0) > 0.005 ? '+' : ''}{data.adjustments.total?.toFixed(2)}s
                        </span>
                      </div>
                      {data.rawKmTime && data.modernNormalizedTime && (
                        <div className="text-[11px] text-muted-foreground">
                          Raw + Adjustment → Final (same value used for ranking)
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Final Predicted Time */}
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded border border-primary/20">
                <span className="text-sm font-medium">Final Predicted Time:</span>
                <Badge className="font-mono tabular-nums">
                  {data.modernNormalizedTime ? formatKmTime(data.modernNormalizedTime) : '—'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Historical Race Breakdown */}
          {data.historicalRaces.length > 0 && (
            <>
              <Separator />
              <div>
                <V75RaceHistoryBreakdown
                  horseName={horse.horseName}
                  historicalRaces={data.historicalRaces}
                  bestTime={data.bestTime}
                />
              </div>
            </>
          )}

        </div>

      </CardContent>
    </Card>
  );
};