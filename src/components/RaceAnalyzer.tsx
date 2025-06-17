
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Clock, Trophy, TrendingUp, User, MapPin, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import HorseCard from "./HorseCard";
import { fetchRaceData, normalizeKmTime } from "@/utils/raceAnalysis";

interface RaceAnalyzerProps {
  selectedDate: string;
}

const RaceAnalyzer: React.FC<RaceAnalyzerProps> = ({ selectedDate }) => {
  const [races, setRaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const analyzeRaces = async () => {
      setLoading(true);
      setProgress(0);
      
      try {
        setCurrentTask("Fetching available races...");
        setProgress(10);
        
        // Simulate API calls with progress updates
        const mockRaces = await fetchRaceData(selectedDate, (task, prog) => {
          setCurrentTask(task);
          setProgress(prog);
        });
        
        setRaces(mockRaces);
        setCurrentTask("Analysis complete!");
        setProgress(100);
        
        toast({
          title: "Analysis Complete",
          description: `Found ${mockRaces.length} races with detailed horse data.`,
        });
        
      } catch (error) {
        console.error("Error analyzing races:", error);
        toast({
          title: "Analysis Error",
          description: "Failed to fetch race data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setTimeout(() => setLoading(false), 1000);
      }
    };

    analyzeRaces();
  }, [selectedDate, toast]);

  if (loading) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            Analyzing Races for {selectedDate}
          </CardTitle>
          <CardDescription>{currentTask}</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-500 mt-2">{progress}% complete</p>
        </CardContent>
      </Card>
    );
  }

  if (races.length === 0) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>No Races Found</CardTitle>
          <CardDescription>
            No harness racing data available for {selectedDate}. Try selecting a different date.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card className="border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-50 to-amber-50">
          <CardTitle className="text-2xl text-green-800 flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Race Analysis Results - {selectedDate}
          </CardTitle>
          <CardDescription>
            Found {races.length} races with {races.reduce((total, race) => total + race.horses.length, 0)} horses total
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="0" className="w-full">
        <TabsList className="grid w-full grid-cols-auto gap-1 h-auto p-1 bg-green-50">
          {races.map((race, index) => (
            <TabsTrigger 
              key={index} 
              value={index.toString()}
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white px-4 py-2"
            >
              Race {race.raceNumber}
            </TabsTrigger>
          ))}
        </TabsList>

        {races.map((race, index) => (
          <TabsContent key={index} value={index.toString()} className="mt-6">
            <Card className="border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-100 to-amber-100">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-green-800">
                      Race {race.raceNumber} - {race.distance}m
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <Badge variant="outline" className="border-green-300">
                        {race.startMethod === "auto" ? "Auto Start" : "Volte Start"}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {race.track}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {race.horses.length} starters
                      </span>
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-600 text-white">
                    {race.raceId}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {race.horses
                    .sort((a, b) => a.normalizedTime - b.normalizedTime)
                    .map((horse, horseIndex) => (
                      <HorseCard 
                        key={horse.startNumber} 
                        horse={horse} 
                        rank={horseIndex + 1}
                        raceInfo={{
                          startMethod: race.startMethod,
                          distance: race.distance
                        }}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default RaceAnalyzer;
