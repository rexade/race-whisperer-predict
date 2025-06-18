import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarArrowDown, TrendingUp, TrendingDown, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useV75PostRaceAnalysis } from '../hooks/useV75PostRaceAnalysis';
import ProgressIndicator from "../../modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "../../modernAnalyzer/ErrorDisplay";
import { Link } from "react-router-dom";

const V75PostRaceAnalysis: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState("overview");
  
  const {
    loading,
    analysis,
    error,
    analyzePostRace,
    clearAnalysis
  } = useV75PostRaceAnalysis();

  const handleAnalyze = () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    analyzePostRace(dateStr);
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.7) return "text-green-600";
    if (accuracy >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 0.7) return "bg-green-100 text-green-800";
    if (accuracy >= 0.5) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const isNoPredictionsError = error.includes("No V75 predictions found");

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            V75 Post-Race Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workflow Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">How Post-Race Analysis Works</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Step 1:</strong> First analyze a V75 date using the V75 Analyzer to create predictions</p>
                  <p><strong>Step 2:</strong> Then return here to compare those predictions with actual race results</p>
                  <p className="text-xs mt-2 text-blue-600">
                    💡 Post-race analysis requires existing predictions to compare against actual results.
                  </p>
                </div>
                <div className="mt-3">
                  <Link to="/v75-analyzer">
                    <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-100">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Go to V75 Analyzer
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Date Selection */}
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-64 justify-start text-left font-normal">
                  <CalendarArrowDown className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Select analysis date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date() || date < new Date('2024-01-01')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button 
              onClick={handleAnalyze}
              disabled={!selectedDate || loading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Analyze Results
            </Button>
            
            {analysis && (
              <Button 
                onClick={clearAnalysis}
                variant="outline"
              >
                Clear Analysis
              </Button>
            )}
          </div>

          {/* Progress */}
          {loading && (
            <ProgressIndicator progress={50} currentTask="Fetching race results and comparing with predictions..." />
          )}

          {/* Enhanced Error Display for No Predictions */}
          {error && (
            <div className="space-y-3">
              <ErrorDisplay error={error} />
              {isNoPredictionsError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-1">Next Steps:</h4>
                      <p className="text-sm text-amber-700 mb-3">
                        To analyze this date, you need to first create predictions using the V75 Analyzer.
                      </p>
                      <Link to="/v75-analyzer">
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                          Create Predictions First
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>
              Analysis Results - {format(new Date(analysis.analysisDate), 'PPP')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="races">Race Details</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Overall Performance */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {analysis.overallPerformance.totalRaces}
                      </div>
                      <p className="text-xs text-muted-foreground">Races Analyzed</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className={`text-2xl font-bold ${getAccuracyColor(analysis.overallPerformance.averageAccuracy)}`}>
                        {Math.round(analysis.overallPerformance.averageAccuracy * 100)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Average Accuracy</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(analysis.overallPerformance.bestRaceAccuracy * 100)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Best Race</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">
                        {Math.round(analysis.overallPerformance.worstRaceAccuracy * 100)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Worst Race</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Race Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analysis.races.map(race => {
                    const accuracy = race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal;
                    
                    return (
                      <Card key={race.raceId} className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setActiveTab("races")}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">Race {race.raceNumber}</h3>
                            <Badge className={getAccuracyBadge(accuracy)}>
                              {Math.round(accuracy * 100)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>Distance: {race.distance}m</p>
                            <p>Top picks correct: {race.overallAccuracy.topPicksCorrect}/{race.overallAccuracy.topPicksTotal}</p>
                            <p>Perfect predictions: {race.overallAccuracy.perfectPredictions}</p>
                            <p>Avg rank diff: {Math.round(race.overallAccuracy.averageRankDifference * 10) / 10}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Race Details Tab */}
              <TabsContent value="races" className="space-y-6">
                {analysis.races.map(race => (
                  <Card key={race.raceId}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Race {race.raceNumber} - {race.distance}m</span>
                        <Badge className={getAccuracyBadge(race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal)}>
                          {Math.round((race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal) * 100)}% Accuracy
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Race Results Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Finish</th>
                              <th className="text-left p-2">Horse</th>
                              <th className="text-left p-2">Post</th>
                              <th className="text-left p-2">Predicted</th>
                              <th className="text-left p-2">Difference</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {race.predictionAccuracy
                              .sort((a, b) => a.actualFinishPosition - b.actualFinishPosition)
                              .map(horse => (
                              <tr key={horse.horseId} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">#{horse.actualFinishPosition}</td>
                                <td className="p-2">{horse.horseName}</td>
                                <td className="p-2">{horse.postPosition}</td>
                                <td className="p-2">#{horse.predictedRank}</td>
                                <td className={`p-2 ${horse.rankDifference === 0 ? 'text-green-600 font-bold' : 
                                  Math.abs(horse.rankDifference) <= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {horse.rankDifference > 0 ? '+' : ''}{horse.rankDifference}
                                </td>
                                <td className="p-2">
                                  <div className="flex gap-1">
                                    {horse.wasTopPick && (
                                      <Badge variant="outline" className="text-xs">Top Pick</Badge>
                                    )}
                                    {horse.actuallyPlaced && (
                                      <Badge variant="outline" className="text-xs bg-green-50">Placed</Badge>
                                    )}
                                    {horse.correctPrediction && (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-xs text-muted-foreground">
                                  {race.actualResults.finishOrder.find(f => f.horseId === horse.horseId)?.time || 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Top Picks Performance */}
                      <div>
                        <h4 className="font-semibold mb-2">Top Picks Performance</h4>
                        <div className="space-y-2">
                          {analysis.races.map(race => (
                            <div key={race.raceId} className="flex justify-between items-center text-sm">
                              <span>Race {race.raceNumber}:</span>
                              <span className={getAccuracyColor(race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal)}>
                                {race.overallAccuracy.topPicksCorrect}/{race.overallAccuracy.topPicksTotal} correct
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rank Difference Analysis */}
                      <div>
                        <h4 className="font-semibold mb-2">Prediction Accuracy</h4>
                        <div className="space-y-2">
                          {analysis.races.map(race => (
                            <div key={race.raceId} className="flex justify-between items-center text-sm">
                              <span>Race {race.raceNumber}:</span>
                              <span>
                                Avg diff: {Math.round(race.overallAccuracy.averageRankDifference * 10) / 10}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold mb-2 text-blue-800">Recommendations</h4>
                      <div className="text-sm text-blue-700 space-y-1">
                        {analysis.overallPerformance.averageAccuracy >= 0.7 ? (
                          <p>✅ Excellent prediction accuracy! Current weights are performing well.</p>
                        ) : analysis.overallPerformance.averageAccuracy >= 0.5 ? (
                          <p>⚠️ Moderate accuracy. Consider adjusting normalization weights based on race patterns.</p>
                        ) : (
                          <p>❌ Low accuracy detected. Review normalization algorithm and weight settings.</p>
                        )}
                        
                        {analysis.races.some(r => r.overallAccuracy.averageRankDifference > 3) && (
                          <p>🔍 High rank differences in some races suggest recalibration needed.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75PostRaceAnalysis;
