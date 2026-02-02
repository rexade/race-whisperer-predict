import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { V75RaceResult } from '../hooks/useV75Analysis';
import CompactHorseRow from './CompactHorseRow';

interface CompactV75ResultsTableProps {
  race: V75RaceResult;
}

const CompactV75ResultsTable: React.FC<CompactV75ResultsTableProps> = ({ race }) => {
  // Sort horses by normalized time (fastest first)
  const sortedHorses = race.horses
    .filter(horse => horse.modernNormalizedResult)
    .sort((a, b) => {
      const timeA = a.modernNormalizedResult!.modernNormalizedTime;
      const timeB = b.modernNormalizedResult!.modernNormalizedTime;
      
      const totalSecondsA = timeA.minutes * 60 + timeA.seconds + timeA.tenths / 10;
      const totalSecondsB = timeB.minutes * 60 + timeB.seconds + timeB.tenths / 10;
      
      return totalSecondsA - totalSecondsB;
    });

  const horsesWithoutTimes = race.horses.filter(horse => !horse.modernNormalizedResult);

  // Calculate data quality
  const totalHorses = race.horses.length;
  const analyzedHorses = sortedHorses.length;
  const qualityPercentage = totalHorses > 0 ? Math.round((analyzedHorses / totalHorses) * 100) : 0;

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-2 py-1 sm:px-4 sm:py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-foreground font-secondary text-base sm:text-lg flex items-center gap-2">
            Race {race.raceNumber} <span className="hidden sm:inline">- {race.name}</span>
            {qualityPercentage < 80 && (
              <Badge variant="destructive" className="text-xs">
                {qualityPercentage}% analyzed
              </Badge>
            )}
          </CardTitle>
          <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span>{race.track}</span>
            <span>•</span>
            <span>{race.distance}m</span>
            <span>•</span>
            <span>{race.startMethod}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="space-y-1">
          {sortedHorses.map((horse, index) => (
            <CompactHorseRow
              key={horse.horseId}
              horse={horse}
              rank={index + 1}
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