
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";

interface RaceInputProps {
  raceId: string;
  setRaceId: (raceId: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

const RaceInput: React.FC<RaceInputProps> = ({ raceId, setRaceId, onAnalyze, loading }) => {
  return (
    <div className="flex gap-4 items-end">
      <div className="flex-1">
        <Label htmlFor="raceId">Race ID</Label>
        <Input
          id="raceId"
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          placeholder="e.g., 2025-06-22_19_5"
          disabled={loading}
        />
      </div>
      <Button 
        onClick={onAnalyze} 
        disabled={loading || !raceId}
        className="bg-purple-600 hover:bg-purple-700"
      >
        <Calculator className="h-4 w-4 mr-2" />
        {loading ? "Analyzing..." : "Analyze Race"}
      </Button>
    </div>
  );
};

export default RaceInput;
