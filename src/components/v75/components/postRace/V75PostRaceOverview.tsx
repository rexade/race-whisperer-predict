
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";
import { V75PostRaceAnalysis } from '../../types/postRaceAnalysisTypes';

interface V75PostRaceOverviewProps {
  analysis: V75PostRaceAnalysis;
  setActiveTab: (tab: string) => void;
}

const V75PostRaceOverview: React.FC<V75PostRaceOverviewProps> = ({ analysis, setActiveTab }) => {
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.7) return "text-success";
    if (accuracy >= 0.5) return "text-warning";
    return "text-destructive";
  };

  const getAccuracyBadgeClass = (accuracy: number) => {
    if (accuracy >= 0.7) return "bg-success/10 text-success border-success/20";
    if (accuracy >= 0.5) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const getMAEColor = (mae: number) => {
    if (mae <= 1.5) return "text-success";
    if (mae <= 3) return "text-warning";
    return "text-destructive";
  };

  const getTimeMAEColor = (timeMAE: number) => {
    if (timeMAE <= 2) return "text-success";
    if (timeMAE <= 5) return "text-warning";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
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
            <div className={`text-2xl font-bold ${analysis.overallPerformance.overallTimeMAE ? getTimeMAEColor(analysis.overallPerformance.overallTimeMAE) : 'text-muted-foreground'}`}>
              {analysis.overallPerformance.overallTimeMAE ? `${analysis.overallPerformance.overallTimeMAE.toFixed(1)}s` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Overall Time MAE</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">
              {analysis.overallPerformance.bestTimesPredicted}
            </div>
            <p className="text-xs text-muted-foreground">Best Times Predicted</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">
              {Math.round((analysis.overallPerformance.bestTimesPredicted / analysis.overallPerformance.totalRaces) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">Best Time Success</p>
          </CardContent>
        </Card>
      </div>

      {/* Race Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analysis.races.map(race => {
          const accuracy = race.overallAccuracy.topPicksCorrect / race.overallAccuracy.topPicksTotal;
          const isCorrectBestTime = race.overallAccuracy.bestTimeAccuracy?.correctBestPrediction;

          return (
            <Card
              key={race.raceId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("races")}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">Race {race.raceNumber}</h3>
                  <Badge className={getAccuracyBadgeClass(accuracy)}>
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
                  <p className="flex items-center gap-1">
                    Best time:
                    {isCorrectBestTime
                      ? <CheckCircle className="h-3.5 w-3.5 text-success inline ml-1" aria-label="Correct" />
                      : <XCircle className="h-3.5 w-3.5 text-destructive inline ml-1" aria-label="Incorrect" />
                    }
                  </p>
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
