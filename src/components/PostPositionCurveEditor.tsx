import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import type { DistanceBucket } from '@/services/modernKm/postPositionCalculator';

export interface PostPositionCurves {
  auto: { [position: number]: number };
  volte: { [position: number]: number };
  /** Optional distance-bucketed variant — overrides the legacy curves when present. */
  byDistance?: {
    auto: Record<DistanceBucket, { [position: number]: number }>;
    volte: Record<DistanceBucket, { [position: number]: number }>;
  };
}

interface PostPositionCurveEditorProps {
  curves: PostPositionCurves;
  onCurvesChange: (curves: PostPositionCurves) => void;
}

// Default values from current calculator
// V39 default (2026-05-10) — calibrated legacy fallback curves.
// Used when no race distance is known; otherwise byDistance buckets override.
const DEFAULT_AUTO_ADJUSTMENTS = {
  1: -0.201,
  2: 0.014,
  3: -0.126,
  4: -0.174,
  5: 0.019,
  6: 0.113,
  7: 0.144,
  8: 0.272,
  9: 0.892,
  10: 0.474,
  11: 0.602,
  12: 0.775,
  13: 0.983,
  14: 0.601,
  15: 1.197
};

const DEFAULT_VOLTE_ADJUSTMENTS = {
  1: -0.658,
  2: 0.266,
  3: 0.014,
  4: 0.105,
  5: 0.271,
  6: 0.286,
  7: 0.304,
  8: 0.191,
  9: 0.672,
  10: 0.480,
  11: 0.682,
  12: 0.892,
  13: 1.357,
  14: 0.994,
  15: 0.799
};

// V39 distance-bucketed curves — applied automatically when a race distance is known.
const DEFAULT_AUTO_BY_DISTANCE = {
  short: {
    1: -0.201, 2: 0.014, 3: -0.126, 4: -0.174, 5: 0.019, 6: 0.113, 7: 0.194,
    8: 0.272, 9: 0.892, 10: 0.474, 11: 0.602, 12: 0.775, 13: 0.983, 14: 0.601,
    15: 1.197,
  },
  medium: {
    1: -0.201, 2: 0.014, 3: -0.126, 4: -0.224, 5: 0.044, 6: 0.113, 7: 0.144,
    8: 0.272, 9: 0.892, 10: 0.474, 11: 0.602, 12: 0.750, 13: 0.983, 14: 0.601,
    15: 1.197,
  },
  long: {
    1: -0.201, 2: 0.089, 3: -0.076, 4: -0.174, 5: 0.019, 6: 0.113, 7: 0.044,
    8: 0.272, 9: 0.892, 10: 0.474, 11: 0.614, 12: 0.775, 13: 0.983, 14: 0.601,
    15: 1.197,
  },
};

const DEFAULT_VOLTE_BY_DISTANCE = {
  short: {
    1: -0.658, 2: 0.266, 3: 0.014, 4: 0.105, 5: 0.271, 6: 0.286, 7: 0.304,
    8: 0.191, 9: 0.672, 10: 0.480, 11: 0.682, 12: 0.892, 13: 1.357, 14: 0.994,
    15: 0.799,
  },
  medium: {
    1: -0.658, 2: 0.266, 3: 0.014, 4: 0.105, 5: 0.271, 6: 0.286, 7: 0.304,
    8: 0.191, 9: 0.672, 10: 0.480, 11: 0.682, 12: 0.892, 13: 1.382, 14: 0.994,
    15: 0.799,
  },
  long: {
    1: -0.658, 2: 0.266, 3: 0.014, 4: 0.105, 5: 0.271, 6: 0.286, 7: 0.304,
    8: 0.191, 9: 0.672, 10: 0.480, 11: 0.707, 12: 0.892, 13: 1.357, 14: 0.994,
    15: 0.799,
  },
};

export const PostPositionCurveEditor: React.FC<PostPositionCurveEditorProps> = ({ 
  curves, 
  onCurvesChange 
}) => {
  const [activeTab, setActiveTab] = useState<'auto' | 'volte'>('auto');
  const { toast } = useToast();

  const handlePositionChange = (startMethod: 'auto' | 'volte', position: number, value: number[]) => {
    const newCurves = {
      ...curves,
      [startMethod]: {
        ...curves[startMethod],
        [position]: value[0]
      }
    };
    onCurvesChange(newCurves);
  };

  const handleDirectValueChange = (startMethod: 'auto' | 'volte', position: number, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= -1.0 && numValue <= 2.0) {
      const newCurves = {
        ...curves,
        [startMethod]: {
          ...curves[startMethod],
          [position]: numValue
        }
      };
      onCurvesChange(newCurves);
    }
  };

  const resetToDefaults = () => {
    onCurvesChange(getDefaultPostPositionCurves());
    toast({
      title: "Reset to Defaults",
      description: "Post position curves reset to default values.",
    });
  };

  const exportCurves = () => {
    try {
      const dataStr = JSON.stringify(curves, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'post-position-curves.json';
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Curves Exported",
        description: "Post position curves downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export curves. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Prepare chart data
  const getChartData = (startMethod: 'auto' | 'volte') => {
    const data = [];
    for (let i = 1; i <= 15; i++) {
      const adjustment = curves[startMethod][i] || 0;
      data.push({
        position: i,
        adjustment: adjustment,
        label: `Pos ${i}`,
        fill: adjustment >= 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'
      });
    }
    return data;
  };

  const renderPositionSliders = (startMethod: 'auto' | 'volte') => {
    const positions = Array.from({ length: 15 }, (_, i) => i + 1);
    const relevantPositions = startMethod === 'auto' ? positions : positions.slice(0, 15);
    
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {relevantPositions.map((position) => (
            <div key={position} className="bg-card p-2 rounded border border-border">
              <div className="text-center mb-1">
                <Label className="text-xs font-medium">P{position}</Label>
              </div>
              <Slider
                value={[curves[startMethod][position] || 0]}
                onValueChange={(value) => handlePositionChange(startMethod, position, value)}
                max={2.0}
                min={-1.0}
                step={0.05}
                className="w-full h-2 mb-1"
              />
              <div className="text-center">
                <span className="text-xs text-muted-foreground">
                  {curves[startMethod][position] >= 0 ? '+' : ''}{curves[startMethod][position]?.toFixed(2) || '0.00'}s
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {startMethod === 'auto' && (
          <div className="text-xs text-muted-foreground text-center">
            Positions 13-15 are for rare extended auto races
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-border">
      <CardHeader className="bg-muted/30">
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Post Position Curve Editor
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCurves}
            >
              Export
            </Button>
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
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong className="text-foreground">Customize post position adjustments</strong> for auto and volte start methods.
            Negative values favor the position (faster), positive values penalize it (slower).
          </p>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3" style={{ color: 'hsl(var(--success))' }} />
              <span style={{ color: 'hsl(var(--success))' }}>Negative = Advantage</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" style={{ color: 'hsl(var(--destructive))' }} />
              <span style={{ color: 'hsl(var(--destructive))' }}>Positive = Penalty</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'auto' | 'volte')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto" className="flex items-center gap-2">
              Auto Start
              <Badge variant="secondary" className="text-xs">Pos 1-12</Badge>
            </TabsTrigger>
            <TabsTrigger value="volte" className="flex items-center gap-2">
              Volte Start
              <Badge variant="secondary" className="text-xs">Pos 1-15</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="auto" className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Auto Start Curve Visualization</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={getChartData('auto')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="position" />
                  <YAxis domain={[-1, 2]} />
                  <Tooltip formatter={(value: any) => [`${value > 0 ? '+' : ''}${value}s`, 'Adjustment']} />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
                  <Bar dataKey="adjustment" name="Time Adjustment">
                    {getChartData('auto').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {renderPositionSliders('auto')}
          </TabsContent>
          
          <TabsContent value="volte" className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Volte Start Curve Visualization</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={getChartData('volte')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="position" />
                  <YAxis domain={[-1, 2]} />
                  <Tooltip formatter={(value: any) => [`${value > 0 ? '+' : ''}${value}s`, 'Adjustment']} />
                  <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" />
                  <Bar dataKey="adjustment" name="Time Adjustment">
                    {getChartData('volte').map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {renderPositionSliders('volte')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export const getDefaultPostPositionCurves = (): PostPositionCurves => ({
  auto: { ...DEFAULT_AUTO_ADJUSTMENTS },
  volte: { ...DEFAULT_VOLTE_ADJUSTMENTS },
  byDistance: {
    auto: {
      short: { ...DEFAULT_AUTO_BY_DISTANCE.short },
      medium: { ...DEFAULT_AUTO_BY_DISTANCE.medium },
      long: { ...DEFAULT_AUTO_BY_DISTANCE.long },
    },
    volte: {
      short: { ...DEFAULT_VOLTE_BY_DISTANCE.short },
      medium: { ...DEFAULT_VOLTE_BY_DISTANCE.medium },
      long: { ...DEFAULT_VOLTE_BY_DISTANCE.long },
    },
  },
});
