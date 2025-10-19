
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import V75RaceDetails from "../V75RaceDetails";

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

  // Default to first race if no active tab or if overview was set previously
  React.useEffect(() => {
    if ((!activeTab || activeTab === 'overview') && races.length > 0) {
      onTabChange(`race-${races[0].raceNumber}`);
    }
  }, [activeTab, races, onTabChange]);

  return (
    <DebugErrorBoundary>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="hidden sm:block">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Race Results
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            {/* Dynamic grid tabs based on race count */}
            <div className="">
              <TabsList 
                className="bg-transparent p-0 gap-1 w-full h-9 sm:h-10"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${races.length}, 1fr)` }}
              >
                {races.map(race => (
                  <TabsTrigger 
                    key={race.raceNumber} 
                    value={`race-${race.raceNumber}`}
                    aria-label={`Race ${race.raceNumber}`}
                    title={`Race ${race.raceNumber}`}
                    className="text-center rounded-md text-xs sm:text-sm px-0 py-2 h-9 sm:h-10 whitespace-nowrap bg-atg-gray-100 text-atg-navy focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:bg-atg-blue data-[state=active]:text-white"
                  >
                    R{race.raceNumber}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            
            {races.map(race => (
              <TabsContent key={race.raceNumber} value={`race-${race.raceNumber}`} className="mt-3 sm:mt-6">
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
