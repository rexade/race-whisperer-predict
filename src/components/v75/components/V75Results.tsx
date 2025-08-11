
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

  // Default to first race instead of overview if no active tab is set
  React.useEffect(() => {
    if (!activeTab && races.length > 0) {
      onTabChange(`race-${races[0].raceNumber}`);
    }
  }, [activeTab, races, onTabChange]);

  return (
    <DebugErrorBoundary>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="hidden sm:block">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            V75 Race Results
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            {/* Mobile-friendly scrollable tabs */}
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <TabsList className="bg-transparent p-0 w-max sm:w-full flex-nowrap gap-1 h-9 sm:h-10">
                <TabsTrigger 
                  value="overview" 
                  className="rounded-none text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Overview
                </TabsTrigger>
                {races.map(race => (
                  <TabsTrigger 
                    key={race.raceNumber} 
                    value={`race-${race.raceNumber}`}
                    aria-label={`Race ${race.raceNumber}`}
                    title={`Race ${race.raceNumber}`}
                    className="rounded-none text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {race.raceNumber}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <TabsContent value="overview" className="mt-3 sm:mt-6">
              <DebugErrorBoundary>
                <V75RaceOverview races={races} />
              </DebugErrorBoundary>
            </TabsContent>
            
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
