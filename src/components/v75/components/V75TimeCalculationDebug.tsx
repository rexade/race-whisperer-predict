import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

import { V75HorseResult } from '../types/raceResultTypes';
import { useXanderDebugger } from '../hooks/useXanderDebugger';
import V75RaceHistoryBreakdown from './V75RaceHistoryBreakdown';

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

  const formatKmTime = (time: any) => {
    if (!time) return 'N/A';
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
  };

  const getTimeCalculationData = () => {
    const historicalDataLog = horseLogs.find(log => log.stage === 'HISTORICAL_DATA_RECEIVED');

    // Get detailed processed times for breakdown
    const processedTimesDetailLog = horseLogs.find(log => 
      log.stage === 'PROCESSED_TIMES' && log.data?.processedTimes
    );
    const historicalRaces = processedTimesDetailLog?.data?.processedTimes || [];
    const best3Average = processedTimesDetailLog?.data?.best3Average || horse.rawKmTime;

    return {
      historicalRecords: historicalDataLog?.data?.length || 0,
      processedTimes: historicalRaces,
      historicalRaces,
      best3Average,
      rawKmTime: horse.rawKmTime,
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
            <span>Time Calculation Debug - {horse.horseName}</span>
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
              {/* Raw KM Time */}
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded">
                <span className="text-sm text-muted-foreground">Raw KM Time (Best 3 Avg):</span>
                <Badge variant="secondary" className="font-mono">
                  {formatKmTime(data.rawKmTime)}
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
                    <div className="text-xs text-muted-foreground mb-2">All Normalization Adjustments:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[11px] sm:text-xs">
                      <div>Post Position: {data.adjustments.postPosition?.toFixed(2)}s</div>
                      <div>Equipment: {data.adjustments.equipment?.toFixed(2)}s</div>
                      <div>Driver: {data.adjustments.driver?.toFixed(2)}s</div>
                      <div>Track: {data.adjustments.track?.toFixed(2)}s</div>
                      <div>Form: {data.adjustments.form?.toFixed(2)}s</div>
                      <div>Distance: {data.adjustments.distance?.toFixed(2)}s</div>
                      <div>Race Distance: {data.adjustments.raceDistanceAdjustment?.toFixed(2)}s</div>
                      <div>Race Type: {data.adjustments.raceType?.toFixed(2)}s</div>
                      <div>Time of Day: {data.adjustments.timeOfDay?.toFixed(2)}s</div>
                      <div>Volte Start Penalty: {data.adjustments.volteStartDistancePenalty?.toFixed(2)}s</div>
                      <div>Start Points: {data.adjustments.startPoints?.toFixed(2)}s</div>
                      <div>Place %: {data.adjustments.placePercentage?.toFixed(2)}s</div>
                      <div>Horse Win %: {data.adjustments.horseWinPercentage?.toFixed(2)}s</div>
                      <div>Earnings/Start: {data.adjustments.earningsPerStart?.toFixed(2)}s</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="text-xs font-medium">
                        Total Adjustment: {data.adjustments.total?.toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Final Predicted Time */}
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded border border-primary/20">
                <span className="text-sm font-medium">Final Predicted Time:</span>
                <Badge className="font-mono">
                  {formatKmTime(data.modernNormalizedTime)}
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
                  best3Average={data.best3Average}
                />
              </div>
            </>
          )}

        </div>
        
      </CardContent>
    </Card>
  );
};