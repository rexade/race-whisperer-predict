
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarArrowDown, TrendingUp, TrendingDown, CheckCircle, AlertCircle, ArrowLeft, Target, Clock } from "lucide-react";
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

  const getMAEColor = (mae: number) => {
    if (mae <= 1.5) return "text-green-600";
    if (mae <= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getTimeMAEColor = (timeMAE: number) => {
    if (timeMAE <= 2) return "text-green-600";
    if (timeMAE <= 5) return "text-yellow-600";
    return "text-red-600";
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
              
              {/* Enhanced Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Overall Performance - Enhanced with MAE metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                      <div className={`text-2xl font-bold ${getMAEColor(analysis.overallPerformance.overallMAE)}`}>
                        {analysis.overallPerformance.overallMAE.toFixed(1)}
                      </div>
                      <p className="text-xs text-muted-foreground">Overall MAE</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className={`text-2xl font-bold ${analysis.overallPerformance.overallTimeMAE ? getTimeMAEColor(analysis.overallPerformance.overallTimeMAE) : 'text-gray-400'}`}>
                        {analysis.overallPerformance.overallTimeMAE ? `${analysis.overallPerformance.overallTimeMAE.toFixed(1)}s` : 'N/A'}
                      </div>
                      <p className="text-xs text-muted-foreground">Overall Time MAE</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">
                        {analysis.overallPerformance.bestTimesPredicted}
                      </div>
                      <p className="text-xs text-muted-foreground">Best Times Predicted</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round((analysis.overallPerformance.bestTimesPredicted / analysis.overallPerformance.totalRaces) * 100)}%
                      </div>
                      <p className="text-xs text-muted-foreground">Best Time Success</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Race Summary Grid */}
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
                            <p>MAE: <span className={getMAEColor(race.overallAccuracy.meanAbsoluteError)}>{race.overallAccuracy.meanAbsoluteError.toFixed(1)}</span></p>
                            {race.overallAccuracy.timeMAE && (
                              <p>Time MAE: <span className={getTimeMAEColor(race.overallAccuracy.timeMAE)}>{race.overallAccuracy.timeMAE.toFixed(1)}s</span></p>
                            )}
                            <p>Best time: {race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction ? '✅' : '❌'}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Enhanced Race Details Tab */}
              <TabsContent value="races" className="space-y-6">
                {analysis.races.map(race => (
                  <Card key={race.raceId}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Race {race.raceNumber} - {race.distance}m</span>
                        <div className="flex gap-2">
                          <Badge className={getAccuracyBadge(race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal)}>
                            {Math.round((race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal) * 100)}% Accuracy
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            MAE: {race.overallAccuracy.meanAbsoluteError.toFixed(1)}
                          </Badge>
                          {race.overallAccuracy.timeMAE && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Time MAE: {race.overallAccuracy.timeMAE.toFixed(1)}s
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Best Time Prediction Display */}
                      {race.overallAccuracy.bestTimeAccuracy && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-semibold">Best Time Prediction</span>
                          </div>
                          <div className="text-sm space-y-1">
                            <p>Predicted fastest: <span className="font-medium">{race.overallAccuracy.bestTimeAccuracy.predictedBest}</span></p>
                            <p>Actual fastest: <span className="font-medium">{race.overallAccuracy.bestTimeAccuracy.actualBest}</span></p>
                            <p>Correct prediction: {race.overallAccuracy.bestTimeAccuracy.correctBestPrediction ? 
                              <span className="text-green-600 font-medium">✅ Yes</span> : 
                              <span className="text-red-600 font-medium">❌ No</span>
                            }</p>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Race Results Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Finish</th>
                              <th className="text-left p-2">Horse</th>
                              <th className="text-left p-2">Post</th>
                              <th className="text-left p-2">Predicted</th>
                              <th className="text-left p-2">Difference</th>
                              <th className="text-left p-2">Predicted Time</th>
                              <th className="text-left p-2">Actual Time</th>
                              <th className="text-left p-2">Time Diff</th>
                              <th className="text-left p-2">Status</th>
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
                                <td className="p-2 text-xs">
                                  {horse.predictedTime ? 
                                    `${horse.predictedTime.minutes}:${horse.predictedTime.seconds.toString().padStart(2, '0')}.${horse.predictedTime.tenths}` : 
                                    'N/A'
                                  }
                                </td>
                                <td className="p-2 text-xs">
                                  {horse.actualTime ? 
                                    `${horse.actualTime.minutes}:${horse.actualTime.seconds.toString().padStart(2, '0')}.${horse.actualTime.tenths}` : 
                                    'N/A'
                                  }
                                </td>
                                <td className={`p-2 text-xs ${horse.timeDifference !== undefined ? 
                                  (horse.timeDifference <= 2 ? 'text-green-600' : 
                                   horse.timeDifference <= 5 ? 'text-yellow-600' : 'text-red-600') : ''}`}>
                                  {horse.timeDifference !== undefined ? `${horse.timeDifference.toFixed(1)}s` : 'N/A'}
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Enhanced Insights Tab */}
              <TabsContent value="insights" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* MAE Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Position Prediction Analysis (MAE)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {analysis.races.map(race => (
                          <div key={race.raceId} className="flex justify-between items-center text-sm">
                            <span>Race {race.raceNumber}:</span>
                            <span className={getMAEColor(race.overallAccuracy.meanAbsoluteError)}>
                              {race.overallAccuracy.meanAbsoluteError.toFixed(1)} positions
                            </span>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span>Overall MAE:</span>
                            <span className={getMAEColor(analysis.overallPerformance.overallMAE)}>
                              {analysis.overallPerformance.overallMAE.toFixed(1)} positions
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Time Prediction Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Time Prediction Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {analysis.races.map(race => (
                          <div key={race.raceId} className="flex justify-between items-center text-sm">
                            <span>Race {race.raceNumber}:</span>
                            <span className={race.overallAccuracy.timeMAE ? getTimeMAEColor(race.overallAccuracy.timeMAE) : 'text-gray-400'}>
                              {race.overallAccuracy.timeMAE ? `${race.overallAccuracy.timeMAE.toFixed(1)}s` : 'N/A'}
                            </span>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span>Overall Time MAE:</span>
                            <span className={analysis.overallPerformance.overallTimeMAE ? getTimeMAEColor(analysis.overallPerformance.overallTimeMAE) : 'text-gray-400'}>
                              {analysis.overallPerformance.overallTimeMAE ? `${analysis.overallPerformance.overallTimeMAE.toFixed(1)}s` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Best Time Prediction Success Rate */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Best Time Prediction Success</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {analysis.races.map(race => (
                          <div key={race.raceId} className="flex justify-between items-center text-sm">
                            <span>Race {race.raceNumber}:</span>
                            <span className={race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction ? 'text-green-600' : 'text-red-600'}>
                              {race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction ? '✅ Correct' : '❌ Incorrect'}
                            </span>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span>Success Rate:</span>
                            <span className="text-purple-600">
                              {analysis.overallPerformance.bestTimesPredicted}/{analysis.overallPerformance.totalRaces} ({Math.round((analysis.overallPerformance.bestTimesPredicted / analysis.overallPerformance.totalRaces) * 100)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Picks Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Picks Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Insights & Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold mb-2 text-blue-800">Overall Assessment</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          {analysis.overallPerformance.averageAccuracy >= 0.7 ? (
                            <p>✅ Excellent prediction accuracy ({Math.round(analysis.overallPerformance.averageAccuracy * 100)}%)! Current weights are performing well.</p>
                          ) : analysis.overallPerformance.averageAccuracy >= 0.5 ? (
                            <p>⚠️ Moderate accuracy ({Math.round(analysis.overallPerformance.averageAccuracy * 100)}%). Consider adjusting normalization weights based on race patterns.</p>
                          ) : (
                            <p>❌ Low accuracy detected ({Math.round(analysis.overallPerformance.averageAccuracy * 100)}%). Review normalization algorithm and weight settings.</p>
                          )}
                          
                          <p>📊 Position MAE: {analysis.overallPerformance.overallMAE.toFixed(1)} positions average error</p>
                          {analysis.overallPerformance.overallTimeMAE && (
                            <p>⏱️ Time MAE: {analysis.overallPerformance.overallTimeMAE.toFixed(1)} seconds average error</p>
                          )}
                          <p>🏆 Best time predictions: {analysis.overallPerformance.bestTimesPredicted}/{analysis.overallPerformance.totalRaces} races ({Math.round((analysis.overallPerformance.bestTimesPredicted / analysis.overallPerformance.totalRaces) * 100)}%)</p>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 rounded-lg">
                        <h4 className="font-semibold mb-2 text-amber-800">Areas for Improvement</h4>
                        <div className="text-sm text-amber-700 space-y-1">
                          {analysis.overallPerformance.overallMAE > 3 && (
                            <p>🎯 High position MAE suggests rank predictions need calibration</p>
                          )}
                          {analysis.overallPerformance.overallTimeMAE && analysis.overallPerformance.overallTimeMAE > 5 && (
                            <p>⏱️ High time MAE indicates time normalization accuracy can be improved</p>
                          )}
                          {(analysis.overallPerformance.bestTimesPredicted / analysis.overallPerformance.totalRaces) < 0.3 && (
                            <p>🏆 Low best time prediction rate - review speed factors and normalization</p>
                          )}
                          {analysis.races.some(r => r.overallAccuracy.averageRankDifference > 3) && (
                            <p>🔍 High rank differences in some races suggest race-specific recalibration needed</p>
                          )}
                        </div>
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
