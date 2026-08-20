import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';
import CompactV75ResultsTable from './components/CompactV75ResultsTable';

interface V75RaceDetailsProps {
  race: V75RaceResult;
  legNumber: number;
}

const V75RaceDetails: React.FC<V75RaceDetailsProps> = ({ race, legNumber }) => {
  if (!race.analysisComplete) {
    return (
      <Card className="border-destructive bg-gradient-card shadow-md">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 font-secondary">
            <Trophy className="h-5 w-5" />
            Race {legNumber} - Analysis Failed
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
      <CompactV75ResultsTable race={race} legNumber={legNumber} />
    </div>
  );
};

export default V75RaceDetails;
