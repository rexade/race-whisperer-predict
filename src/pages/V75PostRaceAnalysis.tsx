
import React from 'react';
import DebugErrorBoundary from "../components/DebugErrorBoundary";
import AnalyzerLayout from "../components/shared/analyzer/AnalyzerLayout";
import V75PostRaceAnalysis from "../components/v75/components/V75PostRaceAnalysis";

const V75PostRaceAnalysisPage: React.FC = () => {
  return (
    <DebugErrorBoundary>
      <AnalyzerLayout>
        <V75PostRaceAnalysis />
      </AnalyzerLayout>
    </DebugErrorBoundary>
  );
};

export default V75PostRaceAnalysisPage;
