
import React from 'react';
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const AnalyzerHeader: React.FC = () => {
  return (
    <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
      <CardTitle className="text-2xl text-purple-800 flex items-center gap-2">
        <Sparkles className="h-6 w-6" />
        Modern Normalization Analyzer
      </CardTitle>
      <p className="text-purple-600">
        Advanced RAW time normalization using race-specific factors and adjustable weights
      </p>
    </CardHeader>
  );
};

export default AnalyzerHeader;
