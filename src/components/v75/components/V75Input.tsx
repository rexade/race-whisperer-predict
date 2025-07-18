
import React from 'react';
import { Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import V75DatePicker from "../V75DatePicker";
import StatusCard from "../../shared/analyzer/StatusCard";

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
      {/* Mobile-first date selection */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Select Date
        </h3>
        <V75DatePicker
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
        />
      </div>
      
      {/* Selected date status - compact on mobile */}
      {selectedDate && (
        <StatusCard type="info" title="Date Selected">
          <div className="text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{format(selectedDate, 'MMM d, yyyy')}</div>
                <div className="text-xs text-blue-600 mt-1">
                  Tap "Analyze V75" to check for races
                </div>
              </div>
            </div>
          </div>
        </StatusCard>
      )}
      
      {/* Analysis status and button */}
      <div className="space-y-3">
        <StatusCard type="info" title="Ready to Analyze">
          <div className="text-sm text-purple-700">
            {selectedDate ? (
              <div>
                <div className="font-medium">{format(selectedDate, 'PPP')}</div>
                <div className="text-xs text-purple-600 mt-1">
                  System will auto-detect V75 races for this date
                </div>
              </div>
            ) : (
              <div className="text-purple-600">
                Please select a date to begin analysis
              </div>
            )}
          </div>
        </StatusCard>
        
        <Button 
          onClick={onAnalyze}
          disabled={loading || !selectedDate}
          className="w-full bg-purple-600 hover:bg-purple-700 touch-manipulation"
          size="lg"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          {loading ? "Analyzing V75..." : "Analyze V75 Races"}
        </Button>
      </div>
    </div>
  );
};

export default V75Input;
