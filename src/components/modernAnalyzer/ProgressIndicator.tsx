
import React from 'react';
import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  progress: number;
  currentTask: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, currentTask }) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{currentTask}</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="w-full" />
    </div>
  );
};

export default ProgressIndicator;
