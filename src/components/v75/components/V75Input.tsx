
import React from 'react';
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import V75DatePicker from "../V75DatePicker";

interface V75InputProps {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  onAnalyze: () => void;
  loading: boolean;
}

const V75Input: React.FC<V75InputProps> = ({
  selectedDate,
  onDateSelect,
  onAnalyze,
  loading
}) => {
  return (
    <div className="space-y-4">
      {/* Simple date selection */}
      <div>
        <V75DatePicker
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
        />
      </div>
      
      {/* Analyze button */}
      <Button 
        onClick={onAnalyze}
        disabled={loading || !selectedDate}
        className="w-full touch-manipulation"
        size="lg"
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        {loading ? "Analyzing…" : "Analyze V85 Races"}
      </Button>
    </div>
  );
};

export default V75Input;
