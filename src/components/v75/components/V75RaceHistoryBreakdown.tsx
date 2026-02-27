import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Trophy, Calendar, Ruler } from "lucide-react";
import { ProcessedKmTime } from '../../../services/types/kmTimeTypes';
import { formatKmTime } from '../utils/v75DisplayUtils';

interface V75RaceHistoryBreakdownProps {
  horseName: string;
  historicalRaces: ProcessedKmTime[];
  bestTime: { minutes: number; seconds: number; tenths: number };
}

const V75RaceHistoryBreakdown: React.FC<V75RaceHistoryBreakdownProps> = ({
  horseName,
  historicalRaces,
  bestTime
}) => {
  // Best time only (already sorted by normalized time in processing; we use single best, ≤5 months)
  const bestTimes = historicalRaces.slice(0, 1);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-primary">
          <Clock className="h-4 w-4" />
          Raw KM Time Calculation for {horseName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground">Calculation Summary</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Historical Races:</span>
                <Badge variant="outline" className="text-xs">{historicalRaces.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Best time used:</span>
                <Badge variant="outline" className="text-xs">{bestTimes.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Best time:</span>
                <Badge className="bg-primary text-primary-foreground text-xs font-mono">
                  {formatKmTime(bestTime)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Best time */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground">Best Time Used (≤5 months)</h4>
            {bestTimes.length > 0 && bestTime && (() => {
              const fromRace = bestTimes[0].normalizedTime;
              const differs = fromRace.minutes !== bestTime.minutes || fromRace.seconds !== bestTime.seconds || (fromRace.tenths ?? 0) !== (bestTime.tenths ?? 0);
              if (differs) {
                return (
                  <p className="text-[11px] text-warning italic">
                    Time below is from history; value used for ranking is after confidence adjustment (see above).
                  </p>
                );
              }
              return null;
            })()}
            <div className="space-y-2">
              {bestTimes.map((time, index) => (
                <div
                  key={`${time.raceDate}-${index}`}
                  className="flex items-center justify-between p-2 bg-card rounded border border-border"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${index === 0 ? 'bg-warning' :
                      index === 1 ? 'bg-muted-foreground' :
                        'bg-warning/70'
                      } text-white`}>
                      {index + 1}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {time.raceDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Ruler className="h-3 w-3" />
                      {time.distance}m
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {time.startMethod}
                    </Badge>
                    <span className="font-mono text-sm font-semibold text-primary">
                      {formatKmTime(time.normalizedTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed History (if more than 3 races) */}
        {historicalRaces.length > 3 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground">
              All Historical Races ({historicalRaces.length})
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {historicalRaces.map((time, index) => (
                <div
                  key={`${time.raceDate}-${index}`}
                  className={`flex items-center justify-between p-1 text-xs rounded ${index < 3 ? 'bg-primary/10 border border-primary/20' : 'bg-muted'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{time.raceDate}</span>
                    <span className="text-muted-foreground/70">{time.distance}m {time.startMethod}</span>
                    {time.finishOrder && (
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-warning" />
                        <span className="text-warning">#{time.finishOrder}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {formatKmTime(time.originalTime)}
                    </span>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="font-mono font-semibold">
                      {formatKmTime(time.normalizedTime)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground italic">
          * Times are normalized to 2140m equivalent for fair comparison
        </div>
      </CardContent>
    </Card>
  );
};

export default V75RaceHistoryBreakdown;