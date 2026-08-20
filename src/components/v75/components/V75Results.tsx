
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import V75RaceDetails from "../V75RaceDetails";
import KupongView from "./KupongView";
import { sortByPrediction, winnerMargin, legConfidence, LegConfidence } from "../utils/raceRanking";
import { buildRaceLegs } from "../utils/raceTabs";

import { V75RaceResult } from "../hooks/useV75Analysis";
import DebugErrorBoundary from "../../DebugErrorBoundary";

const DOT_CLASS: Record<LegConfidence, string> = {
  spik: 'text-success',
  favorit: 'text-warning',
  oppet: 'text-primary',
};

interface V75ResultsProps {
  races: V75RaceResult[];
  analysisDate: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const V75Results: React.FC<V75ResultsProps> = ({
  races,
  activeTab,
  onTabChange
}) => {
  const legs = buildRaceLegs(races);
  const firstTab = legs[0]?.tabValue ?? '';
  const selectedTab = legs.some(leg => leg.tabValue === activeTab) ? activeTab : firstTab;

  // Keep parent state aligned when the result set changes or contains a stale tab.
  React.useEffect(() => {
    if (firstTab && activeTab !== selectedTab) {
      onTabChange(selectedTab);
    }
  }, [activeTab, firstTab, onTabChange, selectedTab]);

  if (races.length === 0) return null;

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

          {/* The whole ticket at a glance — tap a leg to open its race */}
          <KupongView races={races} onSelectRace={onTabChange} />

          <Tabs value={selectedTab} onValueChange={onTabChange}>
            {/* Program-style race strip — horizontally scrollable, editorial underline */}
            <div className="sticky top-[116px] sm:top-[57px] z-10 bg-background border-b border-border mb-4">
              <TabsList className="bg-transparent p-0 gap-4 sm:gap-5 w-full h-12 flex justify-start overflow-x-auto no-scrollbar px-1 rounded-none">
                {legs.map(({ race, legNumber, tabValue }) => {
                  const confidence = legConfidence(winnerMargin(sortByPrediction(race.horses)));
                  return (
                    <TabsTrigger
                      key={race.raceId}
                      value={tabValue}
                      aria-label={`Lopp ${legNumber} — ${confidence}`}
                      title={`Lopp ${legNumber}`}
                      className="num shrink-0 rounded-none border-b-[3px] border-transparent px-1.5 h-12 text-sm whitespace-nowrap bg-transparent text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-extrabold"
                    >
                      {selectedTab === tabValue ? `Lopp ${legNumber}` : legNumber}
                      <span className={`ml-1 text-[8px] ${DOT_CLASS[confidence]}`} aria-hidden="true">●</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
            
            
            {legs.map(({ race, legNumber, tabValue }) => (
              <TabsContent key={race.raceId} value={tabValue} className="mt-3 sm:mt-6">
                <DebugErrorBoundary>
                  <V75RaceDetails race={race} legNumber={legNumber} />
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
