
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';
import V75RaceHeader from './components/V75RaceHeader';
import CompactV75ResultsTable from './components/CompactV75ResultsTable';
import { useKmtidByHorse } from './hooks/useKmtidByHorse';

interface V75RaceDetailsProps {
  race: V75RaceResult;
  analysisDate: string;
}

const V75RaceDetails: React.FC<V75RaceDetailsProps> = ({ race, analysisDate }) => {
  const horses = race.horses.map((h) => ({
    horseId: h.horseId,
    horseName: typeof h.horseName === 'string' ? h.horseName : String(h.horseName ?? ''),
  }));
  const { kmtidByHorse } = useKmtidByHorse(analysisDate, horses);

  if (!race.analysisComplete) {
    return (
      <Card className="border-destructive bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 font-secondary">
            <Trophy className="h-5 w-5" />
            Race {race.raceNumber} - Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Unable to analyze this race. This could be due to missing data or API issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Results Table with integrated race info and historical kmtid (2w) column */}
      <CompactV75ResultsTable race={race} kmtidByHorse={kmtidByHorse} />
    </div>
  );
};

export default V75RaceDetails;
