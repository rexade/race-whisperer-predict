
import React from 'react';
import { Clock, Trophy, Banknote, Medal } from "lucide-react";

const TableFooter: React.FC = () => {
  return (
    <div className="p-4 bg-gradient-to-r from-gray-50 to-purple-50 border-t">
      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>Complete horse & driver analysis</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4" />
          <span>All statistical data points</span>
        </div>
        <div className="flex items-center gap-1">
          <Banknote className="h-4 w-4" />
          <span>Financial & performance metrics</span>
        </div>
        <div className="flex items-center gap-1">
          <Medal className="h-4 w-4" />
          <span>Equipment & track details</span>
        </div>
      </div>
    </div>
  );
};

export default TableFooter;
