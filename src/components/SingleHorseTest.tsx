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
      
      // Generate simulated historical data and calculate RAW time
      const simulatedHistory = generateSimulatedHistoryForHorse(data.horse.id, data.horse.name);
      calculateRawTimeFromHistory(simulatedHistory);
      
    } catch (err) {
      console.error("Error fetching horse data:", err);
      setError(`Failed to fetch horse data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSimulatedHistoryForHorse = (horseId: number, horseName: string): HistoricalRace[] => {
    console.log(`Generating simulated history for ${horseName} (ID: ${horseId})`);
    
    // Simulate realistic harness racing history with varied distances and start methods
    const races: HistoricalRace[] = [
      {
        date: "2024-06-10",
        distance: 2140,
        startMethod: "auto",
        track: "Solvalla",
        kmTime: { minutes: 1, seconds: 15, tenths: 2 },
        finishOrder: 2,
        postPosition: 5,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-05-28",
        distance: 1640,
        startMethod: "auto",
        track: "Åby",
        kmTime: { minutes: 1, seconds: 12, tenths: 8 },
        finishOrder: 1,
        postPosition: 3,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-05-15",
        distance: 2140,
        startMethod: "volte",
        track: "Solvalla",
        kmTime: { minutes: 1, seconds: 14, tenths: 5 },
        finishOrder: 3,
        postPosition: 7,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-05-01",
        distance: 1640,
        startMethod: "auto",
        track: "Jägersro",
        kmTime: { minutes: 1, seconds: 11, tenths: 9 },
        finishOrder: 4,
        postPosition: 8,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-04-18",
        distance: 2140,
        startMethod: "volte",
        track: "Solvalla",
        kmTime: { minutes: 1, seconds: 16, tenths: 1 },
        finishOrder: 6,
        postPosition: 11,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-04-05",
        distance: 1640,
        startMethod: "volte",
        track: "Mantorp",
        kmTime: { minutes: 1, seconds: 13, tenths: 5 },
        finishOrder: 2,
        postPosition: 4,
        galloped: false,
        disqualified: false
      }
    ];
    
    return races;
  };

  const calculateRawTimeFromHistory = (historicalRaces: HistoricalRace[]) => {
    console.log("\n=== Starting Simplified RAW Time Calculation ===");
    const processed: ProcessedTime[] = [];
    
    for (const race of historicalRaces) {
      // Skip disqualified or galloped races
      if (race.disqualified || race.galloped || !race.kmTime) {
        console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
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
        finishOrder: race.finishOrder,
        valid: true
      });
    }
    
    // Sort by normalized time (best/fastest first)
    processed.sort((a, b) => a.normalizedTime - b.normalizedTime);
    
    console.log("\n=== All Valid Times (sorted by normalized time) ===");
    processed.forEach((time, index) => {
      console.log(`${index + 1}. ${time.raceDate}: ${time.originalTimeSeconds}s → ${time.normalizedTime}s (${time.distance}m ${time.startMethod})`);
    });
    
    // Step 3: Take the best 3 times and calculate average
    const best3Times = processed.slice(0, 3);
    const rawTimeResult = best3Times.length > 0 
      ? best3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / best3Times.length
      : 0;
    
    console.log(`\n=== RAW Time Calculation (Simplified Formula) ===`);
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
            Simplified RAW Time Calculator
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
            {loading ? "Fetching..." : "Fetch Horse Data & Calculate RAW Time"}
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
                  <h3 className="font-semibold text-green-800">RAW Time Result (Simplified)</h3>
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
                <h4 className="font-semibold mb-2">Historical Race Times (Simplified Normalization)</h4>
                <div className="space-y-2">
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
                        <div className="font-mono">
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
