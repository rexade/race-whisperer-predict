
import React from 'react';

interface AnalyzerLayoutProps {
  children: React.ReactNode;
}

const AnalyzerLayout: React.FC<AnalyzerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-6 p-1 sm:p-6">
        {children}
      </div>
    </div>
  );
};

export default AnalyzerLayout;
