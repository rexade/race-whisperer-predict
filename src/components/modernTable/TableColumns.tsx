
import React from 'react';
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TableColumns: React.FC = () => {
  return (
    <TableHeader>
      <TableRow className="bg-purple-50">
        <TableHead className="w-16 text-center">Rank</TableHead>
        <TableHead className="w-12 text-center">Start</TableHead>
        <TableHead className="min-w-[150px]">Horse & Driver</TableHead>
        <TableHead className="w-20 text-center">Start Points</TableHead>
        <TableHead className="w-20 text-center">Place %</TableHead>
        <TableHead className="w-20 text-center">Horse Win%</TableHead>
        <TableHead className="w-20 text-center">Earnings/Start</TableHead>
        <TableHead className="w-20 text-center">Driver Win%</TableHead>
        <TableHead className="w-20 text-center">Driver 2025%</TableHead>
        <TableHead className="w-20 text-center">Driver Exp</TableHead>
        <TableHead className="w-20 text-center">Sulky</TableHead>
        <TableHead className="w-24 text-center">Shoes</TableHead>
        <TableHead className="w-20 text-center">Home Track</TableHead>
        <TableHead className="w-24 text-center">RAW Time</TableHead>
        <TableHead className="w-24 text-center font-bold">Modern Time</TableHead>
        <TableHead className="w-20 text-center">Km Time</TableHead>
        <TableHead className="w-24 text-center font-bold">Total Adj</TableHead>
      </TableRow>
    </TableHeader>
  );
};

export default TableColumns;
