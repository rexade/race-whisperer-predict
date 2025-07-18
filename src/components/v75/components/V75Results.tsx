
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
        
        <CardContent className="p-3 sm:p-6">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            {/* Mobile-friendly scrollable tabs */}
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <TabsList className="grid w-max sm:w-full grid-cols-8 min-w-max gap-1">
                <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                  Overview
                </TabsTrigger>
                {races.map(race => (
                  <TabsTrigger 
                    key={race.raceNumber} 
                    value={`race-${race.raceNumber}`}
                    className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3"
                  >
                    R{race.raceNumber}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
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
