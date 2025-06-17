
import React from 'react';
import { CheckCircle } from "lucide-react";

interface RaceInfoDisplayProps {
  raceInfo: {
    raceNumber: number;
    distance: number;
    startMethod: string;
  };
  horseCount: number;
}

const RaceInfoDisplay: React.FC<RaceInfoDisplayProps> = ({ raceInfo, horseCount }) => {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold text-green-800">Race Data Loaded</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <strong>Race:</strong> {raceInfo.raceNumber}
        </div>
        <div>
          <strong>Distance:</strong> {raceInfo.distance}m
        </div>
        <div>
          <strong>Start:</strong> {raceInfo.startMethod}
        </div>
        <div>
          <strong>Horses:</strong> {horseCount}
        </div>
      </div>
    </div>
  );
};

export default RaceInfoDisplay;
