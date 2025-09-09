import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, RotateCcw, ChevronDown, ChevronRight, Save, Upload, Download } from "lucide-react";
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';
import { useToast } from "@/hooks/use-toast";

interface WeightManagerProps {
  weights: NormalizationWeights;
  onWeightsChange: (weights: NormalizationWeights) => void;
}

const WeightManager: React.FC<WeightManagerProps> = ({ weights, onWeightsChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    equipment: true,
    performance: true,
    driver: true,
    distance: true
  });
  const { toast } = useToast();

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

  const saveAsDefault = () => {
    try {
      localStorage.setItem('customDefaultWeights', JSON.stringify(weights));
      toast({
        title: "Default Weights Saved",
        description: "Current weights have been saved as your new defaults.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save default weights. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadCustomDefaults = () => {
    try {
      const saved = localStorage.getItem('customDefaultWeights');
      if (saved) {
        const customDefaults = JSON.parse(saved);
        onWeightsChange(customDefaults);
        toast({
          title: "Custom Defaults Loaded",
          description: "Your saved default weights have been applied.",
        });
      } else {
        toast({
          title: "No Custom Defaults",
          description: "No custom default weights found. Save current weights first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "Failed to load custom defaults. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportWeights = () => {
    try {
      const dataStr = JSON.stringify(weights, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'v75-weights-config.json';
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Weights Exported",
        description: "Weight configuration downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export weights. Please try again.",
        variant: "destructive",
      });
    }
  };

  const importWeights = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target?.result as string);
            onWeightsChange(imported);
            toast({
              title: "Weights Imported",
              description: "Weight configuration imported successfully.",
            });
          } catch (error) {
            toast({
              title: "Import Failed",
              description: "Invalid weight configuration file.",
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const weightCategories = [
    {
      id: 'equipment',
      title: 'Equipment & Position',
      description: 'Hardware and starting position factors',
      factors: [
        { key: 'postPosition' as keyof NormalizationWeights, label: 'Post Position', description: 'Impact of starting position' },
        { key: 'shoeType' as keyof NormalizationWeights, label: 'Shoe Type', description: 'Barefoot vs shod advantages' },
        { key: 'sulkyType' as keyof NormalizationWeights, label: 'Sulky Type', description: 'American vs Volvo sulky impact' },
      ]
    },
    {
      id: 'performance',
      title: 'Performance Metrics',
      description: 'Horse performance and consistency indicators',
      factors: [
        { key: 'form' as keyof NormalizationWeights, label: 'Recent Form', description: 'Current performance trend' },
        { key: 'startPoints' as keyof NormalizationWeights, label: 'Start Points', description: 'Horse form based on start points', isNew: true },
        { key: 'placePercentage' as keyof NormalizationWeights, label: 'Place Percentage', description: 'Horse consistency in placing', isNew: true },
        { key: 'horseWinPercentage' as keyof NormalizationWeights, label: 'Horse Win Percentage', description: 'Horse quality and ability', isNew: true },
        { key: 'earningsPerStart' as keyof NormalizationWeights, label: 'Earnings Per Start', description: 'Horse earning power and class', isNew: true }
      ]
    },
    {
      id: 'driver',
      title: 'Driver & Track',
      description: 'Driver skill and track familiarity factors',
      factors: [
        { key: 'driverPerformance' as keyof NormalizationWeights, label: 'Driver Performance', description: 'Driver win percentage and skill' },
        { key: 'trackFamiliarity' as keyof NormalizationWeights, label: 'Track Familiarity', description: 'Home track advantage' },
      ]
    },
    {
      id: 'distance',
      title: 'Distance Adjustments',
      description: 'Race and individual distance normalization',
      factors: [
        { key: 'distanceAdjustment' as keyof NormalizationWeights, label: 'Distance Adjustment', description: 'Individual vs race distance differences' },
        { key: 'raceDistanceAdjustment' as keyof NormalizationWeights, label: 'Race Distance Adjustment', description: 'Non-linear normalization from 2140m reference to actual race distance', isNew: true },
        { key: 'volteStartDistancePenalty' as keyof NormalizationWeights, label: 'Volte Start Distance Penalty', description: 'Penalty for horses starting at different distance in volte races', isNew: true },
      ]
    }
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
            Enhanced Normalization Weights
          </div>
          <Badge variant="outline" className="border-blue-300">
            {isExpanded ? 'Collapse' : 'Expand'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6 pt-6">
          <div className="flex justify-between items-start gap-4">
            <p className="text-sm text-gray-600">
              Adjust the weights to control how much each factor affects the final normalized time. 
              <span className="font-medium text-blue-600">New: Performance metrics baseline adjustments!</span>
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetToDefaults}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Factory Reset
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadCustomDefaults}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Load My Defaults
                </Button>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={saveAsDefault}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save as Default
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportWeights}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={importWeights}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {weightCategories.map((category) => (
              <Collapsible
                key={category.id}
                open={expandedCategories[category.id]}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="text-left">
                      <h3 className="font-medium text-gray-900">{category.title}</h3>
                      <p className="text-sm text-gray-500">{category.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {category.factors.length} factors
                      </Badge>
                      {expandedCategories[category.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                    {category.factors.map((factor) => (
                      <div key={factor.key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <Label className="font-medium flex items-center gap-2">
                              {factor.label}
                              {factor.isNew && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">NEW</Badge>
                              )}
                            </Label>
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
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Enhanced Weight Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {weightCategories.flatMap(category => category.factors).map((factor) => (
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
