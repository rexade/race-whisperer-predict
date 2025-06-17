
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { EnhancedHorseData } from '../services/enhancedAtgApi';
import { ModernNormalizedResult } from '../services/modernNormalization';
import TableHeader from './modernTable/TableHeader';
import TableContainer from './modernTable/TableContainer';
import TableFooter from './modernTable/TableFooter';

interface ModernNormalizationTableProps {
  horses: EnhancedHorseData[];
  results: ModernNormalizedResult[];
  raceInfo: {
    raceId: string;
    raceNumber: number;
    distance: number;
    startMethod: string;
    track: string;
    name: string;
    date: string;
    prize: number;
  };
}

const ModernNormalizationTable: React.FC<ModernNormalizationTableProps> = ({ 
  horses, 
  results, 
  raceInfo 
}) => {
  return (
    <Card className="border-purple-200 shadow-lg">
      <TableHeader horseCount={horses.length} raceInfo={raceInfo} />
      
      <CardContent className="p-0">
        <TableContainer horses={horses} results={results} />
        <TableFooter />
      </CardContent>
    </Card>
  );
};

export default ModernNormalizationTable;
