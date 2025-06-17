
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Clock, DollarSign } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';

interface V75RaceOverviewProps {
  races: V75RaceResult[];
}

// Safety function to ensure we never render an object as React child
const ensureStringForDisplay = (value: any): string => {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value && typeof value === 'object') {
    if ('name' in value && typeof value.name === 'string') {
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      return String(value.name || 'Unknown Horse');
    }
  }
  
  return String(value || 'Unknown Horse');
};

const V75RaceOverview: React.FC<V75RaceOverviewProps> = ({ races }) => {
  const getTotalPrize = () => {
    return races.reduce((total, race) => total + race.prize, 0);
  };

  const getTopNormalizedTimes = () => {
    const allHorses = races.flatMap(race => 
      race.horses.filter(horse => horse.modernNormalizedResult)
    );
    
    return allHorses
      .sort((a, b) => {
        const timeA = a.modernNormalizedResult!.modernNormalizedTime;
        const timeB = b.modernNormalizedResult!.modernNormalizedTime;
        
        const totalSecondsA = timeA.minutes * 60 + timeA.seconds + timeA.tenths / 10;
        const totalSecondsB = timeB.minutes * 60 + timeB.seconds + timeB.tenths / 10;
        
        return totalSecondsA - totalSecondsB;
      })
      .slice(0, 10);
  };

  const formatKmTime = (time: { minutes: number; seconds: number; tenths: number }) => {
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;
  };

  const topTimes = getTopNormalizedTimes();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Races</p>
                <p className="text-2xl font-bold">{races.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Tracks</p>
                <p className="text-2xl font-bold">
                  {new Set(races.map(r => r.track)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Horses</p>
                <p className="text-2xl font-bold">
                  {races.reduce((total, race) => total + race.horses.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Total Prize</p>
                <p className="text-lg font-bold">
                  {(races.reduce((total, race) => total + race.prize, 0) / 1000000).toFixed(1)}M SEK
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Race Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(race => (
          <Card key={race.raceNumber} className={`border-l-4 ${race.analysisComplete ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Race {race.raceNumber}</span>
                <Badge variant={race.analysisComplete ? "default" : "destructive"}>
                  {race.analysisComplete ? "Complete" : "Failed"}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">{race.name}</p>
            </CardHeader>
            
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>Track:</strong> {race.track}
                </div>
                <div>
                  <strong>Distance:</strong> {race.distance}m
                </div>
                <div>
                  <strong>Start:</strong> {race.startMethod}
                </div>
                <div>
                  <strong>Horses:</strong> {race.horses.length}
                </div>
              </div>
              
              {race.analysisComplete && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Analyzed Horses:</p>
                  <p className="text-sm font-medium">
                    {race.horses.filter(h => h.rawKmTime).length}/{race.horses.length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Normalized Times */}
      {topTimes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Top 10 Normalized Times (All Races)
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-3">
              {topTimes.map((horse, index) => {
                // Ensure horse name is always a string before rendering
                const safeHorseName = ensureStringForDisplay(horse.horseName);
                console.log('V75RaceOverview - Horse name:', safeHorseName, 'Original:', horse.horseName, 'Type:', typeof horse.horseName);
                
                return (
                  <div key={`${horse.raceId}-${horse.horseId}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-400' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div>
                        <p className="font-semibold">{safeHorseName}</p>
                        <p className="text-sm text-gray-600">
                          Race {horse.raceNumber} • {horse.driverName} • Post {horse.postPosition}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-600">
                        {formatKmTime(horse.modernNormalizedResult!.modernNormalizedTime)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Raw: {formatKmTime(horse.modernNormalizedResult!.rawTime)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75RaceOverview;
