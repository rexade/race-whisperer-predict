
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';
import V75RaceHeader from './components/V75RaceHeader';
import V75DataQuality from './components/V75DataQuality';
import V75ResultsTable from './components/V75ResultsTable';

interface V75RaceDetailsProps {
  race: V75RaceResult;
}

const V75RaceDetails: React.FC<V75RaceDetailsProps> = ({ race }) => {
  console.log('🎯 V75RaceDetails - Rendering race:', race.raceNumber, 'with', race.horses.length, 'horses');
  
  // ENHANCED DEBUG: Check all horse names and statistics before rendering
  race.horses.forEach((horse, index) => {
    console.log(`🐎 V75RaceDetails - Horse ${index}: ID=${horse.horseId}, Name=`, JSON.stringify(horse.horseName), 'Type:', typeof horse.horseName);
    console.log(`💰 V75RaceDetails - Horse ${index} ENHANCED statistics DEBUG:`, {
      statistics: horse.statistics,
      statisticsType: typeof horse.statistics,
      startPoints: horse.statistics?.startPoints,
      startPointsType: typeof horse.statistics?.startPoints,
      placePercentage: horse.statistics?.placePercentage,
      placePercentageType: typeof horse.statistics?.placePercentage,
      winPercentage: horse.statistics?.winPercentage,
      winPercentageType: typeof horse.statistics?.winPercentage,
      earningsPerStart: horse.statistics?.earningsPerStart,
      earningsPerStartType: typeof horse.statistics?.earningsPerStart,
      driver2025WinPercentage: horse.driver2025WinPercentage,
      driver2025WinPercentageType: typeof horse.driver2025WinPercentage,
      hasValidData: (horse.statistics?.earningsPerStart > 0) || (horse.statistics?.startPoints > 0)
    });
  });

  if (!race.analysisComplete) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Race {race.raceNumber} - Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Unable to analyze this race. This could be due to missing data or API issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Race Info */}
      <V75RaceHeader race={race} />

      {/* Add Data Quality to Race Header */}
      <Card>
        <CardContent className="pt-6">
          <V75DataQuality race={race} />
        </CardContent>
      </Card>

      {/* Enhanced Results Table */}
      <V75ResultsTable race={race} />
    </div>
  );
};

export default V75RaceDetails;
