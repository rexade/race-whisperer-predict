import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { V75RaceResult } from '../hooks/useV75Analysis';
import CompactHorseRow from './CompactHorseRow';
import { sortByPrediction, winnerMargin as calcWinnerMargin, valuePickIds } from '../utils/raceRanking';

interface CompactV75ResultsTableProps {
  race: V75RaceResult;
}

const CompactV75ResultsTable: React.FC<CompactV75ResultsTableProps> = ({ race }) => {
  const sortedHorses = sortByPrediction(race.horses);
  const horsesWithoutTimes = race.horses.filter(horse => !horse.modernNormalizedResult);

  // Calculate data quality
  const totalHorses = race.horses.length;
  const analyzedHorses = sortedHorses.length;
  const qualityPercentage = totalHorses > 0 ? Math.round((analyzedHorses / totalHorses) * 100) : 0;

  // Winner margin (confidence signal) + market-vs-model value picks
  const winnerMargin = calcWinnerMargin(sortedHorses);
  const valuePicks = valuePickIds(sortedHorses);

  const startMethodLabel = race.startMethod?.toLowerCase() === 'volte' ? 'VOLTSTART' : 'AUTOSTART';

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-2 py-1 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-0.5">
          <div className="eyebrow">
            {race.distance} M · {startMethodLabel} · {race.track}
          </div>
          <CardTitle className="text-foreground font-display text-lg sm:text-xl flex items-center gap-2 min-w-0">
            Lopp {race.raceNumber}
            <span className="hidden sm:inline text-base font-normal text-muted-foreground truncate">— {race.name}</span>
            {qualityPercentage < 80 && (
              <Badge variant="destructive" className="text-xs font-sans">
                {qualityPercentage}% analyzed
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="space-y-1">
          {sortedHorses.map((horse, index) => (
            <CompactHorseRow
              key={horse.horseId}
              horse={horse}
              rank={index + 1}
              marginToNext={index === 0 ? winnerMargin : undefined}
              isValuePick={valuePicks.has(horse.horseId)}
            />
          ))}
          
          {horsesWithoutTimes.map(horse => (
            <div 
              key={horse.horseId}
              className="p-2 sm:p-3 bg-muted/50 sm:border-l-4 sm:border-l-muted-foreground/30"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {horse.postPosition}
                </Badge>
                <span className="font-medium text-sm">{horse.horseName}</span>
                <span className="text-xs text-muted-foreground">Insufficient data</span>
              </div>
            </div>
          ))}
        </div>
        
        {horsesWithoutTimes.length > 0 && (
          <div className="p-2 sm:p-3 bg-muted/30 sm:border-t">
            <p className="text-xs text-muted-foreground">
              {horsesWithoutTimes.length} horse(s) could not be analyzed due to insufficient historical data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactV75ResultsTable;