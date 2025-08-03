import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, TrendingUp, AlertTriangle, Target, Download } from 'lucide-react';
import { NormalizationWeights } from '../../services/modernKm/types';
import { FactorContribution } from '../../services/modernKm/calculationPreview';
import { analyzeFactorImpacts, FactorImpactAnalysis as ImpactAnalysis } from '../../services/modernKm/factorAnalysis';

interface FactorImpactAnalysisProps {
  contributionHistory: FactorContribution[][];
  weights: NormalizationWeights;
  onWeightSuggestion?: (factor: string, suggestedWeight: number) => void;
}

export const FactorImpactAnalysis: React.FC<FactorImpactAnalysisProps> = ({
  contributionHistory,
  weights,
  onWeightSuggestion
}) => {
  const [analysis, setAnalysis] = useState<ImpactAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (contributionHistory.length > 0) {
      setIsAnalyzing(true);
      // Simulate analysis delay for UX
      setTimeout(() => {
        const newAnalysis = analyzeFactorImpacts(contributionHistory, weights);
        setAnalysis(newAnalysis);
        setIsAnalyzing(false);
      }, 500);
    }
  }, [contributionHistory, weights]);

  const exportAnalysis = () => {
    if (!analysis) return;
    
    const report = {
      timestamp: new Date().toISOString(),
      analysisData: analysis,
      contributionSamples: contributionHistory.length,
      currentWeights: weights
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factor-impact-analysis-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'equipment': return 'hsl(var(--primary))';
      case 'performance': return 'hsl(var(--secondary))';
      case 'race': return 'hsl(var(--accent))';
      case 'position': return 'hsl(var(--muted))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.7) return 'hsl(var(--destructive))';
    if (abs >= 0.4) return 'hsl(var(--warning))';
    return 'hsl(var(--muted-foreground))';
  };

  if (contributionHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Factor Impact Analysis
          </CardTitle>
          <CardDescription>
            Analyze factor effectiveness and correlations (requires calculation history)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No calculation history available yet.</p>
            <p className="text-sm">Use the calculation preview to generate data for analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Factor Impact Analysis
          {isAnalyzing && <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
        </CardTitle>
        <CardDescription>
          Analysis of factor effectiveness based on {contributionHistory.length} calculations
        </CardDescription>
        <Button onClick={exportAnalysis} variant="outline" size="sm" className="w-fit">
          <Download className="h-4 w-4 mr-2" />
          Export Analysis
        </Button>
      </CardHeader>
      <CardContent>
        {analysis && (
          <Tabs defaultValue="distribution" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="distribution">Factor Distribution</TabsTrigger>
              <TabsTrigger value="effectiveness">Weight Effectiveness</TabsTrigger>
              <TabsTrigger value="correlations">Correlations</TabsTrigger>
            </TabsList>

            <TabsContent value="distribution" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Average Impact by Factor</h4>
                {analysis.factorDistribution
                  .sort((a, b) => b.averageImpact - a.averageImpact)
                  .map((factor) => (
                  <div key={factor.factor} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{factor.factor}</span>
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: getCategoryColor(factor.category) }}
                        >
                          {factor.category}
                        </Badge>
                      </div>
                      <span className="text-sm font-mono">
                        {factor.averageImpact.toFixed(3)}s avg
                      </span>
                    </div>
                    <Progress 
                      value={(factor.averageImpact / analysis.factorDistribution[0]?.averageImpact || 1) * 100} 
                      className="h-2" 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Max: {factor.maxImpact.toFixed(3)}s</span>
                      <span>Active: {(factor.frequency * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="effectiveness" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Weight Optimization Suggestions</h4>
                {analysis.weightEffectiveness
                  .sort((a, b) => b.improvement - a.improvement)
                  .map((suggestion) => (
                  <div key={suggestion.factor} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{suggestion.factor}</span>
                      <div className="flex items-center gap-2">
                        {suggestion.improvement > 0.2 && (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        )}
                        <Badge variant={suggestion.improvement > 0.2 ? 'destructive' : 'secondary'}>
                          {(suggestion.improvement * 100).toFixed(0)}% change
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Current: {suggestion.currentWeight.toFixed(1)}</span>
                      <span>Suggested: {suggestion.suggestedWeight.toFixed(1)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.reasoning}
                    </p>
                    {suggestion.improvement > 0.1 && onWeightSuggestion && (
                      <Button
                        onClick={() => onWeightSuggestion(suggestion.factor, suggestion.suggestedWeight)}
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                      >
                        <Target className="h-3 w-3 mr-2" />
                        Apply Suggestion
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="correlations" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Factor Correlations</h4>
                <p className="text-sm text-muted-foreground">
                  High correlations may indicate redundant factors or systematic dependencies
                </p>
                {analysis.correlations
                  .filter(corr => Math.abs(corr.correlation) > 0.2)
                  .map((correlation, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {correlation.factor1} ↔ {correlation.factor2}
                      </span>
                      <Badge 
                        variant="outline"
                        style={{ borderColor: getCorrelationColor(correlation.correlation) }}
                      >
                        {correlation.significance}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Correlation:</span>
                      <span 
                        className="font-mono text-sm"
                        style={{ color: getCorrelationColor(correlation.correlation) }}
                      >
                        {correlation.correlation.toFixed(3)}
                      </span>
                      <Progress 
                        value={Math.abs(correlation.correlation) * 100} 
                        className="flex-1 h-2" 
                      />
                    </div>
                    {Math.abs(correlation.correlation) > 0.6 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ⚠️ Strong correlation detected - consider if both factors are necessary
                      </p>
                    )}
                  </div>
                ))}
                {analysis.correlations.filter(corr => Math.abs(corr.correlation) > 0.2).length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No significant correlations detected</p>
                    <p className="text-sm">All factors appear to operate independently</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};