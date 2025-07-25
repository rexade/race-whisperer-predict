
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarArrowDown, TrendingUp, AlertCircle, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

import ProgressIndicator from "../../../modernAnalyzer/ProgressIndicator";
import ErrorDisplay from "../../../modernAnalyzer/ErrorDisplay";

interface V75PostRaceHeaderProps {
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  handleAnalyze: () => void;
  clearAnalysis: () => void;
  loading: boolean;
  hasAnalysis: boolean;
  error: string;
}

const V75PostRaceHeader: React.FC<V75PostRaceHeaderProps> = ({
  selectedDate,
  setSelectedDate,
  handleAnalyze,
  clearAnalysis,
  loading,
  hasAnalysis,
  error
}) => {
  const isNoPredictionsError = error.includes("No V75 predictions found");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          V75 Post-Race Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workflow Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">How Post-Race Analysis Works</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Step 1:</strong> First analyze a V75 date using the V75 Analyzer to create predictions</p>
                <p><strong>Step 2:</strong> Then return here to compare those predictions with actual race results</p>
                <p className="text-xs mt-2 text-blue-600">
                  💡 Post-race analysis requires existing predictions to compare against actual results.
                </p>
              </div>
              <div className="mt-3">
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-100" disabled>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  V75 Analyzer (Current Page)
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-64 justify-start text-left font-normal">
                <CalendarArrowDown className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Select analysis date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date > new Date() || date < new Date('2024-01-01')}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            onClick={handleAnalyze}
            disabled={!selectedDate || loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Analyze Results
          </Button>
          
          {hasAnalysis && (
            <Button 
              onClick={clearAnalysis}
              variant="outline"
            >
              Clear Analysis
            </Button>
          )}
        </div>

        {/* Progress */}
        {loading && (
          <ProgressIndicator progress={50} currentTask="Fetching race results and comparing with predictions..." />
        )}

        {/* Enhanced Error Display for No Predictions */}
        {error && (
          <div className="space-y-3">
            <ErrorDisplay error={error} />
            {isNoPredictionsError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">Next Steps:</h4>
                    <p className="text-sm text-amber-700 mb-3">
                      To analyze this date, you need to first create predictions using the V75 Analyzer.
                    </p>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled>
                      Use V75 Analyzer Above
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default V75PostRaceHeader;
