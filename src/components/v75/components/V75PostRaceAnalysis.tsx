
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useV75PostRaceAnalysis } from '../hooks/useV75PostRaceAnalysis';
import V75PostRaceHeader from './postRace/V75PostRaceHeader';
import V75PostRaceOverview from './postRace/V75PostRaceOverview';
import V75PostRaceDetails from './postRace/V75PostRaceDetails';
import V75PostRaceInsights from './postRace/V75PostRaceInsights';

const V75PostRaceAnalysis: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState("overview");
  
  const {
    loading,
    analysis,
    error,
    analyzePostRace,
    clearAnalysis
  } = useV75PostRaceAnalysis();

  const handleAnalyze = () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    analyzePostRace(dateStr);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <V75PostRaceHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        handleAnalyze={handleAnalyze}
        clearAnalysis={clearAnalysis}
        loading={loading}
        hasAnalysis={!!analysis}
        error={error}
      />

      {/* Analysis Results */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>
              Analysis Results - {format(new Date(analysis.analysisDate), 'PPP')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="races">Race Details</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-6">
                <V75PostRaceOverview analysis={analysis} setActiveTab={setActiveTab} />
              </TabsContent>

              <TabsContent value="races" className="space-y-6">
                <V75PostRaceDetails analysis={analysis} />
              </TabsContent>

              <TabsContent value="insights" className="space-y-6">
                <V75PostRaceInsights analysis={analysis} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default V75PostRaceAnalysis;
