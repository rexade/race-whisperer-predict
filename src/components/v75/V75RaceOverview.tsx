import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Clock, DollarSign } from "lucide-react";
import { V75RaceResult } from './hooks/useV75Analysis';

interface V75RaceOverviewProps {
  races: V75RaceResult[];
}

// Enhanced safety function to ensure we never render an object as React child
const ensureStringForDisplay = (value: any): string => {
  console.log('🔍 V75RaceOverview - ensureStringForDisplay input:', JSON.stringify(value), 'Type:', typeof value);
  
  if (typeof value === 'string') {
    console.log('✅ V75RaceOverview - Value is already a string:', value);
    return value;
  }
  
  if (value && typeof value === 'object') {
    console.log('🔧 V75RaceOverview - Value is object, extracting name...');
    if ('name' in value && typeof value.name === 'string') {
      console.log('✅ V75RaceOverview - Extracted name from object.name:', value.name);
      return value.name;
    }
    if ('id' in value && 'name' in value) {
      console.log('✅ V75RaceOverview - Extracted name from id/name object:', value.name);
      return String(value.name || 'Unknown Horse');
    }
    console.error('❌ V75RaceOverview - Object has no valid name property:', JSON.stringify(value));
  }
  
  console.warn('⚠️ V75RaceOverview - Fallback conversion:', value, 'to string');
  return String(value || 'Unknown Horse');
};

const V75RaceOverview: React.FC<V75RaceOverviewProps> = ({ races }) => {
  console.log('🎯 V75RaceOverview - Rendering with races:', races.length);
  
  // CRITICAL DEBUG: Check ALL data that will be rendered
  races.forEach((race, raceIndex) => {
    console.log(`🏁 RACE ${raceIndex} DEBUG:`, {
      raceNumber: race.raceNumber,
      raceId: race.raceId,
      track: race.track,
      name: race.name,
      trackType: typeof race.track,
      nameType: typeof race.name
    });
    
    race.horses.forEach((horse, horseIndex) => {
      console.log(`🐎 HORSE ${horseIndex} FULL DEBUG:`, {
        horseId: horse.horseId,
        horseName: horse.horseName,
        horseNameType: typeof horse.horseName,
        horseNameStringified: JSON.stringify(horse.horseName),
        driverName: horse.driverName,
        driverNameType: typeof horse.driverName,
        driverNameStringified: JSON.stringify(horse.driverName),
        track: horse.track,
        trackType: typeof horse.track
      });
      
      // CRITICAL: If any of these are objects, log an error
      if (typeof horse.horseName === 'object') {
        console.error('🚨 CRITICAL: Horse name is an object!', horse.horseName);
      }
      if (typeof horse.driverName === 'object') {
        console.error('🚨 CRITICAL: Driver name is an object!', horse.driverName);
      }
      if (typeof horse.track === 'object') {
        console.error('🚨 CRITICAL: Track is an object!', horse.track);
      }
    });
  });
  
  const getTopNormalizedTimes = () => {
    const allHorses = races.flatMap(race => 
      race.horses.filter(horse => horse.modernNormalizedResult)
    );
    
    // Add debugging for each horse before sorting
    allHorses.forEach((horse, index) => {
      console.log(`🐎 V75RaceOverview - TOP TIMES Horse ${index}: ID=${horse.horseId}, Name=`, JSON.stringify(horse.horseName), 'Type:', typeof horse.horseName);
      
      // Additional safety check - if horseName is still an object, we have a problem
      if (typeof horse.horseName === 'object') {
        console.error('🚨 CRITICAL - Horse name is still an object in getTopNormalizedTimes!', horse.horseName);
      }
    });
    
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
                  {new Set(races.map(r => {
                    // CRITICAL DEBUG: Check track values
                    console.log('🏁 Track value for unique set:', r.track, 'Type:', typeof r.track);
                    if (typeof r.track === 'object') {
                      console.error('🚨 CRITICAL: Race track is an object!', r.track);
                      return ensureStringForDisplay(r.track);
                    }
                    return r.track;
                  })).size}
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
        {races.map(race => {
          // CRITICAL DEBUG: Check each race's properties before rendering
          console.log(`🏁 RENDERING RACE ${race.raceNumber}:`, {
            raceNumber: race.raceNumber,
            name: race.name,
            nameType: typeof race.name,
            track: race.track,
            trackType: typeof race.track,
            distance: race.distance,
            distanceType: typeof race.distance,
            startMethod: race.startMethod,
            startMethodType: typeof race.startMethod
          });
          
          // Safety check for all string fields
          const safeName = ensureStringForDisplay(race.name);
          const safeTrack = ensureStringForDisplay(race.track);
          const safeStartMethod = ensureStringForDisplay(race.startMethod);
          
          return (
            <Card key={race.raceNumber} className={`border-l-4 ${race.analysisComplete ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Race {race.raceNumber}</span>
                  <Badge variant={race.analysisComplete ? "default" : "destructive"}>
                    {race.analysisComplete ? "Complete" : "Failed"}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">{safeName}</p>
              </CardHeader>
              
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <strong>Track:</strong> {safeTrack}
                  </div>
                  <div>
                    <strong>Distance:</strong> {race.distance}m
                  </div>
                  <div>
                    <strong>Start:</strong> {safeStartMethod}
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
          );
        })}
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
                // CRITICAL: Ensure horse name is always a string before rendering - TRIPLE CHECK
                console.log(`🛡️ V75RaceOverview - CRITICAL RENDER CHECK - Horse ${horse.horseId}:`, {
                  originalHorseName: horse.horseName,
                  horseNameType: typeof horse.horseName,
                  isObject: typeof horse.horseName === 'object',
                  objectKeys: typeof horse.horseName === 'object' ? Object.keys(horse.horseName) : 'N/A',
                  driverName: horse.driverName,
                  driverNameType: typeof horse.driverName
                });
                
                // If horseName is still an object at this point, force extract the name
                let safeHorseName: string;
                let safeDriverName: string;
                
                if (typeof horse.horseName === 'object' && horse.horseName !== null) {
                  console.error('🚨 EMERGENCY OBJECT CONVERSION - Horse name is an object at render time!', horse.horseName);
                  safeHorseName = ensureStringForDisplay(horse.horseName);
                } else {
                  safeHorseName = ensureStringForDisplay(horse.horseName);
                }
                
                if (typeof horse.driverName === 'object' && horse.driverName !== null) {
                  console.error('🚨 EMERGENCY OBJECT CONVERSION - Driver name is an object at render time!', horse.driverName);
                  safeDriverName = ensureStringForDisplay(horse.driverName);
                } else {
                  safeDriverName = ensureStringForDisplay(horse.driverName);
                }
                
                // Final validation before render
                if (typeof safeHorseName !== 'string') {
                  console.error('🚨 FINAL VALIDATION FAILED - safeHorseName is not a string!', safeHorseName);
                  safeHorseName = 'Emergency Fallback Name';
                }
                
                if (typeof safeDriverName !== 'string') {
                  console.error('🚨 FINAL VALIDATION FAILED - safeDriverName is not a string!', safeDriverName);
                  safeDriverName = 'Emergency Fallback Driver';
                }
                
                console.log('✅ V75RaceOverview - Final safe names for render:', {
                  safeHorseName,
                  safeDriverName,
                  horseNameType: typeof safeHorseName,
                  driverNameType: typeof safeDriverName
                });
                
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
                          Race {horse.raceNumber} • {safeDriverName} • Post {horse.postPosition}
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
