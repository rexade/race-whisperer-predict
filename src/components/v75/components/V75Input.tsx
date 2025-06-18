
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Select Date
        </h3>
        <V75DatePicker
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
        />
        
        {selectedDate && (
          <StatusCard type="info" title="Date Selected">
            <div className="text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Selected: {format(selectedDate, 'PPP')}</span>
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Click "Analyze V75" to check for V75 races on this date
              </div>
            </div>
          </StatusCard>
        )}
      </div>
      
      <div className="lg:col-span-2 flex flex-col justify-end">
        <div className="space-y-4">
          <StatusCard type="info" title="Ready to Analyze">
            <div className="text-sm text-purple-700">
              {selectedDate ? (
                <div>
                  <strong>Selected Date:</strong> {format(selectedDate, 'PPP')}
                  <div className="text-xs text-purple-600 mt-1">
                    The system will automatically detect V75 races for this date during analysis
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
            className="w-full bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {loading ? "Analyzing V75..." : "Analyze V75 Races"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default V75Input;
