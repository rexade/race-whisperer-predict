
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Clock, Users, TrendingUp } from "lucide-react";
import { V75RaceResult } from '../hooks/useV75Analysis';

interface V75RaceHeaderProps {
  race: V75RaceResult;
}

const V75RaceHeader: React.FC<V75RaceHeaderProps> = ({ race }) => {
  // Calculate data quality metrics
  const totalHorses = race.horses.length;
  const normalizedCount = race.horses.filter(h => 
    h.timeSource === "normalized" || !h.timeSource
  ).length;
  const fallbackCount = race.horses.filter(h => 
    h.timeSource && h.timeSource !== "normalized"
  ).length;
  const normalizedPct = totalHorses > 0 ? Math.round((normalizedCount / totalHorses) * 100) : 0;
  const fallbackPct = totalHorses > 0 ? Math.round((fallbackCount / totalHorses) * 100) : 0;

  return (
    <Card className="bg-gradient-card shadow-lg border-atg-gray-200">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-atg-navy font-secondary text-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            Race {race.raceNumber}: {race.name}
          </div>
          <div className="flex items-center gap-2 text-xs font-normal">
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {normalizedPct}% normalized
            </Badge>
            {fallbackPct > 0 && (
              <Badge variant="secondary" className="gap-1">
                {fallbackPct}% fallback
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3 p-3 bg-atg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-atg-blue rounded-lg flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Track</p>
              <p className="font-semibold text-atg-navy">{race.track}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-atg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-atg-orange rounded-lg flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distance</p>
              <p className="font-semibold text-atg-navy">{race.distance}m {race.startMethod}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-atg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-atg-green rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Horses</p>
              <p className="font-semibold text-atg-navy">{race.horses.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-atg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
              <Trophy className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prize</p>
              <p className="font-semibold text-atg-navy">{(race.prize / 1000000).toFixed(1)}M SEK</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default V75RaceHeader;
