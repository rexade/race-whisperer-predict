
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
  const [debugInfo, setDebugInfo] = useState<string>("");

  const fetchHorseData = async () => {
    setLoading(true);
    setError("");
    setDebugInfo("");
    
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
      setError(`Failed to fetch horse data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const processRealATGHistoricalData = (atgData: ATGHorseData) => {
    console.log(`\n=== Processing REAL ATG historical data for ${atgData.horse.name} (ID: ${atgData.horse.id}) ===`);
    
    let debugMessages: string[] = [];
    debugMessages.push(`Processing data for ${atgData.horse.name} (ID: ${atgData.horse.id})`);
    
    // Debug: Log the entire structure
    console.log("Full ATG data structure:", JSON.stringify(atgData, null, 2));
    debugMessages.push(`Full data structure logged to console`);
    
    let historicalRaces: HistoricalRace[] = [];
    
    if (!atgData.results) {
      const errorMsg = "No 'results' property found in ATG data";
      console.error(errorMsg);
      debugMessages.push(errorMsg);
      setError(errorMsg);
      setDebugInfo(debugMessages.join('\n'));
      return;
    }
    
    if (!atgData.results.records) {
      const errorMsg = "No 'records' property found in results";
      console.error(errorMsg);
      debugMessages.push(errorMsg);
      setError(errorMsg);
      setDebugInfo(debugMessages.join('\n'));
      return;
    }
    
    if (!Array.isArray(atgData.results.records)) {
      const errorMsg = "Records is not an array";
      console.error(errorMsg);
      debugMessages.push(errorMsg);
      setError(errorMsg);
      setDebugInfo(debugMessages.join('\n'));
      return;
    }
    
    console.log(`Found ${atgData.results.records.length} total records from ATG API`);
    debugMessages.push(`Found ${atgData.results.records.length} total records`);
    
    // Calculate date 8 months ago
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
    const cutoffDate = eightMonthsAgo.toISOString().split('T')[0];
    console.log(`Filtering races newer than: ${cutoffDate}`);
    debugMessages.push(`Filtering races newer than: ${cutoffDate}`);
    
    // Debug each record
    atgData.results.records.forEach((record, index) => {
      console.log(`\n--- Processing Record ${index + 1}/${atgData.results!.records.length} ---`);
      console.log(`Date: ${record.date}`);
      console.log(`Distance: ${record.start?.distance}m`);
      console.log(`Start method: ${record.race?.startMethod}`);
      console.log(`Track: ${record.track?.name}`);
      console.log(`Place: ${record.place}`);
      console.log(`kmTime:`, record.kmTime);
      console.log(`Galloped: ${record.galloped}`);
      console.log(`Disqualified: ${record.disqualified}`);
      
      // Check date filter
      const raceDate = new Date(record.date);
      const isWithin8Months = raceDate >= eightMonthsAgo;
      
      // Check time validity - more flexible approach
      const hasValidTime = record.kmTime && 
        typeof record.kmTime === 'object' && 
        'minutes' in record.kmTime && 
        'seconds' in record.kmTime && 
        'tenths' in record.kmTime &&
        typeof record.kmTime.minutes === 'number' &&
        typeof record.kmTime.seconds === 'number' &&
        typeof record.kmTime.tenths === 'number';
      
      // Check if not disqualified/galloped
      const isNotDisqualified = !record.disqualified && !record.galloped;
      
      // Check place - be more flexible with place validation
      const hasValidPlace = record.place && 
        record.place !== "0" && 
        record.place !== "" && 
        !isNaN(parseInt(record.place));
      
      // Check required fields
      const hasRequiredFields = record.start?.distance && 
        record.race?.startMethod && 
        record.track?.name &&
        record.start?.postPosition;
      
      console.log(`Validation results:`);
      console.log(`  - Within 8 months: ${isWithin8Months}`);
      console.log(`  - Has valid time: ${hasValidTime}`);
      console.log(`  - Not DQ/galloped: ${isNotDisqualified}`);
      console.log(`  - Has valid place: ${hasValidPlace}`);
      console.log(`  - Has required fields: ${hasRequiredFields}`);
      
      const isValidRace = isWithin8Months && hasValidTime && isNotDisqualified && hasValidPlace && hasRequiredFields;
      console.log(`  - Overall valid: ${isValidRace}`);
      
      if (isValidRace) {
        const race: HistoricalRace = {
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
        historicalRaces.push(race);
        console.log(`✓ Added to valid races`);
        debugMessages.push(`✓ ${record.date}: Valid race added (${record.start.distance}m ${record.race.startMethod}, place ${record.place})`);
      } else {
        const reasons = [];
        if (!isWithin8Months) reasons.push("too old");
        if (!hasValidTime) reasons.push("invalid time");
        if (!isNotDisqualified) reasons.push("DQ/galloped");
        if (!hasValidPlace) reasons.push("invalid place");
        if (!hasRequiredFields) reasons.push("missing fields");
        
        console.log(`✗ Skipped: ${reasons.join(", ")}`);
        debugMessages.push(`✗ ${record.date}: Skipped (${reasons.join(", ")})`);
      }
    });
    
    console.log(`\n=== Final Results ===`);
    console.log(`Filtered to ${historicalRaces.length} valid historical races`);
    debugMessages.push(`\nFinal result: ${historicalRaces.length} valid races found`);
    
    if (historicalRaces.length === 0) {
      const errorMsg = "No valid historical races found after filtering. Check debug info for details.";
      console.log(errorMsg);
      debugMessages.push(errorMsg);
      setError(errorMsg);
      setDebugInfo(debugMessages.join('\n'));
      return;
    }
    
    setDebugInfo(debugMessages.join('\n'));
    calculateRawTimeFromHistory(historicalRaces);
  };

  const calculateRawTimeFromHistory = (historicalRaces: HistoricalRace[]) => {
    console.log("\n=== Starting Simplified RAW Time Calculation ===");
    console.log(`Processing ${historicalRaces.length} valid races`);
    
    const processed: ProcessedTime[] = [];
    
    for (const race of historicalRaces) {
      const originalTimeSeconds = convertKmTimeToSeconds(race.kmTime);
      console.log(`\nProcessing race ${race.date}:`);
      console.log(`  Original time: ${race.kmTime.minutes}:${race.kmTime.seconds}.${race.kmTime.tenths} = ${originalTimeSeconds}s`);
      console.log(`  Distance: ${race.distance}m, Start: ${race.startMethod}`);
      
      const normalizedTime = normalizeTimeSimplified(
        originalTimeSeconds,
        race.distance,
        race.startMethod
      );
      
      console.log(`  Normalized time: ${normalizedTime}s`);
      
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
    
    console.log(`\n=== All ${processed.length} Valid Times (sorted by normalized time) ===`);
    processed.forEach((time, index) => {
      console.log(`${index + 1}. ${time.raceDate}: ${time.originalTimeSeconds.toFixed(1)}s → ${time.normalizedTime.toFixed(1)}s (${time.distance}m ${time.startMethod}, place ${time.finishOrder})`);
    });
    
    // Take the best 3 times and calculate average
    const best3Times = processed.slice(0, Math.min(3, processed.length));
    const rawTimeResult = best3Times.length > 0 
      ? best3Times.reduce((sum, time) => sum + time.normalizedTime, 0) / best3Times.length
      : 0;
    
    console.log(`\n=== RAW Time Calculation (Simplified Formula) ===`);
    console.log(`Best ${best3Times.length} normalized times: ${best3Times.map(t => t.normalizedTime.toFixed(1) + 's').join(', ')}`);
    console.log(`RAW Time (Best ${best3Times.length} Average): ${rawTimeResult.toFixed(2)}s`);
    
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
            Simplified RAW Time Calculator - Real ATG Data (Fixed)
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

          {debugInfo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Debug Information</h3>
              <pre className="text-xs text-yellow-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {debugInfo}
              </pre>
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
                  Based on best {Math.min(3, processedTimes.length)} normalized times from {processedTimes.length} valid races
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
