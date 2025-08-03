import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { V75HorseResult } from '../types/raceResultTypes';
import { useXanderDebugger } from '../hooks/useXanderDebugger';

interface V75ModernNormalizationDebugProps {
  horse: V75HorseResult;
}

export const V75ModernNormalizationDebug: React.FC<V75ModernNormalizationDebugProps> = ({ horse }) => {
  const { debugLogs } = useXanderDebugger();
  
  // Filter logs for this specific horse
  const horseLogs = debugLogs.filter(log => 
    (log.horseId === horse.horseId || log.horseName.toLowerCase().includes(horse.horseName.toLowerCase()))
  );

  const modernNormalizationLog = horseLogs.find(log => log.stage === 'modern_normalization_breakdown');
  const equipmentLog = horseLogs.find(log => log.stage === 'equipment_validation');

  const formatKmTime = (time: any) => {
    if (!time) return 'N/A';
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
  };

  const getAdjustmentColor = (value: number) => {
    if (Math.abs(value) < 0.1) return 'text-muted-foreground';
    return value > 0 ? 'text-red-600' : 'text-green-600';
  };

  const getImpactLevel = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1.0) return 'High';
    if (abs >= 0.5) return 'Medium';
    if (abs >= 0.1) return 'Low';
    return 'Minimal';
  };

  const adjustments = horse.modernNormalizedResult?.adjustments;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <span>Modern Normalization Debug - {horse.horseName}</span>
          <Badge variant="outline">Stage 2: Final Prediction</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Equipment Validation */}
        {equipmentLog && (
          <div>
            <h4 className="font-medium text-sm mb-3">Equipment Data Validation</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-2 border rounded">
                <div className="text-xs text-muted-foreground">Sulky Type</div>
                <div className="font-mono text-sm">{equipmentLog.data.sulkyType || 'N/A'}</div>
                {equipmentLog.data.hasCorruption && (
                  <Badge variant="destructive" className="text-xs mt-1">Corruption Detected</Badge>
                )}
              </div>
              <div className="p-2 border rounded">
                <div className="text-xs text-muted-foreground">Front Shoes</div>
                <div className="font-mono text-sm">{equipmentLog.data.frontShoes || 'N/A'}</div>
              </div>
              <div className="p-2 border rounded">
                <div className="text-xs text-muted-foreground">Back Shoes</div>
                <div className="font-mono text-sm">{equipmentLog.data.backShoes || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Normalization Flow */}
        <div>
          <h4 className="font-medium text-sm mb-3">Modern Normalization Flow</h4>
          
          {/* Starting Point */}
          <div className="p-3 bg-secondary/20 rounded mb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Starting Point (Raw KM Time):</span>
              <span className="font-mono text-lg">{formatKmTime(horse.rawKmTime)}</span>
            </div>
          </div>

          {/* Adjustments Breakdown */}
          {adjustments && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium">Adjustment Factors:</h5>
              
              {/* Performance Factors */}
              <div className="p-3 border rounded">
                <div className="text-xs font-medium text-muted-foreground mb-2">PERFORMANCE FACTORS</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span>Post Position:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.postPosition)}`}>
                        {adjustments.postPosition > 0 ? '+' : ''}{adjustments.postPosition?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.postPosition)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver Performance:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.driver)}`}>
                        {adjustments.driver > 0 ? '+' : ''}{adjustments.driver?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.driver)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Horse Form:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.form)}`}>
                        {adjustments.form > 0 ? '+' : ''}{adjustments.form?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.form)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Track Familiarity:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.track)}`}>
                        {adjustments.track > 0 ? '+' : ''}{adjustments.track?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.track)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Factors */}
              <div className="p-3 border rounded">
                <div className="text-xs font-medium text-muted-foreground mb-2">EQUIPMENT FACTORS</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span>Equipment Total:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.equipment)}`}>
                        {adjustments.equipment > 0 ? '+' : ''}{adjustments.equipment?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.equipment)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Race Context Factors */}
              <div className="p-3 border rounded">
                <div className="text-xs font-medium text-muted-foreground mb-2">RACE CONTEXT FACTORS</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span>Distance Adjustment:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.distance)}`}>
                        {adjustments.distance > 0 ? '+' : ''}{adjustments.distance?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.distance)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Race Distance:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.raceDistanceAdjustment)}`}>
                        {adjustments.raceDistanceAdjustment > 0 ? '+' : ''}{adjustments.raceDistanceAdjustment?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.raceDistanceAdjustment)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Race Type:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.raceType)}`}>
                        {adjustments.raceType > 0 ? '+' : ''}{adjustments.raceType?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.raceType)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Time of Day:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.timeOfDay)}`}>
                        {adjustments.timeOfDay > 0 ? '+' : ''}{adjustments.timeOfDay?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.timeOfDay)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistical Factors */}
              <div className="p-3 border rounded">
                <div className="text-xs font-medium text-muted-foreground mb-2">STATISTICAL FACTORS</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span>Start Points:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.startPoints)}`}>
                        {adjustments.startPoints > 0 ? '+' : ''}{adjustments.startPoints?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.startPoints)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Place Percentage:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.placePercentage)}`}>
                        {adjustments.placePercentage > 0 ? '+' : ''}{adjustments.placePercentage?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.placePercentage)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Horse Win %:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.horseWinPercentage)}`}>
                        {adjustments.horseWinPercentage > 0 ? '+' : ''}{adjustments.horseWinPercentage?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.horseWinPercentage)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Earnings/Start:</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${getAdjustmentColor(adjustments.earningsPerStart)}`}>
                        {adjustments.earningsPerStart > 0 ? '+' : ''}{adjustments.earningsPerStart?.toFixed(3)}s
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getImpactLevel(adjustments.earningsPerStart)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Impact */}
              <div className="p-3 bg-primary/10 rounded border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Adjustment:</span>
                  <span className={`font-mono text-lg ${getAdjustmentColor(adjustments.total)}`}>
                    {adjustments.total > 0 ? '+' : ''}{adjustments.total?.toFixed(3)}s
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Impact Distribution</div>
                  <Progress 
                    value={Math.min(100, Math.abs(adjustments.total) * 20)} 
                    className="h-2" 
                  />
                </div>
              </div>

              {/* Final Result */}
              <div className="p-3 bg-primary/20 rounded border border-primary">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-lg">Final Predicted Time:</span>
                  <span className="font-mono text-xl text-primary font-bold">
                    {formatKmTime(horse.modernNormalizedResult?.modernNormalizedTime)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
};