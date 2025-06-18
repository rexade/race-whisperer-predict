
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, MapPin, Clock, Users } from "lucide-react";
import { V75RaceResult } from '../hooks/useV75Analysis';

interface V75RaceHeaderProps {
  race: V75RaceResult;
}

const V75RaceHeader: React.FC<V75RaceHeaderProps> = ({ race }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Race {race.raceNumber}: {race.name}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span>{race.track}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>{race.distance}m {race.startMethod}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span>{race.horses.length} horses</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gray-500" />
            <span>{(race.prize / 1000000).toFixed(1)}M SEK</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default V75RaceHeader;
