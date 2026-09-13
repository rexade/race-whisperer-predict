import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { V75RaceResult } from '../hooks/useV75Analysis';
import CompactHorseRow from './CompactHorseRow';
import { sortByPrediction, winnerMargin as calcWinnerMargin, valuePickKeys, rankingScoreSeconds } from '../utils/raceRanking';
import { horseResultKey } from '../utils/horseResultIdentity';

interface CompactV75ResultsTableProps {
  race: V75RaceResult;
  legNumber: number;
  /** Horses to cover in this leg, decided across the whole card. */
  cover?: number;
}

/**
 * What to actually do with this leg, not a verdict on how it feels.
 *
 * The old spik/favorit/oppet labels were measured on a 604-race holdout and
 * were wrong in both directions: "spik" fired on 67% of all legs and was right
 * 43.5% of the time, and "favorit" (27.0%) performed WORSE than "oppet"
 * (34.1%). A coverage count is decided across the whole card against a real row
 * budget, so it says something a single leg cannot.
 */
const coverLabel = (n: number) => (n === 1 ? 'SPIKA' : `TA ${n}`);


const CompactV75ResultsTable: React.FC<CompactV75ResultsTableProps> = ({ race, legNumber, cover }) => {
  const sortedHorses = sortByPrediction(race.horses);
  const horsesWithoutTimes = race.horses.filter(horse => !horse.modernNormalizedResult);

  // Calculate data quality
  const totalHorses = race.horses.length;
  const analyzedHorses = sortedHorses.length;
  const qualityPercentage = totalHorses > 0 ? Math.round((analyzedHorses / totalHorses) * 100) : 0;

  // Winner margin (confidence signal) + market-vs-model value picks
  const winnerMargin = calcWinnerMargin(sortedHorses);
  const valuePicks = valuePickKeys(sortedHorses);

  // Computed once per race and passed down: every row's bar is scaled against
  // the same field, so the bars are comparable within the leg and meaningless
  // across legs — which is the point.
  const fieldSeconds = sortedHorses.map(rankingScoreSeconds);


  // Handicap front line: the shortest distance anyone in this leg actually runs.
  // Every horse's tillägg is the gap to it, which is 0 across the board in an
  // ordinary race — so the row can decide for itself whether to show anything.
  const runDistances = race.horses.map(h => h.distance).filter(Number.isFinite);
  const frontLineDistance = runDistances.length ? Math.min(...runDistances) : undefined;

  const startMethodLabel = race.startMethod?.toLowerCase() === 'volte' ? 'VOLTSTART' : 'AUTOSTART';

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-2 py-1 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-0.5">
          <div className="eyebrow flex items-center gap-2 flex-wrap">
            <span>{race.distance} M · {startMethodLabel} · {race.track}</span>
            {/* How many horses to cover here, allocated across the whole card
                against the row budget. Not a per-leg opinion: going one deeper
                in this leg is paid for by going shallower in another. */}
            {cover !== undefined && (
              <span className={`font-bold ${cover === 1 ? 'text-success' : cover <= 3 ? 'text-warning' : 'text-primary'}`}>
                {coverLabel(cover)}
              </span>
            )}
            {winnerMargin !== undefined && (
              <span className="text-muted-foreground">
                marginal +{winnerMargin.toFixed(1).replace('.', ',')}s
              </span>
            )}
          </div>
          <CardTitle className="text-foreground font-display text-lg sm:text-xl flex items-center gap-2 min-w-0">
            Lopp {legNumber}
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
              key={horseResultKey(horse)}
              horse={horse}
              rank={index + 1}
              fieldSeconds={fieldSeconds}
              marginToNext={index === 0 ? winnerMargin : undefined}
              isValuePick={valuePicks.has(horseResultKey(horse))}
              frontLineDistance={frontLineDistance}
            />
          ))}
          
          {horsesWithoutTimes.map(horse => (
            <div 
              key={horseResultKey(horse)}
              className="p-2 sm:p-3 bg-muted/50 sm:border-l-4 sm:border-l-muted-foreground/30"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {horse.startNumber ?? horse.postPosition}
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
