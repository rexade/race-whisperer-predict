
import React from 'react';
import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-800">Error</h3>
      </div>
      <p className="text-red-700 mt-1">{error}</p>
    </div>
  );
};

export default ErrorDisplay;
