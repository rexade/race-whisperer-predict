
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import V75RaceDetails from "../V75RaceDetails";
import V75RaceOverview from "../V75RaceOverview";
import { V75RaceResult } from "../hooks/useV75Analysis";
import DebugErrorBoundary from "../../DebugErrorBoundary";

interface V75ResultsProps {
  races: V75RaceResult[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const V75Results: React.FC<V75ResultsProps> = ({
  races,
  activeTab,
  onTabChange
}) => {
  if (races.length === 0) return null;

  return (
    <DebugErrorBoundary>
      <Card className="border-purple-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            V75 Race Results
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="overview">
                Overview
              </TabsTrigger>
              {races.map(race => (
                <TabsTrigger key={race.raceNumber} value={`race-${race.raceNumber}`}>
                  Race {race.raceNumber}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="overview" className="mt-6">
              <DebugErrorBoundary>
                <V75RaceOverview races={races} />
              </DebugErrorBoundary>
            </TabsContent>
            
            {races.map(race => (
              <TabsContent key={race.raceNumber} value={`race-${race.raceNumber}`} className="mt-6">
                <DebugErrorBoundary>
                  <V75RaceDetails race={race} />
                </DebugErrorBoundary>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </DebugErrorBoundary>
  );
};

export default V75Results;
