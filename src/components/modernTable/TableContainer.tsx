
import React from 'react';
import { Table, TableBody } from "@/components/ui/table";
import { EnhancedHorseData } from '../../services/enhancedAtgApi';
import { ModernNormalizedResult } from '../../services/modernNormalization';
import TableColumns from './TableColumns';
import HorseRow from './HorseRow';

interface TableContainerProps {
  horses: EnhancedHorseData[];
  results: ModernNormalizedResult[];
}

const TableContainer: React.FC<TableContainerProps> = ({ horses, results }) => {
  // Combine horse data with results and sort by modern normalized time
  const combinedData = horses.map((horse, index) => ({
    ...horse,
    result: results[index]
  })).sort((a, b) => (a.result?.modernNormalizedTime || 999) - (b.result?.modernNormalizedTime || 999));

  return (
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
  );
};

export default TableContainer;
