
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';
import { formatKmTime, ensureStringForDisplay } from './utils/v75DisplayUtils';

interface V75RaceOverviewProps {
  races: V75RaceResult[];
}

const V75RaceOverview: React.FC<V75RaceOverviewProps> = ({ races }) => {
  const allHorsesFlat = races.flatMap(race => race.horses);
  const fallbackCount = allHorsesFlat.filter(h => h.timeSource && h.timeSource !== "normalized").length;

  const getTopNormalizedTimes = () => {
    return races
      .flatMap(race => race.horses.filter(horse => horse.modernNormalizedResult))
      .sort((a, b) => {
        const timeA = a.modernNormalizedResult!.modernNormalizedTime;
        const timeB = b.modernNormalizedResult!.modernNormalizedTime;
        const totalSecondsA = timeA.minutes * 60 + timeA.seconds + timeA.tenths / 10;
        const totalSecondsB = timeB.minutes * 60 + timeB.seconds + timeB.tenths / 10;
        return totalSecondsA - totalSecondsB;
      })
      .slice(0, 10);
  };

  const topTimes = getTopNormalizedTimes();

  const totalHorses = races.reduce((total, race) => total + race.horses.length, 0);
  const horsesWithEarnings = allHorsesFlat.filter(h => h.statistics?.earningsPerStart > 0).length;
  const horsesWithStartPoints = allHorsesFlat.filter(h => h.statistics?.startPoints > 0).length;
  const dataQuality = totalHorses > 0 ? Math.round((horsesWithEarnings / totalHorses) * 100) : 0;

  const rankCircleClass = (index: number) => {
    if (index === 0) return 'bg-warning text-warning-foreground';
    if (index === 1) return 'bg-muted-foreground text-background';
    if (index === 2) return 'bg-warning/70 text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Time legend */}
      {fallbackCount > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">Time Legend:</span>
              <span className="text-foreground/80">
                <span className="font-mono">≈</span> indicates a fallback time (best raw/derived) which may be less reliable than normalized predictions
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Races</p>
                <p className="text-2xl font-bold">{races.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Tracks</p>
                <p className="text-2xl font-bold">
                  {new Set(races.map(r => ensureStringForDisplay(r.track))).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Total Horses</p>
                <p className="text-2xl font-bold">{totalHorses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Total Prize</p>
                <p className="text-lg font-bold">
                  {(races.reduce((total, race) => total + race.prize, 0) / 1000000).toFixed(1)}M SEK
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Data Quality</p>
                <p className="text-2xl font-bold">{dataQuality}%</p>
                <p className="text-xs text-muted-foreground">{horsesWithEarnings}/{totalHorses} with earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Alert */}
      {dataQuality < 80 && (
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-warning">Data Quality Notice</p>
                <p className="text-sm text-foreground/80">
                  {horsesWithStartPoints} horses have start points, {horsesWithEarnings} have earnings data.
                  Some statistics may be incomplete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Race Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(race => {
          const safeName = ensureStringForDisplay(race.name);
          const safeTrack = ensureStringForDisplay(race.track);
          const safeStartMethod = ensureStringForDisplay(race.startMethod);

          const raceDataQuality = race.horses.length > 0
            ? Math.round((race.horses.filter(h => h.statistics?.earningsPerStart > 0 || h.statistics?.startPoints > 0).length / race.horses.length) * 100)
            : 0;

          return (
            <Card key={race.raceNumber} className={`border-l-4 ${race.analysisComplete ? 'border-l-success' : 'border-l-destructive'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Race {race.raceNumber}</span>
                  <Badge variant={race.analysisComplete ? "default" : "destructive"}>
                    {race.analysisComplete ? "Complete" : "Failed"}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{safeName}</p>
              </CardHeader>

              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Track:</strong> {safeTrack}</div>
                  <div><strong>Distance:</strong> {race.distance}m</div>
                  <div><strong>Start:</strong> {safeStartMethod}</div>
                  <div><strong>Horses:</strong> {race.horses.length}</div>
                </div>

                {race.analysisComplete && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Analyzed Horses:</p>
                    <p className="text-sm font-medium">
                      {race.horses.filter(h => h.rawKmTime).length}/{race.horses.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Data Quality: {raceDataQuality}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Normalized Times */}
      {topTimes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Top 10 Normalized Times (All Races)
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {topTimes.map((horse, index) => {
                const safeHorseName = ensureStringForDisplay(horse.horseName);
                const safeDriverName = ensureStringForDisplay(horse.driverName);

                return (
                  <div key={`${horse.raceId}-${horse.horseId}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${rankCircleClass(index)}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{safeHorseName}</p>
                        <p className="text-sm text-muted-foreground">
                          Race {horse.raceNumber} • {safeDriverName} • Post {horse.postPosition}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        {formatKmTime(horse.modernNormalizedResult!.modernNormalizedTime)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Raw: {formatKmTime(horse.modernNormalizedResult!.rawTime)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75RaceOverview;
