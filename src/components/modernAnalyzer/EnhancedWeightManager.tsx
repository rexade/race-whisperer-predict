import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, ChevronDown, ChevronUp, TrendingUp, Gauge } from 'lucide-react';
import { NormalizationWeights } from '../../services/modernKm/types';
import { getDefaultWeights } from '../../services/modernKm/index';
import { WEIGHT_PRESETS, WeightPreset } from '../../services/modernKm/presetWeights';

interface EnhancedWeightManagerProps {
  weights: NormalizationWeights;
  onWeightsChange: (weights: NormalizationWeights) => void;
  showPreview?: boolean;
}

interface WeightCategory {
  name: string;
  description: string;
  factors: Array<{
    key: keyof NormalizationWeights;
    label: string;
    description: string;
    range: [number, number];
    step: number;
    defaultValue: number;
    impact: 'low' | 'medium' | 'high';
  }>;
}

const WEIGHT_CATEGORIES: WeightCategory[] = [
  {
    name: 'Position & Setup',
    description: 'Starting position and race setup factors',
    factors: [
      {
        key: 'postPosition',
        label: 'Post Position',
        description: 'Impact of starting gate position',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.0,
        impact: 'high'
      },
      {
        key: 'volteStartDistancePenalty',
        label: 'Volte Start Penalty',
        description: 'Penalty for volte start vs auto',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.0,
        impact: 'medium'
      }
    ]
  },
  {
    name: 'Equipment',
    description: 'Horse equipment and gear adjustments',
    factors: [
      {
        key: 'shoeType',
        label: 'Shoe Type',
        description: 'Impact of shoe configuration',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.8,
        impact: 'medium'
      },
      {
        key: 'sulkyType',
        label: 'Sulky Type',
        description: 'Impact of sulky choice',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.6,
        impact: 'low'
      }
    ]
  },
  {
    name: 'Performance',
    description: 'Historical performance metrics',
    factors: [
      {
        key: 'driverPerformance',
        label: 'Driver Performance',
        description: 'Driver skill and experience',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.1,
        impact: 'high'
      },
      {
        key: 'form',
        label: 'Horse Form',
        description: 'Recent performance trend',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.2,
        impact: 'high'
      },
      {
        key: 'startPoints',
        label: 'Start Points',
        description: 'ATG start points rating',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.8,
        impact: 'medium'
      },
      {
        key: 'placePercentage',
        label: 'Place Percentage',
        description: 'Historical place percentage',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.9,
        impact: 'medium'
      },
      {
        key: 'horseWinPercentage',
        label: 'Win Percentage',
        description: 'Historical win percentage',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.0,
        impact: 'high'
      },
      {
        key: 'earningsPerStart',
        label: 'Earnings per Start',
        description: 'Average earnings performance',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.7,
        impact: 'medium'
      }
    ]
  },
  {
    name: 'Race Conditions',
    description: 'Race-specific conditions and adjustments',
    factors: [
      {
        key: 'distanceAdjustment',
        label: 'Distance Adjustment',
        description: 'Horse vs race distance difference',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.0,
        impact: 'medium'
      },
      {
        key: 'raceDistanceAdjustment',
        label: 'Race Distance Adjustment',
        description: 'Race distance from 2140m baseline',
        range: [0, 2],
        step: 0.1,
        defaultValue: 1.0,
        impact: 'high'
      },
      {
        key: 'trackFamiliarity',
        label: 'Track Familiarity',
        description: 'Home track advantage',
        range: [0, 2],
        step: 0.1,
        defaultValue: 0.7,
        impact: 'low'
      }
    ]
  }
];

export const EnhancedWeightManager: React.FC<EnhancedWeightManagerProps> = ({
  weights,
  onWeightsChange,
  showPreview = false
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Position & Setup']));
  const [showLowImpact, setShowLowImpact] = useState(true);

  const handleWeightChange = (factor: keyof NormalizationWeights, value: number[]) => {
    const newWeights = { ...weights, [factor]: value[0] };
    onWeightsChange(newWeights);
  };

  const applyPreset = (presetName: string) => {
    const preset = WEIGHT_PRESETS.find(p => p.name === presetName);
    if (preset) {
      onWeightsChange(preset.weights);
      setSelectedPreset(presetName);
    }
  };

  const resetToDefaults = () => {
    onWeightsChange(getDefaultWeights());
    setSelectedPreset('');
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const getImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };

  const getImpactIcon = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'high': return <TrendingUp className="h-3 w-3" />;
      case 'medium': return <Gauge className="h-3 w-3" />;
      case 'low': return <Settings className="h-3 w-3" />;
    }
  };

  const filteredCategories = WEIGHT_CATEGORIES.map(category => ({
    ...category,
    factors: category.factors.filter(factor => showLowImpact || factor.impact !== 'low')
  })).filter(category => category.factors.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Enhanced Weight Manager
        </CardTitle>
        <CardDescription>
          Control normalization factor weights with organized categories and presets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-low-impact"
                  checked={showLowImpact}
                  onCheckedChange={setShowLowImpact}
                />
                <Label htmlFor="show-low-impact">Show low impact factors</Label>
              </div>
              <Button onClick={resetToDefaults} variant="outline" size="sm">
                Reset to Defaults
              </Button>
            </div>

            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <Collapsible
                  key={category.name}
                  open={expandedCategories.has(category.name)}
                  onOpenChange={() => toggleCategory(category.name)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                      <div className="text-left">
                        <div className="font-medium">{category.name}</div>
                        <div className="text-sm text-muted-foreground">{category.description}</div>
                      </div>
                      {expandedCategories.has(category.name) ? 
                        <ChevronUp className="h-4 w-4" /> : 
                        <ChevronDown className="h-4 w-4" />
                      }
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {category.factors.map((factor) => (
                      <div key={factor.key} className="space-y-2 p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{factor.label}</span>
                            <Badge variant={getImpactColor(factor.impact)} className="flex items-center gap-1">
                              {getImpactIcon(factor.impact)}
                              {factor.impact}
                            </Badge>
                          </div>
                          <span className="text-sm font-mono">
                            {weights[factor.key].toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {factor.description}
                        </p>
                        <Slider
                          value={[weights[factor.key]]}
                          onValueChange={(value) => handleWeightChange(factor.key, value)}
                          min={factor.range[0]}
                          max={factor.range[1]}
                          step={factor.step}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{factor.range[0]}</span>
                          <span>Default: {factor.defaultValue}</span>
                          <span>{factor.range[1]}</span>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="presets" className="space-y-4">
            <div className="space-y-2">
              <Label>Weight Presets</Label>
              <Select value={selectedPreset} onValueChange={applyPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset configuration" />
                </SelectTrigger>
                <SelectContent>
                  {WEIGHT_PRESETS.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{preset.category}</Badge>
                        {preset.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              {WEIGHT_PRESETS.map((preset) => (
                <Card key={preset.name} className={`cursor-pointer transition-colors ${
                  selectedPreset === preset.name ? 'ring-2 ring-primary' : ''
                }`} onClick={() => applyPreset(preset.name)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{preset.name}</CardTitle>
                      <Badge variant="outline">{preset.category}</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {preset.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground">
                      Key differences: Post Position {preset.weights.postPosition}×, 
                      Driver {preset.weights.driverPerformance}×, 
                      Form {preset.weights.form}×
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button 
              onClick={() => setSelectedPreset('')} 
              variant="outline" 
              className="w-full"
              disabled={!selectedPreset}
            >
              Clear Preset Selection
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};