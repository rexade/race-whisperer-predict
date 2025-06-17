import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calculator, CheckCircle, AlertCircle } from "lucide-react";
import { normalizeTimeSimplified, convertKmTimeToSeconds } from '../services/timeProcessor';

interface HistoricalRace {
  date: string;
  distance: number;
  startMethod: string;
  track: string;
  kmTime: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  finishOrder: number;
  postPosition: number;
  galloped: boolean;
  disqualified: boolean;
}

interface ProcessedTime {
  originalTimeSeconds: number;
  normalizedTime: number;
  raceDate: string;
  distance: number;
  startMethod: string;
  finishOrder: number;
  valid: boolean;
}

interface ATGHorseData {
  horse: {
    name: string;
    id: number;
  };
  driver: {
    firstName: string;
    lastName: string;
  };
  postPosition: number;
  result?: {
    finishOrder?: number;
    kmTime?: {
      minutes: number;
      seconds: number;
      tenths: number;
    };
    galloped?: boolean;
    disqualified?: boolean;
  };
  results?: {
    records: Array<{
      date: string;
      kmTime?: {
        minutes: number;
        seconds: number;
        tenths: number;
      } | { code: string };
      place?: string;
      race: {
        id: string;
        startMethod: string;
      };
      track: {
        name: string;
      };
      start: {
        distance: number;
        postPosition: number;
      };
      galloped?: boolean;
      disqualified?: boolean;
    }>;
  };
}

const SingleHorseTest: React.FC = () => {
  const [processedTimes, setProcessedTimes] = useState<ProcessedTime[]>([]);
  const [rawTime, setRawTime] = useState<number>(0);
  const [isCalculated, setIsCalculated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [horseData, setHorseData] = useState<ATGHorseData | null>(null);

  const fetchHorseData = async () => {
    setLoading(true);
    setError("");
    
    try {
      console.log("Fetching horse data from ATG API...");
      const response = await fetch('https://www.atg.se/services/racinginfo/v1/api/races/2025-06-22_19_5/start/2');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("ATG API Response:", data);
      
      setHorseData(data);
      
      // Process real historical data from the ATG response
      processRealATGHistoricalData(data);
      
    } catch (err) {
      console.error("Error fetching horse data:", err);
      setError(`Failed to fetch horse data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processRealATGHistoricalData = (atgData: ATGHorseData) => {
    console.log(`\n=== Processing REAL ATG historical data for ${atgData.horse.name} (ID: ${atgData.horse.id}) ===`);
    
    let historicalRaces: HistoricalRace[] = [];
    
    if (atgData.results && atgData.results.records && Array.isArray(atgData.results.records)) {
      console.log(`Found ${atgData.results.records.length} real historical records from ATG API`);
      
      // Calculate date 8 months ago
      const eightMonthsAgo = new Date();
      eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
      console.log(`Filtering races newer than: ${eightMonthsAgo.toISOString().split('T')[0]}`);
      
      // Process all records and apply filtering
      historicalRaces = atgData.results.records
        .map(record => {
          // Check if race is within 8 months
          const raceDate = new Date(record.date);
          const isWithin8Months = raceDate >= eightMonthsAgo;
          
          // Check if we have valid time data (not a code like "kubu")
          const hasValidTime = record.kmTime && 
            typeof record.kmTime === 'object' && 
            'minutes' in record.kmTime && 
            'seconds' in record.kmTime && 
            'tenths' in record.kmTime;
          
          const isNotDisqualified = !record.disqualified && !record.galloped;
          const hasValidPlace = record.place && record.place !== "0" && !isNaN(parseInt(record.place));
          
          console.log(`Record ${record.date}: within8Months=${isWithin8Months}, hasValidTime=${hasValidTime}, isNotDisqualified=${isNotDisqualified}, hasValidPlace=${hasValidPlace}, place=${record.place}, kmTime=`, record.kmTime);
          
          // Only return races that meet ALL criteria
          if (isWithin8Months && hasValidTime && isNotDisqualified && hasValidPlace) {
            return {
              date: record.date,
              distance: record.start.distance,
              startMethod: record.race.startMethod,
              track: record.track.name,
              kmTime: record.kmTime as { minutes: number; seconds: number; tenths: number },
              finishOrder: parseInt(record.place),
              postPosition: record.start.postPosition,
              galloped: record.galloped || false,
              disqualified: record.disqualified || false
            };
          }
          return null;
        })
        .filter(race => race !== null) as HistoricalRace[];
      
      console.log(`Filtered to ${historicalRaces.length} valid historical races (within 8 months, not DQ/galloped, valid times)`);
      
      // If we have very few races within 8 months, let's also show what we filtered out for debugging
      if (historicalRaces.length < 3) {
        console.log("\n=== DEBUG: Showing what was filtered out ===");
        atgData.results.records.forEach(record => {
          const raceDate = new Date(record.date);
          const eightMonthsAgo = new Date();
          eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
          
          const isWithin8Months = raceDate >= eightMonthsAgo;
          const hasValidTime = record.kmTime && typeof record.kmTime === 'object' && 'minutes' in record.kmTime;
          const isNotDisqualified = !record.disqualified && !record.galloped;
          const hasValidPlace = record.place && record.place !== "0";
          
          console.log(`${record.date}: 8mo=${isWithin8Months}, time=${hasValidTime}, notDQ=${isNotDisqualified}, place=${hasValidPlace} - kmTime:`, record.kmTime);
        });
      }
    } else {
      console.log("No historical data found in ATG response");
      setError("No historical race data available for this horse");
      return;
    }
    
    if (historicalRaces.length === 0) {
      console.log("No valid historical races found after filtering");
      setError("No valid historical races found for RAW time calculation");
      return;
    }
    
    calculateRawTimeFromHistory(historicalRaces);
  };

  const calculateRawTimeFromHistory = (historicalRaces: HistoricalRace[]) => {
    console.log("\n=== Starting Simplified RAW Time Calculation (8-month filter + DQ/Gallop exclusion) ===");
    console.log(`Processing ${historicalRaces.length} total races`);
    
    const processed: ProcessedTime[] = [];
    
    for (const race of historicalRaces) {
      // Skip disqualified, galloped races, or races without time
      if (race.disqualified || race.galloped || !race.kmTime) {
        console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}, no time: ${!race.kmTime}`);
        continue;
      }
      
      const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
      const normalizedTime = normalizeTimeSimplified(
        originalTimeSeconds,
        race.distance,
        race.startMethod
      );
      
      processed.push({
        originalTimeSeconds,
        normalizedTime,
        raceDate: race.date,
        distance: race.distance,
        startMethod: race.startMethod,
        finishOrder: race.finishOrder || 0,
        valid: true
      });
    }
    
    // Sort by normalized time (best/fastest first)
    processed.sort((a, b) => a.normalizedTime - b.normalizedTime);
    
    console.log(`\n=== All ${processed.length} Valid Times (within 8 months, no DQ/gallop, sorted by normalized time) ===`);
    processed.forEach((time, index) => {
      console.log(`${index + 1}. ${time.raceDate}: ${time.originalTimeSeconds}s → ${time.normalizedTime}s (${time.distance}m ${time.startMethod})`);
    });
    
    // Step 3: Take the best 3 times and calculate average
    const best3Times = processed.slice(0, 3);
    const rawTimeResult = best3Times.length > 0 
      ? best3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / best3Times.length
      : 0;
    
    console.log(`\n=== RAW Time Calculation (Simplified Formula, 8-month filter) ===`);
    console.log(`Best 3 normalized times: ${best3Times.map(t => t.normalizedTime + 's').join(', ')}`);
    console.log(`RAW Time (Best 3 Average): ${rawTimeResult.toFixed(2)}s`);
    
    setProcessedTimes(processed);
    setRawTime(rawTimeResult);
    setIsCalculated(true);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00.0";
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${minutes}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simplified RAW Time Calculator - Real ATG Data
          </CardTitle>
          <p className="text-gray-600">
            Testing simplified RAW time calculation using real ATG API data for race 2025-06-22_19_5, start #2
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
            <h4 className="font-semibold text-blue-800 mb-2">Simplified Formula:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Convert all times to seconds</li>
              <li>2. If 1640m autostart: add 3.6 seconds</li>
              <li>3. If volte start: subtract 1 second (normalize to auto)</li>
              <li>4. Take best 3 normalized times</li>
              <li>5. Calculate average = RAW TIME</li>
            </ol>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchHorseData} disabled={loading} className="mb-4">
            {loading ? "Fetching..." : "Fetch Real ATG Data & Calculate RAW Time"}
          </Button>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Error</h3>
              </div>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {horseData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">Horse Information from ATG</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Horse:</strong> {horseData.horse.name} (ID: {horseData.horse.id})
                </div>
                <div>
                  <strong>Driver:</strong> {horseData.driver.firstName} {horseData.driver.lastName}
                </div>
                <div>
                  <strong>Post Position:</strong> {horseData.postPosition}
                </div>
                {horseData.result && (
                  <div>
                    <strong>Finish Order:</strong> {horseData.result.finishOrder || "N/A"}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {isCalculated && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">RAW Time Result (Simplified - Real Data)</h3>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {formatTime(rawTime)}
                </div>
                <p className="text-sm text-green-600">
                  Based on best 3 normalized times from {processedTimes.length} valid races
                </p>
                {horseData && (
                  <p className="text-sm text-blue-600 mt-1">
                    For horse: <strong>{horseData.horse.name}</strong>
                  </p>
                )}
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">All Historical Race Times (Simplified Normalization)</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {processedTimes.map((time, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded border ${
                      index < 3 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div>
                        <div className="font-medium">{time.raceDate}</div>
                        <div className="text-sm text-gray-600">
                          {time.distance}m {time.startMethod} • Finish: {time.finishOrder}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {formatTime(time.originalTimeSeconds)} → {formatTime(time.normalizedTime)}
                        </div>
                        {index < 3 && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Best 3
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SingleHorseTest;
