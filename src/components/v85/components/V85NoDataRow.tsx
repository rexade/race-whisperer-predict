
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { V75HorseResult } from '../hooks/useV75Analysis';
import { ensureStringForDisplay } from '../utils/v75DisplayUtils';

interface V75NoDataRowProps {
  horse: V75HorseResult;
}

const V75NoDataRow: React.FC<V75NoDataRowProps> = ({ horse }) => {
  // Ensure horse name is always a string for horses without times too
  const safeHorseName = ensureStringForDisplay(horse.horseName);
  const safeDriverName = ensureStringForDisplay(horse.driverName);
  
  

  return (
    <TableRow className="opacity-50">
      <TableCell>-</TableCell>
      <TableCell className="text-center">{horse.postPosition}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium text-gray-900">{safeHorseName}</div>
          <div className="text-sm text-gray-600">{safeDriverName}</div>
        </div>
      </TableCell>
      <TableCell className="text-center text-gray-400">No data</TableCell>
      <TableCell className="text-center text-gray-400">No data</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
      <TableCell className="text-center text-gray-400">-</TableCell>
    </TableRow>
  );
};

export default V75NoDataRow;
