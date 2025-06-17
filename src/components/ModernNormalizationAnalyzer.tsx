
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Calculator, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WeightManager from "./WeightManager";
import ModernNormalizationTable from "./ModernNormalizationTable";
import { fetchEnhancedRaceData, EnhancedHorseData } from '../services/enhancedAtgApi';
import { calculateRawTimesForRace } from '../services/timeProcessor';
import { 
  applyModernNormalization, 
  ModernNormalizedResult, 
  NormalizationWeights, 
  getDefaultWeights,
  ModernNormalizationFactors
} from '../services/modernNormalization';

const ModernNormalizationAnalyzer: React.FC = () => {
  const [raceId, setRaceId] = useState("2025-06-22_19_5");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState("");
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [enhancedHorses, setEnhancedHorses] = useState<EnhancedHorseData[]>([]);
  const [modernResults, setModernResults] = useState<ModernNormalizedResult[]>([]);
  const [raceInfo, setRaceInfo] = useState<any>(null);
  const { toast } = useToast();

  const analyzeRace = async () => {
    setLoading(true);
    setError("");
    setProgress(0);
    
    try {
      setCurrentTask("Fetching enhanced race data...");
      setProgress(20);
      
      // Fetch enhanced race data
      const raceData = await fetchEnhancedRaceData(raceId);
      setRaceInfo(raceData);
      
      setCurrentTask("Calculating RAW times...");
      setProgress(50);
      
      // Calculate RAW times for all horses
      const atgStarts = raceData.horses.map(horse => ({
        horse: { id: horse.horseId, name: horse.name },
        number: horse.postPosition,
        postPosition: horse.postPosition,
        distance: horse.distance,
        driver: {
          firstName: horse.driver.firstName,
          lastName: horse.driver.lastName,
          statistics: { winPercentage: horse.driver.winPercentage }
        }
      }));
      
      const rawTimes = await calculateRawTimesForRace(atgStarts, (current, total) => {
        const progressValue = 50 + (current / total) * 30;
        setProgress(progressValue);
        setCurrentTask(`Calculating RAW time for horse ${current} of ${total}...`);
      });
      
      // Add RAW times to enhanced horse data
      const horsesWithRawTimes = raceData.horses.map(horse => {
        const rawTimeData = rawTimes.find(rt => rt.horseId === horse.horseId);
        return {
          ...horse,
          rawTime: rawTimeData?.best3Average || 0
        };
      });
      
      setEnhancedHorses(horsesWithRawTimes);
      
      setCurrentTask("Applying modern normalization...");
      setProgress(80);
      
      // Apply modern normalization to each horse
      applyModernNormalizationToHorses(horsesWithRawTimes, raceData);
      
      setProgress(100);
      setCurrentTask("Analysis complete!");
      
      toast({
        title: "Analysis Complete",
        description: `Modern normalization applied to ${horsesWithRawTimes.length} horses.`,
      });
      
    } catch (err) {
      console.error("Error during analysis:", err);
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast({
        title: "Analysis Error",
        description: "Failed to complete modern normalization analysis.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const applyModernNormalizationToHorses = (horses: EnhancedHorseData[], raceData: any) => {
    const results: ModernNormalizedResult[] = [];
    
    for (const horse of horses) {
      if (!horse.rawTime) continue;
      
      const factors: ModernNormalizationFactors = {
        postPosition: horse.postPosition,
        distance: horse.distance,
        startMethod: horse.startMethod,
        shoesFront: horse.shoes.front,
        shoesBack: horse.shoes.back,
        sulkyType: horse.sulky.type,
        homeTrack: horse.homeTrack,
        driverExperience: horse.driver.experience,
        driverWinPercentage: horse.driver.winPercentage,
        horseForm: horse.statistics.winPercentage
      };
      
      const result = applyModernNormalization(horse.rawTime, factors, weights);
      results.push(result);
    }
    
    setModernResults(results);
  };

  // Recalculate when weights change
  useEffect(() => {
    if (enhancedHorses.length > 0 && raceInfo) {
      applyModernNormalizationToHorses(enhancedHorses, raceInfo);
    }
  }, [weights]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <Card className="border-purple-200">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="text-2xl text-purple-800 flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Modern Normalization Analyzer
          </CardTitle>
          <p className="text-purple-600">
            Advanced RAW time normalization using race-specific factors and adjustable weights
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="raceId">Race ID</Label>
              <Input
                id="raceId"
                value={raceId}
                onChange={(e) => setRaceId(e.target.value)}
                placeholder="e.g., 2025-06-22_19_5"
                disabled={loading}
              />
            </div>
            <Button 
              onClick={analyzeRace} 
              disabled={loading || !raceId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Calculator className="h-4 w-4 mr-2" />
              {loading ? "Analyzing..." : "Analyze Race"}
            </Button>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentTask}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-800">Error</h3>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}

          {raceInfo && enhancedHorses.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Race Data Loaded</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <strong>Race:</strong> {raceInfo.raceNumber}
                </div>
                <div>
                  <strong>Distance:</strong> {raceInfo.distance}m
                </div>
                <div>
                  <strong>Start:</strong> {raceInfo.startMethod}
                </div>
                <div>
                  <strong>Horses:</strong> {enhancedHorses.length}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {enhancedHorses.length > 0 && (
        <>
          <WeightManager weights={weights} onWeightsChange={setWeights} />
          
          {modernResults.length > 0 && (
            <ModernNormalizationTable 
              horses={enhancedHorses}
              results={modernResults}
              raceInfo={raceInfo}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ModernNormalizationAnalyzer;
