import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, RotateCcw, ChevronDown, ChevronRight, Save, Upload, Download, Info } from "lucide-react";
import { NormalizationWeights, PostPositionCurves, getDefaultPostPositionCurves } from '../services/modernKm/index';
import { DEFAULT_WEIGHTS } from '../services/modernKm/types';
import { WEIGHT_PRESETS, type WeightPreset } from '../services/modernKm/presetWeights';
import {
  loadBrowserDefaultWeights,
  NORMALIZATION_WEIGHT_MAX,
  parseNormalizationWeights,
  saveBrowserDefaultWeights,
} from '../services/modernKm/weightConfig';
import { resolvePresetModel } from '../utils/weightPresetModel';
import { useToast } from "@/hooks/use-toast";

interface WeightManagerProps {
  weights: NormalizationWeights;
  onWeightsChange: (weights: NormalizationWeights) => void;
  postPositionCurves?: PostPositionCurves;
  /**
   * Applies a preset's (or an imported config's) post-position curves. Weights
   * and curves are two halves of one model — see `resolvePresetModel`.
   */
  onPostPositionCurvesChange?: (curves: PostPositionCurves) => void;
}

const WeightManager: React.FC<WeightManagerProps> = ({
  weights,
  onWeightsChange,
  postPositionCurves = getDefaultPostPositionCurves(),
  onPostPositionCurvesChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    equipment: true,
    performance: true,
    driver: true,
    distance: true
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const { toast } = useToast();
  const selectedPresetDetails = selectedPreset
    ? WEIGHT_PRESETS.find(preset => preset.name === selectedPreset)
    : undefined;
  const isExperimentalPreset = selectedPresetDetails?.name.toLowerCase().includes('experimental') ?? false;

  const handleWeightChange = (factor: keyof NormalizationWeights, value: number[]) => {
    const newWeights = {
      ...weights,
      [factor]: value[0]
    };
    onWeightsChange(newWeights);
  };

  const handleDirectWeightChange = (factor: keyof NormalizationWeights, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= NORMALIZATION_WEIGHT_MAX) {
      const newWeights = {
        ...weights,
        [factor]: numValue
      };
      onWeightsChange(newWeights);
    }
  };

  const resetToDefaults = () => {
    onWeightsChange({ ...DEFAULT_WEIGHTS });
  };

  const saveAsDefault = () => {
    // Selecting a preset already persists; this is the manual confirmation for
    // hand-tuned weights. The quota eviction lives in saveBrowserDefaultWeights
    // so both paths behave identically.
    if (saveBrowserDefaultWeights(weights)) {
      toast({
        title: "Default Weights Saved",
        description: "Current weights have been saved as your new defaults.",
      });
    } else {
      toast({
        title: "Save Failed",
        description: "Browser storage is full and could not be cleared. Try closing other tabs or clearing site data.",
        variant: "destructive",
      });
    }
  };

  const loadCustomDefaults = () => {
    try {
      const customDefaults = loadBrowserDefaultWeights();
      if (customDefaults) {
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
      const dataStr = JSON.stringify({
        weights,
        postPositionCurves,
      }, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'v75-model-config.json';
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Model Exported",
        description: "Weights and post-position curves downloaded successfully.",
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
            const parsedWeights = parseNormalizationWeights(imported.weights ?? imported);
            if (!parsedWeights) throw new Error('Invalid weights');

            // `exportWeights` writes both halves of the model, so import has to
            // read both back or a round trip silently returns flat curves.
            const curves = imported.postPositionCurves;
            const hasCurves = !!curves
              && typeof curves.auto === 'object' && curves.auto !== null
              && typeof curves.volte === 'object' && curves.volte !== null;

            onWeightsChange(parsedWeights);
            if (hasCurves) onPostPositionCurvesChange?.(curves as PostPositionCurves);
            toast({
              title: "Model Imported",
              description: !imported.weights
                ? "Legacy weight configuration imported successfully."
                : hasCurves
                  ? "Weights and post-position curves imported successfully."
                  : "Weights imported successfully. The file carried no post-position curves.",
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

  const applyPreset = (preset: WeightPreset) => {
    const model = resolvePresetModel(preset);
    setSelectedPreset(preset.name);
    onWeightsChange(model.weights);
    // Curves are half the model. Seven presets were fitted against curves that
    // differ from the flat defaults, so applying the weights alone runs a
    // configuration that was never measured.
    if (preset.postPositionCurves) onPostPositionCurvesChange?.(model.postPositionCurves);
    // Selecting a preset IS choosing a default. Without this the choice is lost
    // on reload — which is why re-picking V42 every session was part of the
    // routine on a deployment with no backend to persist to.
    saveBrowserDefaultWeights(model.weights);
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
        { 
          key: 'postPosition' as keyof NormalizationWeights, 
          label: 'Post Position', 
          description: 'Impact of starting position',
          typicalRange: '0.0 to +1.0s per position',
          baseEffect: 'Auto: +0.5s per pos after 5th, Volte: +1.0s per pos after 8th'
        },
        { 
          key: 'shoeType' as keyof NormalizationWeights, 
          label: 'Shoe Type', 
          description: 'Barefoot vs shod advantages',
          typicalRange: '-0.5s to +0.3s',
          baseEffect: 'Barefoot typically -0.3s advantage'
        },
        { 
          key: 'sulkyType' as keyof NormalizationWeights, 
          label: 'Sulky Type', 
          description: 'American vs Volvo sulky impact',
          typicalRange: '-0.2s to +0.2s',
          baseEffect: 'American typically -0.1s advantage'
        },
        {
          key: 'shoeChange' as keyof NormalizationWeights,
          label: 'Shoe Change',
          description: 'Intent signal when shoe configuration changes',
          typicalRange: '-0.3s to +0.2s',
          baseEffect: 'Switching to barefoot can indicate a faster setup',
          isNew: true
        },
      ]
    },
    {
      id: 'performance',
      title: 'Performance Metrics',
      description: 'Horse performance and consistency indicators',
      factors: [
        {
          key: 'form' as keyof NormalizationWeights,
          label: 'Recent Form',
          description: 'Recent race finish positions (last 8 races, recency-weighted)',
          typicalRange: '-0.05s to +0.03s',
          baseEffect: 'Win/place → faster; poor finishes → slower'
        },
        { 
          key: 'startPoints' as keyof NormalizationWeights, 
          label: 'Start Points', 
          description: 'Horse form based on start points',
          typicalRange: '-0.5s to +0.5s',
          baseEffect: 'Higher points = faster horse',
          isNew: true
        },
        { 
          key: 'placePercentage' as keyof NormalizationWeights, 
          label: 'Place Percentage', 
          description: 'Horse consistency in placing',
          typicalRange: '-0.3s to +0.3s',
          baseEffect: 'Higher % = more consistent',
          isNew: true
        },
        { 
          key: 'horseWinPercentage' as keyof NormalizationWeights, 
          label: 'Horse Win Percentage', 
          description: 'Horse quality and ability',
          typicalRange: '-0.4s to +0.4s',
          baseEffect: 'Higher % = better horse',
          isNew: true
        },
        {
          key: 'earningsPerStart' as keyof NormalizationWeights,
          label: 'Earnings Per Start',
          description: 'Horse earning power and class',
          typicalRange: '-0.3s to +0.3s',
          baseEffect: 'Higher earnings = higher class',
          isNew: true
        },
        {
          key: 'gallopRisk' as keyof NormalizationWeights,
          label: 'Gallop Risk',
          description: 'Penalty for horses that frequently break gait (gallop) in races',
          typicalRange: '0s to +0.5s',
          baseEffect: '15% gallop rate ≈ +0.19s penalty',
          isNew: true
        },
        {
          key: 'layoffPenalty' as keyof NormalizationWeights,
          label: 'Layoff Penalty',
          description: 'Penalty for horses returning after 21+ days since last race',
          typicalRange: '0s to +0.35s',
          baseEffect: '51 days off ≈ +0.21s, 90+ days ≈ +0.33s',
          isNew: true
        },
        {
          key: 'ageFactor' as keyof NormalizationWeights,
          label: 'Age Factor',
          description: 'Penalty for horses outside peak age (5–7 years). Young and old horses adjusted.',
          typicalRange: '0s to +0.16s',
          baseEffect: '3yo +0.16s, 4yo +0.08s, 5–7yo 0s, 8yo +0.05s',
          isNew: true
        },
        {
          key: 'genderAdjustment' as keyof NormalizationWeights,
          label: 'Gender (mare)',
          description: 'Modest time penalty for mares in mixed-gender fields',
          typicalRange: '0s to +0.08s',
          baseEffect: 'Mares +0.08s before weight, geldings/stallions 0s',
          isNew: true
        },
        {
          key: 'consistencyFactor' as keyof NormalizationWeights,
          label: 'Consistency',
          description: 'Penalty for boom-or-bust horses with high variance in finish positions',
          typicalRange: '0s to +0.15s',
          baseEffect: 'stdDev 3+ finish positions ≈ +0.11s penalty',
          isNew: true
        }
      ]
    },
    {
      id: 'driver',
      title: 'Driver & Track',
      description: 'Driver skill and track familiarity factors',
      factors: [
        { 
          key: 'driverPerformance' as keyof NormalizationWeights, 
          label: 'Driver Performance', 
          description: 'Driver win percentage and skill',
          typicalRange: '-0.4s to +0.4s',
          baseEffect: 'Top drivers: -0.2s, Poor drivers: +0.2s'
        },
        {
          key: 'trackFamiliarity' as keyof NormalizationWeights,
          label: 'Track Familiarity',
          description: 'Home track advantage',
          typicalRange: '-0.2s to 0s',
          baseEffect: 'Home track typically -0.1s advantage'
        },
        {
          key: 'driverForm' as keyof NormalizationWeights,
          label: 'Driver Form',
          description: 'Recent driver performance trend across last 20 starts',
          typicalRange: '-0.2s to +0.2s',
          baseEffect: 'Hot streak → faster; cold stretch → slower',
          isNew: true
        },
        {
          key: 'driverEmpirical' as keyof NormalizationWeights,
          label: 'Driver Empirical',
          description: 'Race-format-specific driver win rate from calibration data',
          typicalRange: '-0.3s to +0.3s',
          baseEffect: 'Requires cached driver ratings from a calibration dataset',
          isNew: true
        },
        {
          key: 'trainerPerformance' as keyof NormalizationWeights,
          label: 'Trainer Performance',
          description: 'Trainer win percentage — above 12% = faster, below = slower',
          typicalRange: '-0.2s to +0.2s',
          baseEffect: 'Top trainers: -0.15s, Poor trainers: +0.15s',
          isNew: true
        },
      ]
    },
    {
      id: 'market',
      title: 'Market Signals',
      description: 'Historical prices, live odds, and game bet distribution',
      factors: [
        {
          key: 'oddsHistorical' as keyof NormalizationWeights,
          label: 'Historical Odds',
          description: 'Average market expectation from recent starts',
          typicalRange: '-0.9s to +0.9s',
          baseEffect: 'Lower historical odds imply a stronger horse',
          isNew: true
        },
        {
          key: 'oddsLive' as keyof NormalizationWeights,
          label: 'Live Odds',
          description: 'Current win-pool odds for this race',
          typicalRange: '-0.9s to +0.9s',
          baseEffect: 'Lower live odds reduce the predicted time',
          isNew: true
        },
        {
          key: 'betDistribution' as keyof NormalizationWeights,
          label: 'Bet Distribution',
          description: 'Share of game bets placed on the horse',
          typicalRange: '-0.9s to +0.9s',
          baseEffect: 'Higher betting support implies shorter odds',
          isNew: true
        },
      ]
    },
    {
      id: 'distance',
      title: 'Distance Adjustments',
      description: 'Race and individual distance normalization',
      factors: [
        { 
          key: 'distanceAdjustment' as keyof NormalizationWeights, 
          label: 'Distance Adjustment', 
          description: 'Individual vs race distance differences',
          typicalRange: '-0.3s to +0.3s',
          baseEffect: 'Different distances from race average'
        },
        { 
          key: 'raceDistanceAdjustment' as keyof NormalizationWeights, 
          label: 'Race Distance Adjustment', 
          description: 'Non-linear normalization from 2140m reference to actual race distance',
          typicalRange: '-0.5s to +0.5s',
          baseEffect: 'Shorter races typically faster per km',
          isNew: true
        },
        { 
          key: 'volteStartDistancePenalty' as keyof NormalizationWeights, 
          label: 'Volte Start Distance Penalty', 
          description: 'Penalty for horses starting at different distance in volte races',
          typicalRange: '0s to +0.5s',
          baseEffect: 'Back markers get time penalty',
          isNew: true
        },
      ]
    }
  ];

  return (
    <Card className="border-primary/20 dark:border-primary/30">
      <CardHeader 
        className="cursor-pointer bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Enhanced Normalization Weights
          </div>
          <Badge variant="outline" className="border-border">
            {isExpanded ? 'Collapse' : 'Expand'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6 pt-6">
          {/* Quick Presets */}
          <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Presets</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Model honesty"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Presets are comparison tools. A model should not become the default unless it beats the current default on a named holdout set.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEIGHT_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                    selectedPreset === preset.name
                      ? 'bg-primary/15 border-primary/40 text-foreground font-medium'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-primary/30'
                  }`}
                >
                  {preset.name}
                  {preset.maeScore != null && (
                    <span className="ml-1 text-[10px] text-primary/80">{preset.maeScore} MAE</span>
                  )}
                </button>
              ))}
            </div>
            {selectedPreset && (() => {
              return selectedPresetDetails ? (
                <p className="text-xs text-muted-foreground">{selectedPresetDetails.description}</p>
              ) : null;
            })()}
            {isExperimentalPreset && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
                <div className="font-medium">Experimental model</div>
                <div className="mt-1 text-muted-foreground">
                  Backtested on selected historical races. Use for comparison, not certainty. It is not proven as the default model yet.
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
            <p className="text-sm text-muted-foreground sm:flex-1">
              Adjust the weights to control how much each factor affects the final normalized time.
            </p>
            <div className="flex flex-col gap-2 shrink-0">
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
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <div className="text-left">
                      <h3 className="font-medium text-foreground">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
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
                  <div className="space-y-4 pl-4 border-l-2 border-border">
                    {category.factors.map((factor) => (
                      <div key={factor.key} className="space-y-3 bg-card p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <Label className="font-medium flex items-center gap-2">
                              {factor.label}
                              {factor.isNew && (
                                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-400">NEW</Badge>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">{factor.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Info className="h-3 w-3 text-primary" />
                              <span className="text-xs text-primary">{factor.baseEffect}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={weights[factor.key] ?? 0}
                              onChange={(e) => handleDirectWeightChange(factor.key, e.target.value)}
                              className="w-16 h-8 text-center text-sm"
                              min="0"
                              max={NORMALIZATION_WEIGHT_MAX}
                              step="0.001"
                            />
                            <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                              {factor.typicalRange}
                            </Badge>
                          </div>
                        </div>
                        <Slider
                          value={[weights[factor.key] ?? 0]}
                          onValueChange={(value) => handleWeightChange(factor.key, value)}
                          max={NORMALIZATION_WEIGHT_MAX}
                          min={0.0}
                          step={0.01}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.0 (No impact)</span>
                          <span>{NORMALIZATION_WEIGHT_MAX.toFixed(1)} (Max impact)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
          
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Enhanced Weight Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {weightCategories.flatMap(category => category.factors).map((factor) => (
                <div key={factor.key} className="flex justify-between">
                  <span className="text-foreground">{factor.label}:</span>
                  <span className="font-mono font-medium text-primary">{(weights[factor.key] ?? 0).toFixed(3)}</span>
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
