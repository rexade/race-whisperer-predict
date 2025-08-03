import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bug, Download, Play, ChevronDown, ChevronUp, Lightbulb, FileText } from 'lucide-react';
import { NormalizationWeights } from '../../services/modernKm/types';
import { FactorContribution, calculatePreview, getSampleFactors } from '../../services/modernKm/calculationPreview';
import { KmTime } from '../../services/types/kmTimeTypes';

interface DebugAnalysisPanelProps {
  weights: NormalizationWeights;
  contributionHistory: FactorContribution[][];
}

interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  factors: any;
  baseTime: KmTime;
  results?: any;
}

interface DebugSession {
  id: string;
  timestamp: string;
  scenarios: WhatIfScenario[];
  weights: NormalizationWeights;
  notes: string;
}

export const DebugAnalysisPanel: React.FC<DebugAnalysisPanelProps> = ({
  weights,
  contributionHistory
}) => {
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string>('');
  const [debugNotes, setDebugNotes] = useState('');
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initialize with sample scenarios
    if (scenarios.length === 0) {
      setScenarios([
        {
          id: 'scenario-1',
          name: 'Post Position Comparison',
          description: 'Compare impact of different starting positions',
          factors: getSampleFactors(),
          baseTime: { minutes: 1, seconds: 15, tenths: 5 }
        },
        {
          id: 'scenario-2',
          name: 'Equipment Variations',
          description: 'Test different shoe and sulky combinations',
          factors: { ...getSampleFactors(), shoesFront: '0', shoesBack: '0', sulkyType: 'AM' },
          baseTime: { minutes: 1, seconds: 15, tenths: 5 }
        }
      ]);
    }
  }, [scenarios.length]);

  const runScenario = (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const results = calculatePreview(scenario.baseTime, scenario.factors, weights);
    
    setScenarios(prev => prev.map(s => 
      s.id === scenarioId ? { ...s, results } : s
    ));
  };

  const runAllScenarios = () => {
    scenarios.forEach(scenario => runScenario(scenario.id));
  };

  const addScenario = () => {
    const newScenario: WhatIfScenario = {
      id: `scenario-${Date.now()}`,
      name: `Scenario ${scenarios.length + 1}`,
      description: 'Custom scenario',
      factors: getSampleFactors(),
      baseTime: { minutes: 1, seconds: 15, tenths: 5 }
    };
    setScenarios(prev => [...prev, newScenario]);
    setActiveScenario(newScenario.id);
  };

  const updateScenario = (scenarioId: string, updates: Partial<WhatIfScenario>) => {
    setScenarios(prev => prev.map(s => 
      s.id === scenarioId ? { ...s, ...updates } : s
    ));
  };

  const deleteScenario = (scenarioId: string) => {
    setScenarios(prev => prev.filter(s => s.id !== scenarioId));
    if (activeScenario === scenarioId) {
      setActiveScenario('');
    }
  };

  const exportDebugSession = () => {
    const session: DebugSession = {
      id: `debug-${Date.now()}`,
      timestamp: new Date().toISOString(),
      scenarios,
      weights,
      notes: debugNotes
    };

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-session-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCalculationReport = () => {
    const report = {
      title: 'Calculation Breakdown Report',
      timestamp: new Date().toISOString(),
      weights,
      scenarios: scenarios.filter(s => s.results).map(s => ({
        name: s.name,
        description: s.description,
        inputs: s.factors,
        baseTime: s.baseTime,
        results: s.results,
        keyInsights: generateScenarioInsights(s)
      })),
      summary: {
        totalScenarios: scenarios.length,
        completedScenarios: scenarios.filter(s => s.results).length,
        contributionHistory: contributionHistory.length
      },
      notes: debugNotes
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculation-report-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateScenarioInsights = (scenario: WhatIfScenario) => {
    if (!scenario.results) return [];
    
    const insights = [];
    const topFactors = scenario.results.summary.topFactors.slice(0, 3);
    
    insights.push(`Top 3 factors: ${topFactors.map((f: any) => f.factor).join(', ')}`);
    insights.push(`Total adjustment: ${scenario.results.totalAdjustment.toFixed(3)}s`);
    
    if (Math.abs(scenario.results.totalAdjustment) > 0.5) {
      insights.push('⚠️ Large total adjustment detected');
    }
    
    return insights;
  };

  const toggleScenario = (scenarioId: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(scenarioId)) {
      newExpanded.delete(scenarioId);
    } else {
      newExpanded.add(scenarioId);
    }
    setExpandedScenarios(newExpanded);
  };

  const formatTime = (time: KmTime) => 
    `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Debug Analysis Panel
        </CardTitle>
        <CardDescription>
          Advanced debugging tools for calculation analysis and what-if scenarios
        </CardDescription>
        <div className="flex gap-2">
          <Button onClick={runAllScenarios} variant="outline" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Run All Scenarios
          </Button>
          <Button onClick={exportDebugSession} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Session
          </Button>
          <Button onClick={generateCalculationReport} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scenarios" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scenarios">What-If Scenarios</TabsTrigger>
            <TabsTrigger value="breakdown">Calculation Breakdown</TabsTrigger>
            <TabsTrigger value="notes">Debug Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Scenarios ({scenarios.length})</h4>
              <Button onClick={addScenario} variant="outline" size="sm">
                Add Scenario
              </Button>
            </div>

            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <Collapsible
                  key={scenario.id}
                  open={expandedScenarios.has(scenario.id)}
                  onOpenChange={() => toggleScenario(scenario.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{scenario.name}</span>
                          {scenario.results && (
                            <Badge variant="outline">Completed</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{scenario.description}</div>
                      </div>
                      {expandedScenarios.has(scenario.id) ? 
                        <ChevronUp className="h-4 w-4" /> : 
                        <ChevronDown className="h-4 w-4" />
                      }
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg">
                      <div className="space-y-2">
                        <Label>Scenario Name</Label>
                        <Input
                          value={scenario.name}
                          onChange={(e) => updateScenario(scenario.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Post Position</Label>
                        <Input
                          type="number"
                          value={scenario.factors.postPosition}
                          onChange={(e) => updateScenario(scenario.id, {
                            factors: { ...scenario.factors, postPosition: parseInt(e.target.value) || 1 }
                          })}
                          min="1"
                          max="15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Front Shoes</Label>
                        <Select 
                          value={scenario.factors.shoesFront}
                          onValueChange={(value) => updateScenario(scenario.id, {
                            factors: { ...scenario.factors, shoesFront: value }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Barefoot</SelectItem>
                            <SelectItem value="1">Standard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Driver Win %</Label>
                        <Input
                          type="number"
                          value={scenario.factors.driverWinPercentage}
                          onChange={(e) => updateScenario(scenario.id, {
                            factors: { ...scenario.factors, driverWinPercentage: parseFloat(e.target.value) || 0 }
                          })}
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => runScenario(scenario.id)} size="sm">
                        <Play className="h-3 w-3 mr-2" />
                        Run Scenario
                      </Button>
                      <Button 
                        onClick={() => deleteScenario(scenario.id)} 
                        variant="destructive" 
                        size="sm"
                      >
                        Delete
                      </Button>
                    </div>

                    {scenario.results && (
                      <div className="p-3 bg-muted rounded-lg space-y-2">
                        <h5 className="font-medium">Results</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Base Time: {formatTime(scenario.baseTime)}</div>
                          <div>Final Time: {formatTime(scenario.results.finalTime)}</div>
                          <div>Total Adjustment: {scenario.results.totalAdjustment.toFixed(3)}s</div>
                          <div>Active Factors: {scenario.results.summary.totalFactorsUsed}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Top Factors:</div>
                          {scenario.results.summary.topFactors.slice(0, 3).map((factor: any, index: number) => (
                            <div key={index} className="text-sm flex justify-between">
                              <span>{factor.factor}</span>
                              <span className="font-mono">{factor.weightedAdjustment.toFixed(3)}s</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            <div className="space-y-4">
              <h4 className="font-medium">Calculation History Analysis</h4>
              
              {contributionHistory.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Calculations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{contributionHistory.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Avg Factors per Calc</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {contributionHistory.length > 0 
                            ? (contributionHistory.reduce((sum, calc) => sum + calc.length, 0) / contributionHistory.length).toFixed(1)
                            : '0'
                          }
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Most Active Factor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm font-bold">
                          {contributionHistory.length > 0 ? 'postPosition' : 'N/A'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-medium">Recent Calculations (Last 5)</h5>
                    {contributionHistory.slice(-5).reverse().map((calc, index) => (
                      <div key={index} className="p-2 border rounded text-sm">
                        <div className="font-medium">Calculation #{contributionHistory.length - index}</div>
                        <div className="text-muted-foreground">
                          Top factor: {calc[0]?.factor || 'N/A'} ({calc[0]?.weightedAdjustment.toFixed(3) || '0'}s)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No calculation history available</p>
                  <p className="text-sm">Use scenarios or the calculation preview to generate data</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <div className="space-y-2">
              <Label>Debug Notes</Label>
              <Textarea
                placeholder="Add notes about your debugging session, observations, or findings..."
                value={debugNotes}
                onChange={(e) => setDebugNotes(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              These notes will be included in exported debug sessions and reports.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};