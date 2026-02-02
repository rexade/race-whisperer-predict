import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { KmtidPerStartAnalytics } from '../../types/postRaceAnalysisTypes';
import PerformanceGraph from './PerformanceGraph';

interface KmtidAnalyticsCardProps {
  horseName: string;
  driver?: string;
  kmtidAnalytics: KmtidPerStartAnalytics;
  className?: string;
}

/**
 * Card showing kmtid.atgx.se post-race analytics: first/last 200m, meters run,
 * calculated km-time, slipstream, and performance graph.
 */
const KmtidAnalyticsCard: React.FC<KmtidAnalyticsCardProps> = ({
  horseName,
  driver,
  kmtidAnalytics,
  className,
}) => {
  const hasAny =
    kmtidAnalytics.first200mPace != null ||
    kmtidAnalytics.last200mPace != null ||
    (kmtidAnalytics.metersRun != null && kmtidAnalytics.metersRun > 0) ||
    kmtidAnalytics.calculatedKmTime != null ||
    (kmtidAnalytics.slipstreamMeters != null && kmtidAnalytics.slipstreamMeters > 0) ||
    (kmtidAnalytics.performanceGraphData != null && kmtidAnalytics.performanceGraphData.length > 0);

  if (!hasAny) return null;

  const metrics = [
    { label: 'Första 200 m', value: kmtidAnalytics.first200mPace, unit: 'min/km' },
    { label: 'Sista 200 m', value: kmtidAnalytics.last200mPace, unit: 'min/km' },
    { label: 'Sprungna meter', value: kmtidAnalytics.metersRun, unit: '' },
    { label: 'Omräknad km-tid', value: kmtidAnalytics.calculatedKmTime, unit: 'min/km' },
    { label: 'Slipstream (m)', value: kmtidAnalytics.slipstreamMeters, unit: '' },
  ].filter((m) => m.value != null && m.value !== '');

  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-2">
        <div className="mb-3">
          <p className="font-semibold text-sm">{horseName}</p>
          {driver && <p className="text-xs text-muted-foreground">{driver}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs mb-3">
          {metrics.map(({ label, value, unit }) => (
            <div key={label}>
              <p className="text-muted-foreground">{label}</p>
              <p className="font-medium">
                {typeof value === 'number' ? value : value}
                {unit ? ` ${unit}` : ''}
              </p>
            </div>
          ))}
        </div>
        <PerformanceGraph performanceGraphData={kmtidAnalytics.performanceGraphData} />
      </CardContent>
    </Card>
  );
};

export default KmtidAnalyticsCard;
