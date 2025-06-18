
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { V75PostRaceAnalysis } from '../../types/postRaceAnalysisTypes';

interface V75PostRaceOverviewProps {
  analysis: V75PostRaceAnalysis;
  setActiveTab: (tab: string) => void;
}

const V75PostRaceOverview: React.FC<V75PostRaceOverviewProps> = ({ analysis, setActiveTab }) => {
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

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default V75PostRaceOverview;
