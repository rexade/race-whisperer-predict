/**
 * Enhanced Xander Debugger - Comprehensive Investigation System
 * 
 * This enhanced debugger provides granular logging, checkpoint tracking,
 * error resilience, and detailed analysis specifically for investigating
 * Xander's time discrepancy issues.
 */

import { KmTime } from '../types/kmTimeTypes';
import { XanderTimeInvestigator, TimeInvestigationReport } from './xanderTimeInvestigation';

interface DebugCheckpoint {
  id: string;
  timestamp: number;
  phase: string;
  horseName: string;
  data: any;
  success: boolean;
  error?: string;
}

interface NormalizationStep {
  stepName: string;
  beforeTime: KmTime;
  afterTime: KmTime;
  adjustmentSeconds: number;
  reason: string;
  timestamp: number;
}

interface ConnectionAttempt {
  url: string;
  timestamp: number;
  success: boolean;
  responseTime?: number;
  error?: string;
  retryCount: number;
}

export class EnhancedXanderDebugger {
  private static instance: EnhancedXanderDebugger;
  private static debugEnabled = false;
  private static debugHorseName = '';
  private static debugSessionId = '';
  
  private checkpoints: DebugCheckpoint[] = [];
  private normalizationSteps: NormalizationStep[] = [];
  private connectionAttempts: ConnectionAttempt[] = [];
  private detailedLogs: string[] = [];
  
  static getInstance(): EnhancedXanderDebugger {
    if (!this.instance) {
      this.instance = new EnhancedXanderDebugger();
    }
    return this.instance;
  }
  
  static enableXanderDebugging(horseName: string, sessionId?: string): void {
    // Only enable if not already enabled for this horse
    if (this.debugEnabled && this.debugHorseName === horseName.toLowerCase()) {
      console.log(`🔍 Enhanced debugging already enabled for ${horseName} - continuing existing session`);
      return;
    }
    
    this.debugEnabled = true;
    this.debugHorseName = horseName.toLowerCase();
    this.debugSessionId = sessionId || `xander_${Date.now()}`;
    
    const debuggerInstance = this.getInstance();
    debuggerInstance.clearPreviousSession();
    
    console.log(`🔍 ===== ENHANCED XANDER DEBUGGING ENABLED =====`);
    console.log(`🐎 Target Horse: ${horseName}`);
    console.log(`🆔 Session ID: ${this.debugSessionId}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`===============================================`);
    
    this.addCheckpoint('debug_enabled', 'initialization', horseName, { sessionId: this.debugSessionId }, true);
  }
  
  static isDebugEnabled(): boolean {
    return this.debugEnabled;
  }
  
  static isTargetHorse(horseName: string): boolean {
    return this.debugEnabled && horseName.toLowerCase().includes(this.debugHorseName);
  }
  
  static disableDebugging(): void {
    if (this.debugEnabled) {
      const debuggerInstance = this.getInstance();
      debuggerInstance.generateFinalReport();
      debuggerInstance.clearPreviousSession();
    }
    
    this.debugEnabled = false;
    this.debugHorseName = '';
    this.debugSessionId = '';
  }
  
  private clearPreviousSession(): void {
    this.checkpoints = [];
    this.normalizationSteps = [];
    this.connectionAttempts = [];
    this.detailedLogs = [];
  }
  
  static addCheckpoint(
    id: string,
    phase: string,
    horseName: string,
    data: any,
    success: boolean,
    error?: string
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    const checkpoint: DebugCheckpoint = {
      id,
      timestamp: Date.now(),
      phase,
      horseName,
      data,
      success,
      error
    };
    
    debuggerInstance.checkpoints.push(checkpoint);
    debuggerInstance.logDetailedMessage(`🔺 CHECKPOINT: ${phase}/${id} - ${success ? '✅ Success' : '❌ Failed'}`, data, error);
  }
  
  static logNormalizationStep(
    horseName: string,
    stepName: string,
    beforeTime: KmTime,
    afterTime: KmTime,
    adjustmentSeconds: number,
    reason: string
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    const step: NormalizationStep = {
      stepName,
      beforeTime,
      afterTime,
      adjustmentSeconds,
      reason,
      timestamp: Date.now()
    };
    
    debuggerInstance.normalizationSteps.push(step);
    
    const beforeTimeStr = `${beforeTime.minutes}:${beforeTime.seconds.toString().padStart(2, '0')}.${beforeTime.tenths}`;
    const afterTimeStr = `${afterTime.minutes}:${afterTime.seconds.toString().padStart(2, '0')}.${afterTime.tenths}`;
    
    debuggerInstance.logDetailedMessage(
      `⚙️ NORMALIZATION: ${stepName}`,
      {
        before: beforeTimeStr,
        after: afterTimeStr,
        adjustment: `${adjustmentSeconds > 0 ? '+' : ''}${adjustmentSeconds.toFixed(3)}s`,
        reason
      }
    );
  }
  
  static logConnectionAttempt(
    horseName: string,
    url: string,
    success: boolean,
    responseTime?: number,
    error?: string,
    retryCount: number = 0
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    const attempt: ConnectionAttempt = {
      url,
      timestamp: Date.now(),
      success,
      responseTime,
      error,
      retryCount
    };
    
    debuggerInstance.connectionAttempts.push(attempt);
    
    debuggerInstance.logDetailedMessage(
      `🌐 CONNECTION: ${success ? '✅' : '❌'} ${url}`,
      {
        responseTime: responseTime ? `${responseTime}ms` : 'N/A',
        retryCount,
        error: error || 'None'
      }
    );
  }
  
  static logProcessingPhase(
    horseName: string,
    phase: string,
    details: any,
    timeData?: { before?: KmTime; after?: KmTime }
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    let logData = { ...details };
    
    if (timeData) {
      if (timeData.before) {
        logData.beforeTime = `${timeData.before.minutes}:${timeData.before.seconds.toString().padStart(2, '0')}.${timeData.before.tenths}`;
      }
      if (timeData.after) {
        logData.afterTime = `${timeData.after.minutes}:${timeData.after.seconds.toString().padStart(2, '0')}.${timeData.after.tenths}`;
      }
    }
    
    debuggerInstance.logDetailedMessage(`📋 PHASE: ${phase}`, logData);
  }
  
  static logDataQualityCheck(
    horseName: string,
    checkName: string,
    passed: boolean,
    details: any
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    debuggerInstance.logDetailedMessage(
      `🔍 DATA QUALITY: ${checkName} - ${passed ? '✅ PASSED' : '❌ FAILED'}`,
      details
    );
  }
  
  private logDetailedMessage(message: string, data?: any, error?: string): void {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ${message}`;
    
    if (data) {
      logEntry += `\n    Data: ${JSON.stringify(data, null, 2)}`;
    }
    
    if (error) {
      logEntry += `\n    Error: ${error}`;
    }
    
    this.detailedLogs.push(logEntry);
    console.log(logEntry);
  }
  
  private generateFinalReport(): void {
    console.log(`\n🔍 ===== ENHANCED XANDER DEBUG FINAL REPORT =====`);
    console.log(`🆔 Session: ${EnhancedXanderDebugger.debugSessionId}`);
    console.log(`🐎 Horse: ${EnhancedXanderDebugger.debugHorseName}`);
    console.log(`⏰ Duration: ${Date.now() - (this.checkpoints[0]?.timestamp || Date.now())}ms`);
    
    // Checkpoint Analysis
    console.log(`\n📍 CHECKPOINT ANALYSIS:`);
    console.log(`  Total checkpoints: ${this.checkpoints.length}`);
    const failedCheckpoints = this.checkpoints.filter(cp => !cp.success);
    console.log(`  Failed checkpoints: ${failedCheckpoints.length}`);
    
    if (failedCheckpoints.length > 0) {
      console.log(`  Failed phases:`);
      failedCheckpoints.forEach(cp => {
        console.log(`    - ${cp.phase}/${cp.id}: ${cp.error || 'Unknown error'}`);
      });
    }
    
    // Normalization Analysis
    console.log(`\n⚙️ NORMALIZATION ANALYSIS:`);
    console.log(`  Total normalization steps: ${this.normalizationSteps.length}`);
    
    if (this.normalizationSteps.length > 0) {
      const totalAdjustment = this.normalizationSteps.reduce((sum, step) => sum + step.adjustmentSeconds, 0);
      console.log(`  Total time adjustment: ${totalAdjustment > 0 ? '+' : ''}${totalAdjustment.toFixed(3)}s`);
      
      console.log(`  Step breakdown:`);
      this.normalizationSteps.forEach(step => {
        const beforeTimeStr = `${step.beforeTime.minutes}:${step.beforeTime.seconds.toString().padStart(2, '0')}.${step.beforeTime.tenths}`;
        const afterTimeStr = `${step.afterTime.minutes}:${step.afterTime.seconds.toString().padStart(2, '0')}.${step.afterTime.tenths}`;
        console.log(`    - ${step.stepName}: ${beforeTimeStr} → ${afterTimeStr} (${step.adjustmentSeconds > 0 ? '+' : ''}${step.adjustmentSeconds.toFixed(3)}s) - ${step.reason}`);
      });
    }
    
    // Connection Analysis
    console.log(`\n🌐 CONNECTION ANALYSIS:`);
    console.log(`  Total connection attempts: ${this.connectionAttempts.length}`);
    const failedConnections = this.connectionAttempts.filter(conn => !conn.success);
    console.log(`  Failed connections: ${failedConnections.length}`);
    
    if (failedConnections.length > 0) {
      console.log(`  Connection issues:`);
      failedConnections.forEach(conn => {
        console.log(`    - ${conn.url}: ${conn.error || 'Unknown error'} (Retry ${conn.retryCount})`);
      });
    }
    
    const avgResponseTime = this.connectionAttempts
      .filter(conn => conn.success && conn.responseTime)
      .reduce((sum, conn) => sum + (conn.responseTime || 0), 0) / 
      this.connectionAttempts.filter(conn => conn.success && conn.responseTime).length;
    
    if (!isNaN(avgResponseTime)) {
      console.log(`  Average response time: ${avgResponseTime.toFixed(1)}ms`);
    }
    
    // Performance Insights
    console.log(`\n💡 PERFORMANCE INSIGHTS:`);
    if (this.checkpoints.length > 0) {
      const phases = [...new Set(this.checkpoints.map(cp => cp.phase))];
      phases.forEach(phase => {
        const phaseCheckpoints = this.checkpoints.filter(cp => cp.phase === phase);
        const failures = phaseCheckpoints.filter(cp => !cp.success);
        const successRate = ((phaseCheckpoints.length - failures.length) / phaseCheckpoints.length * 100).toFixed(1);
        console.log(`  ${phase}: ${successRate}% success rate (${phaseCheckpoints.length} checkpoints)`);
      });
    }
    
    console.log(`\n💾 DETAILED LOG ENTRIES: ${this.detailedLogs.length}`);
    console.log(`===============================================\n`);
  }
  
  static logErrorRecovery(
    horseName: string,
    errorType: string,
    recoveryAction: string,
    success: boolean
  ): void {
    if (!this.isTargetHorse(horseName)) return;
    
    const debuggerInstance = this.getInstance();
    debuggerInstance.logDetailedMessage(
      `🔧 ERROR RECOVERY: ${errorType}`,
      {
        recoveryAction,
        success: success ? 'Recovered successfully' : 'Recovery failed'
      }
    );
  }
}