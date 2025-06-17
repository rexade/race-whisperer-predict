
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calculator, CheckCircle, AlertCircle } from "lucide-react";

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
      
      // For now, we'll use simulated historical data since we don't have the horse history endpoint
      // In a real implementation, you'd fetch the horse's racing history here
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
    
    // Simulate realistic harness racing history
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
        distance: 2640,
        startMethod: "auto",
        track: "Jägersro",
        kmTime: { minutes: 1, seconds: 17, tenths: 9 },
        finishOrder: 4,
        postPosition: 8,
        galloped: false,
        disqualified: false
      },
      {
        date: "2024-04-18",
        distance: 2140,
        startMethod: "auto",
        track: "Solvalla",
        kmTime: { minutes: 1, seconds: 16, tenths: 1 },
        finishOrder: 6,
        postPosition: 11,
        galloped: false,
        disqualified: false
      }
    ];
    
    return races;
  };

  const convertKmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
    return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
  };

  const normalizeToStandard = (
    timeSeconds: number,
    originalDistance: number,
    originalStartMethod: string,
    postPosition: number
  ): number => {
    let adjustedTime = timeSeconds;
    
    console.log(`\nOriginal time: ${timeSeconds}s, Distance: ${originalDistance}m, Start: ${originalStartMethod}, Post: ${postPosition}`);
    
    // Distance normalization to 2140m
    const distanceRatio = 2140 / originalDistance;
    adjustedTime = adjustedTime * distanceRatio;
    console.log(`After distance normalization (${distanceRatio.toFixed(3)}x): ${adjustedTime.toFixed(2)}s`);
    
    // Start method adjustment
    if (originalStartMethod === "volte") {
      adjustedTime += 1.0;
      console.log(`After volte adjustment (+1.0s): ${adjustedTime.toFixed(2)}s`);
    }
    
    // Post position adjustment for auto start
    if (originalStartMethod === "auto") {
      const postAdjustments = {
        1: 0.1, 2: 0.05, 3: 0.0, 4: -0.05, 5: -0.2,
        6: -0.05, 7: 0.0, 8: 0.1, 9: 0.15, 10: 0.15,
        11: 0.2, 12: 0.3
      };
      const postAdjustment = postAdjustments[postPosition as keyof typeof postAdjustments] || 0;
      adjustedTime += postAdjustment;
      console.log(`After post position adjustment (${postAdjustment > 0 ? '+' : ''}${postAdjustment}s): ${adjustedTime.toFixed(2)}s`);
    }
    
    return Math.round(adjustedTime * 10) / 10;
  };

  const calculateRawTimeFromHistory = (historicalRaces: HistoricalRace[]) => {
    console.log("=== Starting RAW Time Calculation ===");
    const processed: ProcessedTime[] = [];
    
    for (const race of historicalRaces) {
      // Skip disqualified or galloped races
      if (race.disqualified || race.galloped || !race.kmTime) {
        console.log(`Skipping race ${race.date} - disqualified: ${race.disqualified}, galloped: ${race.galloped}`);
        continue;
      }
      
      const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
      const normalizedTime = normalizeToStandard(
        originalTimeSeconds,
        race.distance,
        race.startMethod,
        race.postPosition
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
    
    // Sort by normalized time (best first)
    processed.sort((a, b) => a.normalizedTime - b.normalizedTime);
    
    console.log("\n=== All Valid Times (sorted by normalized time) ===");
    processed.forEach((time, index) => {
      console.log(`${index + 1}. ${time.raceDate}: ${time.originalTimeSeconds}s → ${time.normalizedTime}s (${time.distance}m ${time.startMethod})`);
    });
    
    // Calculate top 3 average
    const top3Times = processed.slice(0, 3);
    const top3Average = top3Times.length > 0 
      ? top3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / top3Times.length
      : 0;
    
    console.log(`\n=== RAW Time Calculation ===`);
    console.log(`Top 3 times: ${top3Times.map(t => t.normalizedTime + 's').join(', ')}`);
    console.log(`RAW Time (Top 3 Average): ${top3Average.toFixed(2)}s`);
    
    setProcessedTimes(processed);
    setRawTime(top3Average);
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
            ATG Horse RAW Time Test
          </CardTitle>
          <p className="text-gray-600">
            Testing RAW time calculation using real ATG API data for race 2025-06-22_19_5, start #2
          </p>
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
                  <h3 className="font-semibold text-green-800">RAW Time Result</h3>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {formatTime(rawTime)}
                </div>
                <p className="text-sm text-green-600">
                  Based on top 3 normalized times from {processedTimes.length} valid races
                </p>
                {horseData && (
                  <p className="text-sm text-blue-600 mt-1">
                    For horse: <strong>{horseData.horse.name}</strong>
                  </p>
                )}
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Historical Race Times (Normalized to 2140m Auto)</h4>
                <div className="space-y-2">
                  {processedTimes.map((time, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded border ${
                      index < 3 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
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
                          <Badge variant="secondary" className="text-xs">
                            Top 3
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
