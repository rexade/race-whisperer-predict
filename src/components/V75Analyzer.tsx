
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import WeightManager from "./WeightManager";
import V75DatePicker from "./v75/V75DatePicker";
import V75RaceOverview from "./v75/V75RaceOverview";
import V75RaceDetails from "./v75/V75RaceDetails";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { V75CalendarDate } from '../services/v75CalendarApi';
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';

const V75Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedV75Data, setSelectedV75Data] = useState<V75CalendarDate | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [activeRaceTab, setActiveRaceTab] = useState("overview");
  
  const {
    loading,
    progress,
    currentTask,
    error,
    v75Results,
    analysisDate,
    analyzeV75Date,
    reanalyzeWithNewWeights
  } = useV75Analysis();

  const handleAnalyzeV75 = () => {
    if (!selectedDate || !selectedV75Data) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    analyzeV75Date(dateStr, weights);
  };

  // Recalculate when weights change
  useEffect(() => {
    if (v75Results.length > 0) {
      reanalyzeWithNewWeights(weights);
    }
  }, [weights]);

  const totalHorsesAnalyzed = v75Results.reduce((total, race) => 
    total + race.horses.filter(h => h.rawKmTime).length, 0
  );

  const successfulRaces = v75Results.filter(r => r.analysisComplete).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        {/* Header */}
        <Card className="border-purple-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="text-2xl text-purple-800 flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              V75 Multi-Race Analyzer
            </CardTitle>
            <p className="text-purple-600">
              Analyze all 7 races in a V75 day with advanced RAW time normalization
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Select V75 Date
                </h3>
                <V75DatePicker
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  onV75DataSelect={setSelectedV75Data}
                />
              </div>
              
              {/* Analysis Action */}
              <div className="lg:col-span-2 flex flex-col justify-end">
                {selectedV75Data && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-800 mb-2">Ready to Analyze</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Event:</strong> {selectedV75Data.eventName}
                        </div>
                        <div>
                          <strong>Races:</strong> {selectedV75Data.races.length}
                        </div>
                        <div>
                          <strong>Date:</strong> {selectedDate && format(selectedDate, 'PPP')}
                        </div>
                        <div>
                          <strong>Tracks:</strong> {Array.from(new Set(selectedV75Data.races.map(r => r.track))).join(', ')}
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleAnalyzeV75}
                      disabled={loading || !selectedDate || !selectedV75Data}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {loading ? "Analyzing V75..." : "Analyze V75 Races"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            {loading && (
              <ProgressIndicator progress={progress} currentTask={currentTask} />
            )}

            {/* Error */}
            {error && (
              <ErrorDisplay error={error} />
            )}

            {/* Results Summary */}
            {v75Results.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">V75 Analysis Complete</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <strong>Date:</strong> {analysisDate}
                  </div>
                  <div>
                    <strong>Races:</strong> {successfulRaces}/{v75Results.length}
                  </div>
                  <div>
                    <strong>Horses:</strong> {totalHorsesAnalyzed}
                  </div>
                  <div>
                    <strong>Status:</strong> 
                    <span className={successfulRaces === v75Results.length ? "text-green-600" : "text-yellow-600"}>
                      {" "}{successfulRaces === v75Results.length ? "Complete" : "Partial"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weight Manager */}
        {v75Results.length > 0 && (
          <WeightManager weights={weights} onWeightsChange={setWeights} />
        )}

        {/* Results */}
        {v75Results.length > 0 && (
          <Card className="border-purple-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                V75 Race Results
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <Tabs value={activeRaceTab} onValueChange={setActiveRaceTab}>
                <TabsList className="grid w-full grid-cols-8">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  {v75Results.map(race => (
                    <TabsTrigger key={race.raceNumber} value={`race-${race.raceNumber}`}>
                      Race {race.raceNumber}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <TabsContent value="overview" className="mt-6">
                  <V75RaceOverview races={v75Results} />
                </TabsContent>
                
                {v75Results.map(race => (
                  <TabsContent key={race.raceNumber} value={`race-${race.raceNumber}`} className="mt-6">
                    <V75RaceDetails race={race} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default V75Analyzer;
