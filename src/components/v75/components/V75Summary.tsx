
import React from 'react';
import { Trophy } from "lucide-react";
import StatusCard from "../../shared/analyzer/StatusCard";
import { V75RaceResult } from "../hooks/useV75Analysis";

interface V75SummaryProps {
  races: V75RaceResult[];
  analysisDate: string;
}

const V75Summary: React.FC<V75SummaryProps> = ({ races, analysisDate }) => {
  const totalHorsesAnalyzed = races.reduce((total, race) => 
    total + race.horses.filter(h => h.rawKmTime).length, 0
  );

  const successfulRaces = races.filter(r => r.analysisComplete).length;

  return (
    <StatusCard type="success" title="V75 Analysis Complete">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <strong>Date:</strong> {analysisDate}
        </div>
        <div>
          <strong>Races:</strong> {successfulRaces}/{races.length}
        </div>
        <div>
          <strong>Horses:</strong> {totalHorsesAnalyzed}
        </div>
        <div>
          <strong>Status:</strong> 
          <span className={successfulRaces === races.length ? "text-green-600" : "text-yellow-600"}>
            {" "}{successfulRaces === races.length ? "Complete" : "Partial"}
          </span>
        </div>
      </div>
    </StatusCard>
  );
};

export default V75Summary;
