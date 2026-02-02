
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Target, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { V75PostRaceAnalysis } from '../../types/postRaceAnalysisTypes';
import { KmTime } from '../../../../services/types/kmTimeTypes';
import { formatKmTime } from '../../utils/v75DisplayUtils';
import KmtidAnalyticsCard from './KmtidAnalyticsCard';

interface V75PostRaceDetailsProps {
  analysis: V75PostRaceAnalysis;
}

const V75PostRaceDetails: React.FC<V75PostRaceDetailsProps> = ({ analysis }) => {
  const [expandedKmtidHorse, setExpandedKmtidHorse] = useState<{ raceId: string; horseId: number } | null>(null);

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
                    <th className="text-left p-2 w-20">Analytics</th>
                  </tr>
                </thead>
                <tbody>
                  {race.predictionAccuracy
                    .sort((a, b) => a.actualFinishPosition - b.actualFinishPosition)
                    .map(horse => {
                      const finishEntry = race.actualResults.finishOrder.find(
                        (f) => f.horseId === horse.horseId
                      );
                      const hasKmtid = finishEntry?.kmtidAnalytics != null;
                      const isExpanded =
                        expandedKmtidHorse?.raceId === race.raceId &&
                        expandedKmtidHorse?.horseId === horse.horseId;
                      return (
                        <React.Fragment key={horse.horseId}>
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium">#{horse.actualFinishPosition}</td>
                            <td className="p-2">{horse.horseName}</td>
                            <td className="p-2">{horse.postPosition}</td>
                            <td className="p-2">#{horse.predictedRank}</td>
                            <td className={`p-2 ${horse.rankDifference === 0 ? 'text-green-600 font-bold' : 
                              Math.abs(horse.rankDifference) <= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {horse.rankDifference > 0 ? '+' : ''}{horse.rankDifference}
                            </td>
                            <td className="p-2 text-xs">
                              {formatKmTime(horse.predictedTime)}
                            </td>
                            <td className="p-2 text-xs">
                              {formatKmTime(horse.actualTime)}
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
                            <td className="p-2 text-muted-foreground">
                              {hasKmtid ? (
                                <button
                                  type="button"
                                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                                  onClick={() =>
                                    setExpandedKmtidHorse(
                                      isExpanded ? null : { raceId: race.raceId, horseId: horse.horseId }
                                    )
                                  }
                                >
                                  {isExpanded ? (
                                    <>Hide {<ChevronUp className="h-3 w-3" />}</>
                                  ) : (
                                    <>Show {<ChevronDown className="h-3 w-3" />}</>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </td>
                          </tr>
                          {hasKmtid && isExpanded && finishEntry?.kmtidAnalytics && (
                            <tr>
                              <td colSpan={10} className="p-2 bg-muted/30 align-top">
                                <KmtidAnalyticsCard
                                  horseName={horse.horseName}
                                  driver={finishEntry.driver}
                                  kmtidAnalytics={finishEntry.kmtidAnalytics}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default V75PostRaceDetails;
