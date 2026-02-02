import { useEffect, useState } from 'react';
import { HorseDebugger } from '../../../services/debugging/horseDebugger';

export const useRockSolidDebugger = () => {
  const [isAutoDebugging, setIsAutoDebugging] = useState(false);

  useEffect(() => {
    // Initialize debugging without clearing existing logs
    if (!isAutoDebugging) {
      console.log('🔍 ROCK SOLID DEBUGGING READY (no auto-clear)');
      setIsAutoDebugging(true);
    }
  }, [isAutoDebugging]);

  const generateRockSolidReport = () => {
    const logs = HorseDebugger.getDebugLogs();
    const rockSolidLogs = logs.filter(log => 
      log.horseName.toLowerCase().includes('rock solid') ||
      log.horseName.toLowerCase().includes('rock_solid')
    );

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLogs: rockSolidLogs.length,
        stages: [...new Set(rockSolidLogs.map(log => log.stage))],
        timeRange: rockSolidLogs.length > 0 ? {
          first: rockSolidLogs[0].timestamp,
          last: rockSolidLogs[rockSolidLogs.length - 1].timestamp
        } : null
      },
      dataQuality: {
        hasHistoricalData: rockSolidLogs.some(log => log.stage === 'HISTORICAL_DATA_RECEIVED'),
        hasProcessedTimes: rockSolidLogs.some(log => log.stage === 'PROCESSED_TIMES_RESULT'),
        hasDataCorruption: rockSolidLogs.some(log => log.stage === 'data_corruption'),
        hasEquipmentIssues: rockSolidLogs.some(log => log.stage === 'equipment_validation' && log.data?.hasCorruption)
      },
      timeCalculations: (() => {
        const processedLog = rockSolidLogs.find(log => log.stage === 'PROCESSED_TIMES_RESULT');
        const finalLog = rockSolidLogs.find(log => log.stage === 'FINAL_RESULT');
        
        return {
          rawKmTime: finalLog?.data?.rawKmTime || null,
          historicalRecordsUsed: processedLog?.data?.length || 0,
          calculationMethod: "Best single time (≤5 months)"
        };
      })(),
      logs: rockSolidLogs
    };

    return report;
  };

  const exportRockSolidReport = () => {
    const report = generateRockSolidReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rock-solid-debug-report-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startFresh = () => {
    HorseDebugger.clearLogs();
    console.log('🧹 Cleared debug logs for Rock Solid session');
    // Optionally trigger a re-render in consumers that read directly from the debugger
    // (no state change needed here since logs are read on demand)
  };
  return {
    isAutoDebugging,
    generateRockSolidReport,
    exportRockSolidReport,
    startFresh,
    getRockSolidLogs: () => {
      const logs = HorseDebugger.getDebugLogs();
      return logs.filter(log => 
        log.horseName.toLowerCase().includes('rock solid') ||
        log.horseName.toLowerCase().includes('rock_solid')
      );
    }
  };
};