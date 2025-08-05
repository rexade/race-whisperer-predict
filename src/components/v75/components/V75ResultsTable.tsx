
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { V75RaceResult } from '../hooks/useV75Analysis';
import V75HorseRow from './V75HorseRow';
import V75NoDataRow from './V75NoDataRow';

interface V75ResultsTableProps {
  race: V75RaceResult;
}

const V75ResultsTable: React.FC<V75ResultsTableProps> = ({ race }) => {
  // Sort horses by normalized time (fastest first)
  const sortedHorses = race.horses
    .filter(horse => horse.modernNormalizedResult)
    .sort((a, b) => {
      const timeA = a.modernNormalizedResult!.modernNormalizedTime;
      const timeB = b.modernNormalizedResult!.modernNormalizedTime;
      
      const totalSecondsA = timeA.minutes * 60 + timeA.seconds + timeA.tenths / 10;
      const totalSecondsB = timeB.minutes * 60 + timeB.seconds + timeB.tenths / 10;
      
      return totalSecondsA - totalSecondsB;
    });

  const horsesWithoutTimes = race.horses.filter(horse => !horse.modernNormalizedResult);

  return (
    <Card className="border-primary/20 shadow-lg bg-card">
      <CardHeader className="bg-atg-light-blue/50">
        <CardTitle className="text-primary">Enhanced Race Analysis (Sorted by Normalized Time)</CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-atg-light-blue hover:bg-atg-light-blue/80">
                <TableHead className="w-12 text-center text-xs sm:text-sm sticky left-0 bg-atg-light-blue z-10 text-primary font-medium">Rank</TableHead>
                <TableHead className="w-10 text-center text-xs sm:text-sm text-primary font-medium">Start</TableHead>
                <TableHead className="min-w-[120px] text-xs sm:text-sm text-primary font-medium">Horse & Driver</TableHead>
                <TableHead className="w-20 text-center text-xs sm:text-sm text-primary font-medium">RAW</TableHead>
                <TableHead className="w-20 text-center font-bold text-xs sm:text-sm text-atg-blue">Modern</TableHead>
                <TableHead className="w-20 text-center font-bold text-xs sm:text-sm text-atg-yellow">REKORD</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Points</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Place%</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Win%</TableHead>
                <TableHead className="w-20 text-center text-xs sm:text-sm text-primary font-medium">Earnings</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Driver</TableHead>
                <TableHead className="w-14 text-center text-xs sm:text-sm text-primary font-medium">Sulky</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Shoes</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Track</TableHead>
                <TableHead className="w-16 text-center text-xs sm:text-sm text-primary font-medium">Dist</TableHead>
                <TableHead className="w-20 text-center font-bold text-xs sm:text-sm text-primary">Adj</TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {sortedHorses.map((horse, index) => (
                <V75HorseRow 
                  key={horse.horseId}
                  horse={horse}
                  rank={index + 1}
                />
              ))}
              
              {horsesWithoutTimes.map(horse => (
                <V75NoDataRow 
                  key={horse.horseId}
                  horse={horse}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        
        {horsesWithoutTimes.length > 0 && (
          <div className="p-4 bg-muted border-t">
            <p className="text-sm text-muted-foreground">
              {horsesWithoutTimes.length} horse(s) could not be analyzed due to insufficient historical data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default V75ResultsTable;
