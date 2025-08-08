
import React from 'react';
import SectionHeader from "@/components/shared/SectionHeader";
import { Sparkles } from "lucide-react";

const AnalyzerHeader: React.FC = () => {
  return (
      <SectionHeader
        title="Modern Normalization Analyzer"
        subtitle="Advanced RAW time normalization using race-specific factors and adjustable weights"
        icon={Sparkles}
      />
  );
};

export default AnalyzerHeader;
