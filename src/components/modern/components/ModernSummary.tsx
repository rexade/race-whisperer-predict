
import React from 'react';
import StatusCard from "../../shared/analyzer/StatusCard";

interface ModernSummaryProps {
  raceInfo: {
    raceNumber: number;
    distance: number;
    startMethod: string;
  };
  horseCount: number;
}

const ModernSummary: React.FC<ModernSummaryProps> = ({ raceInfo, horseCount }) => {
  return (
    <StatusCard type="success" title="Race Data Loaded">
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
    </StatusCard>
  );
};

export default ModernSummary;
