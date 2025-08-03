import { useEffect, useState } from 'react';
import { HorseDebugger, HorseDebugInfo } from '../../../services/debugging/horseDebugger';

export const useXanderDebugger = () => {
  const [debugLogs, setDebugLogs] = useState<HorseDebugInfo[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);

  const startDebugging = () => {
    HorseDebugger.clearLogs();
    setIsDebugging(true);
    console.log('🐎 XANDER DEBUGGING STARTED - Tracking all processing steps');
  };

  const stopDebugging = () => {
    setIsDebugging(false);
    const logs = HorseDebugger.getDebugLogs();
    setDebugLogs(logs);
    console.log('🐎 XANDER DEBUGGING STOPPED - Captured logs:', logs.length);
  };

  const exportDebugReport = () => {
    const report = HorseDebugger.exportDebugReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xander-debug-report-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getDebugSummary = () => {
    const logs = HorseDebugger.getDebugLogs();
    const stages = logs.reduce((acc, log) => {
      acc[log.stage] = (acc[log.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLogs: logs.length,
      stagesCovered: Object.keys(stages),
      stageBreakdown: stages,
      lastActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    };
  };

  const getLiveDebugLogs = () => {
    return HorseDebugger.getDebugLogs();
  };

  return {
    isDebugging,
    debugLogs,
    getLiveDebugLogs,
    startDebugging,
    stopDebugging,
    exportDebugReport,
    getDebugSummary,
    clearLogs: () => {
      HorseDebugger.clearLogs();
      setDebugLogs([]);
    }
  };
};