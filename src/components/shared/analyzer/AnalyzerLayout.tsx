
import React from 'react';

interface AnalyzerLayoutProps {
  children: React.ReactNode;
}

const AnalyzerLayout: React.FC<AnalyzerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto space-y-3 p-0 sm:p-6">
        {children}
      </div>
    </div>
  );
};

export default AnalyzerLayout;
