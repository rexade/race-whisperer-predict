
import React, { useState, useEffect } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Trophy } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { fetchV75CalendarDates, V75CalendarDate } from '../../services/v75CalendarApi';

interface V75DatePickerProps {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  onV75DataSelect: (v75Data: V75CalendarDate | undefined) => void;
}

const V75DatePicker: React.FC<V75DatePickerProps> = ({ 
  selectedDate, 
  onDateSelect, 
  onV75DataSelect 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [v75Dates, setV75Dates] = useState<V75CalendarDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadV75Dates = async (date: Date) => {
    setLoading(true);
    try {
      const dates = await fetchV75CalendarDates(date.getFullYear(), date.getMonth() + 1);
      setV75Dates(dates);
    } catch (error) {
      console.error('Error loading V75 dates:', error);
      setV75Dates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadV75Dates(currentMonth);
  }, [currentMonth]);

  const handleDateSelect = (date: Date | undefined) => {
    onDateSelect(date);
    
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const v75Data = v75Dates.find(v75 => v75.date === dateStr);
      onV75DataSelect(v75Data);
      setIsOpen(false);
    } else {
      onV75DataSelect(undefined);
    }
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev' 
      ? subMonths(currentMonth, 1) 
      : addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
  };

  const getV75DatesAsDateObjects = () => {
    return v75Dates.map(v75 => new Date(v75.date));
  };

  const modifiers = {
    v75: getV75DatesAsDateObjects(),
  };

  const modifiersStyles = {
    v75: {
      backgroundColor: '#7c3aed',
      color: 'white',
      fontWeight: 'bold',
    },
  };

  const selectedV75Data = selectedDate 
    ? v75Dates.find(v75 => v75.date === format(selectedDate, 'yyyy-MM-dd'))
    : undefined;

  return (
    <div className="space-y-4">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? (
              <div className="flex items-center gap-2">
                <span>{format(selectedDate, "PPP")}</span>
                {selectedV75Data && (
                  <div className="flex items-center gap-1 text-purple-600">
                    <Trophy className="h-3 w-3" />
                    <span className="text-xs font-medium">V75</span>
                  </div>
                )}
              </div>
            ) : (
              <span>Select V75 date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMonthChange('prev')}
                disabled={loading}
              >
                ←
              </Button>
              <h3 className="font-medium">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMonthChange('next')}
                disabled={loading}
              >
                →
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-4 text-sm text-gray-500">
                Loading V75 dates...
              </div>
            ) : (
              <>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  disabled={(date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    return !v75Dates.some(v75 => v75.date === dateStr);
                  }}
                  className={cn("p-3 pointer-events-auto")}
                />
                
                <div className="mt-3 p-2 bg-purple-50 rounded-md">
                  <div className="flex items-center gap-2 text-xs text-purple-700">
                    <Trophy className="h-3 w-3" />
                    <span>Purple dates have V75 races</span>
                  </div>
                  {v75Dates.length > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      {v75Dates.length} V75 date(s) available this month
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedV75Data && (
        <Card className="border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-purple-600" />
              {selectedV75Data.eventName}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{format(selectedDate!, 'PPP')}</span>
              </div>
              <div className="flex justify-between">
                <span>Races:</span>
                <span>{selectedV75Data.races.length} races</span>
              </div>
              {selectedV75Data.races.length > 0 && (
                <div className="flex justify-between">
                  <span>Tracks:</span>
                  <span>{Array.from(new Set(selectedV75Data.races.map(r => r.track))).join(', ')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75DatePicker;
