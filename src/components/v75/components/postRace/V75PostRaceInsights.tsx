
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Clock } from "lucide-react";
import { V75PostRaceAnalysis } from '../../types/postRaceAnalysisTypes';

interface V75PostRaceInsightsProps {
  analysis: V75PostRaceAnalysis;
}

const V75PostRaceInsights: React.FC<V75PostRaceInsightsProps> = ({ analysis }) => {
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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.7) return "text-green-600";
    if (accuracy >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default V75PostRaceInsights;
