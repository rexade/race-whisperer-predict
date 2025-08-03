import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator, Play, AlertCircle } from 'lucide-react';
import { useRaceAnalysis } from './modernAnalyzer/hooks/useRaceAnalysis';
import WeightManager from './WeightManager';
import { NormalizationWeights, getDefaultWeights } from '../services/modernKm/index';
import { useToast } from '@/components/ui/use-toast';

export const ModernAnalyzer: React.FC = () => {
  const [raceId, setRaceId] = useState('');
  const [weights, setWeights] = useState<NormalizationWeights>(getDefaultWeights());
  const { toast } = useToast();
  
  const {
    loading,
    progress,
    currentTask,
    error,
    raceInfo,
    enhancedHorses,
    analyzeRace
  } = useRaceAnalysis();

  const handleAnalyze = async () => {
    if (!raceId.trim()) {
      toast({
        title: "Race ID Required",
        description: "Please enter a race ID to analyze",
        variant: "destructive"
      });
      return;
    }

    try {
      await analyzeRace(raceId.trim(), weights);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const handleWeightChange = (newWeights: NormalizationWeights) => {
    setWeights(newWeights);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Modern KM Time Analyzer
          </CardTitle>
          <CardDescription>
            Analyze race data with modern kilometer time normalization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="race-id">Race ID</Label>
              <Input
                id="race-id"
                placeholder="Enter race ID (e.g., V75_2024-03-15_5_6)"
                value={raceId}
                onChange={(e) => setRaceId(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleAnalyze} 
                disabled={loading || !raceId.trim()}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {loading ? 'Analyzing...' : 'Analyze Race'}
              </Button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {currentTask || 'Processing...'}
                </span>
                <span className="text-sm font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <WeightManager 
        weights={weights} 
        onWeightsChange={handleWeightChange} 
      />

      {raceInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Race Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Track:</span> {raceInfo.track}
              </div>
              <div>
                <span className="font-medium">Date:</span> {raceInfo.date}
              </div>
              <div>
                <span className="font-medium">Race:</span> {raceInfo.raceNumber}
              </div>
              <div>
                <span className="font-medium">Distance:</span> {raceInfo.distance}m
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {enhancedHorses && enhancedHorses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Modern normalized KM times for {enhancedHorses.length} horses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enhancedHorses.map((horse, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{horse.postPosition || index + 1}</Badge>
                    <span className="font-medium">{horse.name || `Horse ${index + 1}`}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">
                      {horse.rawKmTime ? 
                        `${horse.rawKmTime.minutes}:${
                          horse.rawKmTime.seconds.toString().padStart(2, '0')
                        }.${horse.rawKmTime.tenths}` 
                        : 'N/A'
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Raw KM Time
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};