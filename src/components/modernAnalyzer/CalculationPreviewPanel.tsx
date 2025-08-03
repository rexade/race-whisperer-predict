import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { NormalizationWeights } from '../../services/modernKm/types';
import { calculatePreview, getSampleFactors, FactorContribution, PreviewCalculation } from '../../services/modernKm/calculationPreview';
import { KmTime } from '../../services/types/kmTimeTypes';

interface CalculationPreviewPanelProps {
  weights: NormalizationWeights;
  onWeightsChange?: (weights: NormalizationWeights) => void;
}

export const CalculationPreviewPanel: React.FC<CalculationPreviewPanelProps> = ({
  weights,
  onWeightsChange
}) => {
  const [sampleFactors, setSampleFactors] = useState(getSampleFactors());
  const [baseTime, setBaseTime] = useState<KmTime>({ minutes: 1, seconds: 15, tenths: 5 });
  const [preview, setPreview] = useState<PreviewCalculation | null>(null);

  useEffect(() => {
    const newPreview = calculatePreview(baseTime, sampleFactors, weights);
    setPreview(newPreview);
  }, [baseTime, sampleFactors, weights]);

  const updateFactor = (key: string, value: any) => {
    setSampleFactors(prev => ({ ...prev, [key]: value }));
  };

  const formatTime = (time: KmTime) => 
    `${time.minutes}:${time.seconds.toString().padStart(2, '0')}.${time.tenths}`;

  const getImpactColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return 'hsl(var(--destructive))';
      case 'medium': return 'hsl(var(--warning))';
      case 'low': return 'hsl(var(--muted-foreground))';
    }
  };

  const getImpactIcon = (adjustment: number) => {
    if (adjustment > 0.01) return <TrendingUp className="h-3 w-3 text-destructive" />;
    if (adjustment < -0.01) return <TrendingDown className="h-3 w-3 text-green-500" />;
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculation Preview
        </CardTitle>
        <CardDescription>
          Experiment with different values to see real-time adjustments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="inputs" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inputs">Input Values</TabsTrigger>
            <TabsTrigger value="breakdown">Factor Breakdown</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="inputs" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base KM Time</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={baseTime.minutes}
                    onChange={(e) => setBaseTime(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Sec"
                    value={baseTime.seconds}
                    onChange={(e) => setBaseTime(prev => ({ ...prev, seconds: parseInt(e.target.value) || 0 }))}
                    className="w-20"
                  />
                  <Input
                    type="number"
                    placeholder="Tenths"
                    value={baseTime.tenths}
                    onChange={(e) => setBaseTime(prev => ({ ...prev, tenths: parseInt(e.target.value) || 0 }))}
                    className="w-20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Post Position</Label>
                <Input
                  type="number"
                  value={sampleFactors.postPosition}
                  onChange={(e) => updateFactor('postPosition', parseInt(e.target.value) || 1)}
                  min="1"
                  max="15"
                />
              </div>

              <div className="space-y-2">
                <Label>Start Method</Label>
                <Select 
                  value={sampleFactors.startMethod} 
                  onValueChange={(value) => updateFactor('startMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="volte">Volte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Race Distance (m)</Label>
                <Input
                  type="number"
                  value={sampleFactors.raceDistance}
                  onChange={(e) => updateFactor('raceDistance', parseInt(e.target.value) || 2140)}
                />
              </div>

              <div className="space-y-2">
                <Label>Front Shoes</Label>
                <Select 
                  value={sampleFactors.shoesFront} 
                  onValueChange={(value) => updateFactor('shoesFront', value)}
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
                <Label>Back Shoes</Label>
                <Select 
                  value={sampleFactors.shoesBack} 
                  onValueChange={(value) => updateFactor('shoesBack', value)}
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
                <Label>Driver Win % </Label>
                <Input
                  type="number"
                  value={sampleFactors.driverWinPercentage}
                  onChange={(e) => updateFactor('driverWinPercentage', parseFloat(e.target.value) || 0)}
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                <Label>Horse Win % (basis points)</Label>
                <Input
                  type="number"
                  value={sampleFactors.horseWinPercentage}
                  onChange={(e) => updateFactor('horseWinPercentage', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <Button 
              onClick={() => setSampleFactors(getSampleFactors())}
              variant="outline"
              className="w-full"
            >
              Reset to Sample Values
            </Button>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            {preview && (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">Base Time:</span>
                  <span className="font-mono">{formatTime(preview.baseTime)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">Final Time:</span>
                  <span className="font-mono font-bold">{formatTime(preview.finalTime)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="font-medium">Total Adjustment:</span>
                  <span className={`font-mono ${preview.totalAdjustment >= 0 ? 'text-destructive' : 'text-green-500'}`}>
                    {preview.totalAdjustment >= 0 ? '+' : ''}{preview.totalAdjustment.toFixed(3)}s
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Factor Contributions:</h4>
                  {preview.contributions
                    .sort((a, b) => Math.abs(b.weightedAdjustment) - Math.abs(a.weightedAdjustment))
                    .map((contribution, index) => (
                    <div key={contribution.factor} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {getImpactIcon(contribution.weightedAdjustment)}
                        <span className="text-sm font-medium">{contribution.factor}</span>
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: getImpactColor(contribution.impactLevel) }}
                        >
                          {contribution.impactLevel}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {contribution.weightedAdjustment >= 0 ? '+' : ''}{contribution.weightedAdjustment.toFixed(3)}s
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contribution.rawAdjustment.toFixed(3)}s × {contribution.weight}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Top Impact Factors</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {preview.summary.topFactors.slice(0, 3).map((factor, index) => (
                        <div key={factor.factor} className="flex justify-between text-sm">
                          <span>{factor.factor}</span>
                          <span className="font-mono">
                            {Math.abs(factor.weightedAdjustment).toFixed(3)}s
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Active Factors:</span>
                        <span>{preview.summary.totalFactorsUsed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max Impact:</span>
                        <span className="font-mono">{preview.summary.maxImpact.toFixed(3)}s</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Min Impact:</span>
                        <span className="font-mono">{preview.summary.minImpact.toFixed(3)}s</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Impact Distribution</h4>
                  {preview.contributions.map((contribution) => {
                    const percentage = preview.totalAdjustment !== 0 
                      ? Math.abs(contribution.weightedAdjustment / preview.totalAdjustment) * 100 
                      : 0;
                    return (
                      <div key={contribution.factor} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{contribution.factor}</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};