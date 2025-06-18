
import React from 'react';
import { Calculator } from "lucide-react";
import AnalysisInput from "../../shared/analyzer/AnalysisInput";

interface ModernInputProps {
  raceId: string;
  setRaceId: (raceId: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

const ModernInput: React.FC<ModernInputProps> = ({
  raceId,
  setRaceId,
  onAnalyze,
  loading
}) => {
  return (
    <AnalysisInput
      label="Race ID"
      value={raceId}
      onChange={setRaceId}
      onAnalyze={onAnalyze}
      loading={loading}
      placeholder="e.g., 2025-06-22_19_5"
      buttonText="Analyze Race"
      buttonIcon={<Calculator className="h-4 w-4" />}
    />
  );
};

export default ModernInput;
