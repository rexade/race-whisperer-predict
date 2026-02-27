
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AnalysisInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  placeholder?: string;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  disabled?: boolean;
}

const AnalysisInput: React.FC<AnalysisInputProps> = ({
  label,
  value,
  onChange,
  onAnalyze,
  loading,
  placeholder,
  buttonText = "Analyze",
  buttonIcon,
  disabled = false
}) => {
  return (
    <div className="flex gap-4 items-end">
      <div className="flex-1">
        <Label htmlFor="analysisInput">{label}</Label>
        <Input
          id="analysisInput"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading || disabled}
        />
      </div>
      <Button 
        onClick={onAnalyze} 
        disabled={loading || !value || disabled}
      >
        {buttonIcon && <span className="mr-2">{buttonIcon}</span>}
        {loading ? "Analyzing..." : buttonText}
      </Button>
    </div>
  );
};

export default AnalysisInput;
