
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, TrendingUp, Clock, Trophy } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import RaceAnalyzer from "@/components/RaceAnalyzer";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [raceData, setRaceData] = useState(null);
  const { toast } = useToast();

  const handleAnalyzeRaces = async () => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date to analyze races.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      console.log(`Analyzing races for date: ${dateStr}`);
      
      // This will trigger the race analysis
      setRaceData({ date: dateStr, timestamp: Date.now() });
      
      toast({
        title: "Analysis Started",
        description: `Fetching harness racing data for ${format(selectedDate, "PPP")}`,
      });
    } catch (error) {
      console.error("Error starting analysis:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to start race analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-amber-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-green-800 to-green-600 text-white">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Trophy className="h-16 w-16 text-amber-300" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Harness Racing Analyst
            </h1>
            <p className="text-xl md:text-2xl text-green-100 max-w-3xl mx-auto">
              Professional race analysis with normalized time predictions and performance insights
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        {/* Date Selection Card */}
        <Card className="max-w-2xl mx-auto mb-8 shadow-lg border-green-200">
          <CardHeader className="text-center bg-gradient-to-r from-green-50 to-amber-50">
            <CardTitle className="text-2xl text-green-800 flex items-center justify-center gap-2">
              <CalendarIcon className="h-6 w-6" />
              Select Race Date
            </CardTitle>
            <CardDescription className="text-green-600">
              Choose a date to analyze harness racing data and get performance predictions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-80 justify-start text-left font-normal border-green-300 hover:border-green-500",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Button 
                onClick={handleAnalyzeRaces}
                disabled={!selectedDate || isAnalyzing}
                className="w-80 bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Races...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Analyze Races
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Race Analysis Results */}
        {raceData && (
          <RaceAnalyzer 
            selectedDate={raceData.date} 
            key={raceData.timestamp}
          />
        )}

        {/* Feature Cards */}
        {!raceData && (
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="border-green-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Trophy className="h-8 w-8 text-amber-500 mb-2" />
                <CardTitle className="text-green-800">Race Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Comprehensive analysis of all horses in each race with performance metrics and predictions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <Clock className="h-8 w-8 text-green-500 mb-2" />
                <CardTitle className="text-green-800">Time Normalization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Advanced algorithms normalize race times accounting for distance, start method, and conditions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 hover:shadow-lg transition-shadow">
              <CardHeader>
                <TrendingUp className="h-8 w-8 text-blue-500 mb-2" />
                <CardTitle className="text-green-800">Performance Ranking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Horses ranked by predicted performance using MAE optimization and historical data analysis.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
