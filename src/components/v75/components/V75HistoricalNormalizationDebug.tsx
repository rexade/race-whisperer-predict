import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { V75HorseResult } from '../types/raceResultTypes';
import { useXanderDebugger } from '../hooks/useXanderDebugger';

interface V75HistoricalNormalizationDebugProps {
  horse: V75HorseResult;
}

export const V75HistoricalNormalizationDebug: React.FC<V75HistoricalNormalizationDebugProps> = ({ horse }) => {
  const { debugLogs } = useXanderDebugger();
  
  // Filter logs for this specific horse's historical normalization
  const horseLogs = debugLogs.filter(log => 
    (log.horseId === horse.horseId || log.horseName.toLowerCase().includes(horse.horseName.toLowerCase()))
  );

  const historicalSteps = horseLogs.filter(log => log.stage === 'historical_normalization_step');
  const validationStats = horseLogs.find(log => log.stage === 'validation_statistics')?.data;
  const processedTimesLog = horseLogs.find(log => log.stage === 'PROCESSED_TIMES_RESULT')?.data;

  const formatKmTime = (time: any) => {
    if (!time) return 'N/A';
    if (typeof time === 'string') {
      // Handle string format like "1:15.3"
      const parts = time.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const secondsParts = parts[1].split('.');
        const seconds = parseInt(secondsParts[0]);
        const tenths = parseInt(secondsParts[1]) || 0;
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
      }
      return time;
    }
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
  };

  const calculateDistanceAdjustment = (distance: number) => {
    const reference = 2140;
    if (distance === reference) return 0;
    
    const difference = distance - reference;
    if (difference < 0) {
      // Shorter distance - horse should be faster at 2140m
      return Math.abs(difference) * 0.0012; // seconds per meter
    } else {
      // Longer distance - horse should be slower at 2140m  
      return difference * 0.001; // seconds per meter
    }
  };

  const getValidationSummary = () => {
    if (!validationStats) return null;
    
    const validationRate = (validationStats.validRecords / validationStats.totalRecords) * 100;
    
    return {
      ...validationStats,
      validationRate,
      qualityScore: validationRate >= 75 ? 'High' : validationRate >= 50 ? 'Medium' : 'Low'
    };
  };

  const validation = getValidationSummary();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <span>Historical Normalization Debug - {horse.horseName}</span>
          <Badge variant="outline">Stage 1: Raw KM Time Creation</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Validation Statistics */}
        {validation && (
          <div>
            <h4 className="font-medium text-sm mb-3">Data Validation Summary</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Records:</span>
                  <span className="font-mono">{validation.totalRecords}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valid Records:</span>
                  <span className="font-mono text-green-600">{validation.validRecords}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Disqualified:</span>
                  <span className="font-mono text-red-600">{validation.disqualified}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Galloped:</span>
                  <span className="font-mono text-orange-600">{validation.galloped}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Missing KM Times:</span>
                  <span className="font-mono">{validation.missingKmTimes}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Validation Rate:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{validation.validationRate.toFixed(1)}%</span>
                    <Badge variant={validation.qualityScore === 'High' ? 'default' : validation.qualityScore === 'Medium' ? 'secondary' : 'destructive'} className="text-xs">
                      {validation.qualityScore}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Data Quality</div>
                  <Progress value={validation.validationRate} className="h-2" />
                </div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Historical Normalization Steps */}
        <div>
          <h4 className="font-medium text-sm mb-3">Historical Race Normalization Steps</h4>
          
          {historicalSteps.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 bg-muted/20 rounded">
              No historical normalization steps captured. Run analysis to see detailed steps.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {historicalSteps.map((step, index) => {
                const data = step.data;
                const distanceAdj = calculateDistanceAdjustment(data.distance);
                const isVolte = data.startMethod?.toLowerCase().includes('volte');
                
                return (
                  <div key={index} className="p-3 border rounded-lg bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Race {index + 1}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {data.raceDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {data.place && (
                          <Badge variant="secondary" className="text-xs">
                            Place {data.place}
                          </Badge>
                        )}
                        {data.galloped && (
                          <Badge variant="destructive" className="text-xs">
                            Galloped
                          </Badge>
                        )}
                        {data.disqualified && (
                          <Badge variant="destructive" className="text-xs">
                            DQ
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-muted-foreground">Distance</div>
                        <div className="font-mono">{data.distance}m</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Start Method</div>
                        <div className="font-mono">{data.startMethod}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Original Time</div>
                        <div className="font-mono">{formatKmTime(data.originalKmTime)}</div>
                      </div>
                    </div>
                    
                    {/* Normalization breakdown */}
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Distance Adjustment:</span>
                          <span className="font-mono">{distanceAdj > 0 ? '+' : ''}{distanceAdj.toFixed(3)}s</span>
                        </div>
                        {isVolte && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Volte Start Penalty:</span>
                            <span className="font-mono">-1.000s</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>Normalized to 2140m:</span>
                          <span className="font-mono text-primary">{formatKmTime(data.normalizedKmTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Best 3 Average Calculation */}
        {processedTimesLog && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Best 3 Average Calculation</h4>
              <div className="p-3 bg-primary/5 rounded border">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Valid Times:</span>
                    <span className="font-mono">{processedTimesLog.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Times Used for Average:</span>
                    <span className="font-mono">{Math.min(3, processedTimesLog.length || 0)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Raw KM Time (Best 3 Avg):</span>
                    <span className="font-mono text-primary">{formatKmTime(horse.rawKmTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
};