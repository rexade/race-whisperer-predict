import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Calculator, Settings, BarChart, Bug } from 'lucide-react';
import { NormalizationWeights, getDefaultWeights } from '../../services/modernKm/index';
import { FactorContribution } from '../../services/modernKm/calculationPreview';
import { CalculationPreviewPanel } from './CalculationPreviewPanel';
import { EnhancedWeightManager } from './EnhancedWeightManager';
import { FactorImpactAnalysis } from './FactorImpactAnalysis';
import { DebugAnalysisPanel } from './DebugAnalysisPanel';

export const EnhancedModernAnalyzer: React.FC = () => {
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const [contributionHistory, setContributionHistory] = useState<FactorContribution[][]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['preview']));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Mark as having changes when weights change from defaults
    const defaultWeights = getDefaultWeights();
    const hasChanges = Object.keys(weights).some(key => 
      weights[key as keyof NormalizationWeights] !== defaultWeights[key as keyof NormalizationWeights]
    );
    setHasChanges(hasChanges);
  }, [weights]);

  const handleWeightsChange = (newWeights: NormalizationWeights) => {
    setWeights(newWeights);
  };

  const handleWeightSuggestion = (factor: string, suggestedWeight: number) => {
    // Map factor names to weight keys
    const factorToWeightMap: Record<string, keyof NormalizationWeights> = {
      postPosition: 'postPosition',
      shoes: 'shoeType',
      sulky: 'sulkyType',
      driver: 'driverPerformance',
      distance: 'distanceAdjustment',
      raceDistance: 'raceDistanceAdjustment',
      trackFamiliarity: 'trackFamiliarity',
      volteStart: 'volteStartDistancePenalty',
      startPoints: 'startPoints',
      placePercentage: 'placePercentage',
      horseWinPercentage: 'horseWinPercentage',
      earningsPerStart: 'earningsPerStart'
    };

    const weightKey = factorToWeightMap[factor];
    if (weightKey) {
      setWeights(prev => ({ ...prev, [weightKey]: suggestedWeight }));
    }
  };

  const addToContributionHistory = (contributions: FactorContribution[]) => {
    setContributionHistory(prev => [...prev.slice(-19), contributions]); // Keep last 20
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const resetToDefaults = () => {
    setWeights(getDefaultWeights());
    setHasChanges(false);
  };

  const sections = [
    {
      id: 'preview',
      title: 'Calculation Preview',
      description: 'Real-time calculation testing and experimentation',
      icon: Calculator,
      component: (
        <CalculationPreviewPanel 
          weights={weights} 
          onWeightsChange={handleWeightsChange}
        />
      )
    },
    {
      id: 'weights',
      title: 'Weight Management',
      description: 'Control normalization factor weights with presets and categories',
      icon: Settings,
      component: (
        <EnhancedWeightManager 
          weights={weights} 
          onWeightsChange={handleWeightsChange}
        />
      )
    },
    {
      id: 'analysis',
      title: 'Factor Impact Analysis',
      description: 'Analyze factor effectiveness and optimization suggestions',
      icon: BarChart,
      component: (
        <FactorImpactAnalysis 
          contributionHistory={contributionHistory}
          weights={weights}
          onWeightSuggestion={handleWeightSuggestion}
        />
      )
    },
    {
      id: 'debug',
      title: 'Debug & Testing',
      description: 'Advanced debugging tools and what-if scenarios',
      icon: Bug,
      component: (
        <DebugAnalysisPanel 
          weights={weights}
          contributionHistory={contributionHistory}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Enhanced Modern Normalization</h1>
            <p className="text-muted-foreground">
              Advanced control and analysis tools for modern KM normalization
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Modified
              </Badge>
            )}
            {contributionHistory.length > 0 && (
              <Badge variant="secondary">
                {contributionHistory.length} calculations
              </Badge>
            )}
            <Button onClick={resetToDefaults} variant="outline" size="sm">
              Reset All
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Interface */}
      <div className="space-y-4">
        {sections.map((section) => (
          <Collapsible
            key={section.id}
            open={expandedSections.has(section.id)}
            onOpenChange={() => toggleSection(section.id)}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between p-4 h-auto border border-border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 text-left">
                  <section.icon className="h-5 w-5" />
                  <div>
                    <div className="font-medium">{section.title}</div>
                    <div className="text-sm text-muted-foreground">{section.description}</div>
                  </div>
                </div>
                {expandedSections.has(section.id) ? 
                  <ChevronUp className="h-4 w-4" /> : 
                  <ChevronDown className="h-4 w-4" />
                }
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              {section.component}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Quick Stats */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{Object.keys(weights).length}</div>
            <div className="text-sm text-muted-foreground">Weight Factors</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{contributionHistory.length}</div>
            <div className="text-sm text-muted-foreground">Calculations</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {contributionHistory.length > 0 
                ? (contributionHistory[contributionHistory.length - 1]?.filter(c => Math.abs(c.weightedAdjustment) > 0.01).length || 0)
                : 0
              }
            </div>
            <div className="text-sm text-muted-foreground">Active Factors</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {contributionHistory.length > 0 
                ? contributionHistory[contributionHistory.length - 1]?.reduce((sum, c) => sum + Math.abs(c.weightedAdjustment), 0).toFixed(2) || '0.00'
                : '0.00'
              }
            </div>
            <div className="text-sm text-muted-foreground">Total Impact (s)</div>
          </div>
        </div>
      </Card>
    </div>
  );
};