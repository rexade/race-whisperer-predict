
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, RotateCcw } from "lucide-react";
import { NormalizationWeights, getDefaultWeights } from '../services/modernNormalization';

interface WeightManagerProps {
  weights: NormalizationWeights;
  onWeightsChange: (weights: NormalizationWeights) => void;
}

const WeightManager: React.FC<WeightManagerProps> = ({ weights, onWeightsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleWeightChange = (factor: keyof NormalizationWeights, value: number[]) => {
    const newWeights = {
      ...weights,
      [factor]: value[0]
    };
    onWeightsChange(newWeights);
  };

  const resetToDefaults = () => {
    onWeightsChange(getDefaultWeights());
  };

  const weightFactors = [
    { key: 'postPosition' as keyof NormalizationWeights, label: 'Post Position', description: 'Impact of starting position' },
    { key: 'shoeType' as keyof NormalizationWeights, label: 'Shoe Type', description: 'Barefoot vs shod advantages' },
    { key: 'sulkyType' as keyof NormalizationWeights, label: 'Sulky Type', description: 'American vs Volvo sulky impact' },
    { key: 'driverExperience' as keyof NormalizationWeights, label: 'Driver Experience', description: 'Driver skill and experience' },
    { key: 'driver2025Performance' as keyof NormalizationWeights, label: 'Driver 2025 Performance', description: 'Current year win percentage' },
    { key: 'trackFamiliarity' as keyof NormalizationWeights, label: 'Track Familiarity', description: 'Home track advantage' },
    { key: 'form' as keyof NormalizationWeights, label: 'Recent Form', description: 'Current performance trend' }
  ];

  return (
    <Card className="border-blue-200">
      <CardHeader 
        className="cursor-pointer bg-gradient-to-r from-blue-50 to-indigo-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-blue-800">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Normalization Weights
          </div>
          <Badge variant="outline" className="border-blue-300">
            {isExpanded ? 'Collapse' : 'Expand'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6 pt-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Adjust the weights to control how much each factor affects the final normalized time.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetToDefaults}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
          
          <div className="grid gap-6">
            {weightFactors.map((factor) => (
              <div key={factor.key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="font-medium">{factor.label}</Label>
                    <p className="text-xs text-gray-500">{factor.description}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {weights[factor.key].toFixed(1)}
                  </Badge>
                </div>
                <Slider
                  value={[weights[factor.key]]}
                  onValueChange={(value) => handleWeightChange(factor.key, value)}
                  max={2.0}
                  min={0.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0.0 (No impact)</span>
                  <span>2.0 (High impact)</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Weight Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {weightFactors.map((factor) => (
                <div key={factor.key} className="flex justify-between">
                  <span className="text-blue-700">{factor.label}:</span>
                  <span className="font-mono font-medium">{weights[factor.key].toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default WeightManager;
