
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import WeightManager from "./WeightManager";
import V75DatePicker from "./v75/V75DatePicker";
import V75RaceDetails from "./v75/V75RaceDetails";
import V75RaceOverview from "./v75/V75RaceOverview";
import ProgressIndicator from "./modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "./modernAnalyzer/ErrorDisplay";
import DebugErrorBoundary from "./DebugErrorBoundary";
import { useV75Analysis } from "./v75/hooks/useV75Analysis";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';

const V75Analyzer: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [activeTab, setActiveTab] = useState("overview");
  
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
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    console.log('🎯 V75Analyzer - Starting analysis for date:', dateStr);
    analyzeV75Date(dateStr, weights);
  };

  // Recalculate when weights change
  useEffect(() => {
    if (v75Results.length > 0) {
      console.log('🔄 V75Analyzer - Reanalyzing with new weights');
      reanalyzeWithNewWeights(weights);
    }
  }, [weights]);

  // Update active tab when results are loaded
  useEffect(() => {
    if (v75Results.length > 0) {
      console.log('📊 V75Analyzer - Results loaded, setting overview tab');
      setActiveTab("overview");
    }
  }, [v75Results]);

  const totalHorsesAnalyzed = v75Results.reduce((total, race) => 
    total + race.horses.filter(h => h.rawKmTime).length, 0
  );

  const successfulRaces = v75Results.filter(r => r.analysisComplete).length;

  return (
    <DebugErrorBoundary>
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
                    Select Date
                  </h3>
                  <V75DatePicker
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                  />
                  
                  {selectedDate && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <AlertCircle className="h-4 w-4" />
                        <span>Selected: {format(selectedDate, 'PPP')}</span>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Click "Analyze V75" to check for V75 races on this date
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Analysis Action */}
                <div className="lg:col-span-2 flex flex-col justify-end">
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-800 mb-2">Ready to Analyze</h4>
                      <div className="text-sm text-purple-700">
                        {selectedDate ? (
                          <div>
                            <strong>Selected Date:</strong> {format(selectedDate, 'PPP')}
                            <div className="text-xs text-purple-600 mt-1">
                              The system will automatically detect V75 races for this date during analysis
                            </div>
                          </div>
                        ) : (
                          <div className="text-purple-600">
                            Please select a date to begin analysis
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleAnalyzeV75}
                      disabled={loading || !selectedDate}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="lg"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {loading ? "Analyzing V75..." : "Analyze V75 Races"}
                    </Button>
                  </div>
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
            <DebugErrorBoundary>
              <WeightManager weights={weights} onWeightsChange={setWeights} />
            </DebugErrorBoundary>
          )}

          {/* Results */}
          {v75Results.length > 0 && (
            <DebugErrorBoundary>
              <Card className="border-purple-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    V75 Race Results
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-8">
                      <TabsTrigger value="overview">
                        Overview
                      </TabsTrigger>
                      {v75Results.map(race => {
                        console.log(`🏁 V75Analyzer - Creating tab for race ${race.raceNumber}`);
                        return (
                          <TabsTrigger key={race.raceNumber} value={`race-${race.raceNumber}`}>
                            Race {race.raceNumber}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                    
                    <TabsContent value="overview" className="mt-6">
                      <DebugErrorBoundary>
                        <V75RaceOverview races={v75Results} />
                      </DebugErrorBoundary>
                    </TabsContent>
                    
                    {v75Results.map(race => {
                      console.log(`🏁 V75Analyzer - Creating tab content for race ${race.raceNumber}`);
                      return (
                        <TabsContent key={race.raceNumber} value={`race-${race.raceNumber}`} className="mt-6">
                          <DebugErrorBoundary>
                            <V75RaceDetails race={race} />
                          </DebugErrorBoundary>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            </DebugErrorBoundary>
          )}
        </div>
      </div>
    </DebugErrorBoundary>
  );
};

export default V75Analyzer;
