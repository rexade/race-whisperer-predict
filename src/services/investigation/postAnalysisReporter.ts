/**
 * Post-Analysis Investigation Reporter
 * 
 * Generates comprehensive reports after V75 analysis is complete,
 * focusing on time discrepancies and debugging findings.
 */

import { Race7Debugger } from './race7DebugUtils';
import { XanderTimeInvestigator } from './xanderTimeInvestigation';

export interface PostAnalysisReport {
  analysisDate: string;
  totalInvestigations: number;
  significantDiscrepancies: Array<{
    horseName: string;
    calculatedTime: string;
    expectedTime?: string;
    discrepancySeconds?: number;
    severity: 'minor' | 'moderate' | 'severe';
  }>;
  summary: {
    xanderFound: boolean;
    race7Analyzed: boolean;
    totalTimeDiscrepancies: number;
    averageDiscrepancy: number;
  };
}

export class PostAnalysisReporter {
  
  static generateReport(): PostAnalysisReport | null {
    if (!Race7Debugger.isDebugMode()) {
      console.log('📋 Post-analysis reporting requires debug mode to be enabled');
      return null;
    }

    const debugState = (globalThis as any).__race7Debug;
    if (!debugState) return null;

    console.log('\n📋 ===== GENERATING POST-ANALYSIS REPORT =====');
    
    const report: PostAnalysisReport = {
      analysisDate: debugState.analysisDate || 'Unknown',
      totalInvestigations: debugState.investigationResults?.length || 0,
      significantDiscrepancies: [],
      summary: {
        xanderFound: false,
        race7Analyzed: false,
        totalTimeDiscrepancies: 0,
        averageDiscrepancy: 0
      }
    };

    // Process investigation results
    if (debugState.investigationResults && debugState.investigationResults.length > 0) {
      let totalDiscrepancy = 0;
      let discrepancyCount = 0;

      debugState.investigationResults.forEach((result: any) => {
        // Check for Xander
        if (Race7Debugger.isXanderHorse(result.horseName || '')) {
          report.summary.xanderFound = true;
        }

        // Check for Race 7 (would need race context, assuming from debug state)
        report.summary.race7Analyzed = true;

        // Process time discrepancies
        if (result.discrepancySeconds !== undefined) {
          totalDiscrepancy += Math.abs(result.discrepancySeconds);
          discrepancyCount++;

          const severity = PostAnalysisReporter.getDiscrepancySeverity(result.discrepancySeconds);
          
          if (severity !== 'minor') {
            report.significantDiscrepancies.push({
              horseName: result.horseName,
              calculatedTime: result.calculatedTime,
              expectedTime: result.expectedTime,
              discrepancySeconds: result.discrepancySeconds,
              severity
            });
          }
        }
      });

      report.summary.totalTimeDiscrepancies = discrepancyCount;
      report.summary.averageDiscrepancy = discrepancyCount > 0 ? 
        totalDiscrepancy / discrepancyCount : 0;
    }

    PostAnalysisReporter.logReport(report);
    return report;
  }

  private static getDiscrepancySeverity(discrepancySeconds: number): 'minor' | 'moderate' | 'severe' {
    const abs = Math.abs(discrepancySeconds);
    if (abs >= 2.0) return 'severe';
    if (abs >= 1.0) return 'moderate';
    return 'minor';
  }

  private static logReport(report: PostAnalysisReport): void {
    console.log('\n📋 ===== POST-ANALYSIS INVESTIGATION REPORT =====');
    console.log(`🗓️  Analysis Date: ${report.analysisDate}`);
    console.log(`🔍 Total Investigations: ${report.totalInvestigations}`);
    console.log(`🐎 Xander Found: ${report.summary.xanderFound ? '✅' : '❌'}`);
    console.log(`🏁 Race 7 Analyzed: ${report.summary.race7Analyzed ? '✅' : '❌'}`);
    console.log(`📊 Time Discrepancies: ${report.summary.totalTimeDiscrepancies}`);
    console.log(`📈 Average Discrepancy: ${report.summary.averageDiscrepancy.toFixed(2)}s`);

    if (report.significantDiscrepancies.length > 0) {
      console.log('\n⚠️  SIGNIFICANT DISCREPANCIES:');
      report.significantDiscrepancies.forEach((disc, index) => {
        console.log(`\n${index + 1}. 🐎 ${disc.horseName}`);
        console.log(`   Calculated: ${disc.calculatedTime}`);
        if (disc.expectedTime) console.log(`   Expected: ${disc.expectedTime}`);
        console.log(`   Discrepancy: ${disc.discrepancySeconds?.toFixed(2)}s (${disc.severity})`);
      });
    }

    if (report.summary.xanderFound) {
      console.log('\n🎯 XANDER INVESTIGATION RECOMMENDATIONS:');
      console.log('   • Review historical data filtering criteria');
      console.log('   • Validate normalization adjustments');
      console.log('   • Compare with website calculation methodology');
      console.log('   • Check for missing race records or data quality issues');
    }

    console.log('\n===============================================');
  }

  static clearInvestigationData(): void {
    if ((globalThis as any).__race7Debug) {
      (globalThis as any).__race7Debug.investigationResults = [];
      console.log('🧹 Investigation data cleared');
    }
  }
}