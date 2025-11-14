
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
    <StatusCard type="success" title="V85 Analysis Complete">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-foreground">
        <div>
          <strong className="font-medium">Date:</strong> <span className="text-muted-foreground">{analysisDate}</span>
        </div>
        <div>
          <strong className="font-medium">Races:</strong> <span className="text-muted-foreground">{successfulRaces}/{races.length}</span>
        </div>
        <div>
          <strong className="font-medium">Horses:</strong> <span className="text-muted-foreground">{totalHorsesAnalyzed}</span>
        </div>
        <div>
          <strong className="font-medium">Status:</strong> 
          <span className={successfulRaces === races.length ? "text-success ml-1" : "text-warning ml-1"}>
            {successfulRaces === races.length ? "Complete" : "Partial"}
          </span>
        </div>
      </div>
    </StatusCard>
  );
};

export default V75Summary;
