
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody } from "@/components/ui/table";
import { EnhancedHorseData } from '../services/enhancedAtgApi';
import { ModernNormalizedResult } from '../services/modernNormalization';
import TableHeader from './modernTable/TableHeader';
import TableColumns from './modernTable/TableColumns';
import HorseRow from './modernTable/HorseRow';
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
  // Combine horse data with results and sort by modern normalized time
  const combinedData = horses.map((horse, index) => ({
    ...horse,
    result: results[index]
  })).sort((a, b) => (a.result?.modernNormalizedTime || 999) - (b.result?.modernNormalizedTime || 999));

  return (
    <Card className="border-purple-200 shadow-lg">
      <TableHeader horseCount={combinedData.length} raceInfo={raceInfo} />
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableColumns />
            <TableBody>
              {combinedData.map((horse, index) => {
                const result = horse.result;
                if (!result) return null;
                
                const rank = index + 1;
                
                return (
                  <HorseRow
                    key={horse.horseId}
                    horse={horse}
                    result={result}
                    rank={rank}
                  />
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <TableFooter />
      </CardContent>
    </Card>
  );
};

export default ModernNormalizationTable;
