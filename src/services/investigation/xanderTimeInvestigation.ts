/**
 * Xander Time Investigation Utility
 * 
 * This file contains specialized debugging tools to investigate why Xander's
 * calculated raw time (1:16.1) differs from the website's faster times (1:14.6).
 */

export interface ExpectedTimeComparison {
  horseName: string;
  calculatedRawTime: string;
  expectedWebsiteTime: string;
  discrepancySeconds: number;
  potentialCauses: string[];
}

export interface TimeInvestigationReport {
  raceId: string;
  horseName: string;
  historicalRecordsFound: number;
  validRecordsAfterFiltering: number;
  filteredOutReasons: { [reason: string]: number };
  best3TimesUsed: Array<{
    date: string;
    originalTime: string;
    normalizedTime: string;
    distance: number;
    startMethod: string;
    place: number;
  }>;
  calculatedAverage: string;
  expectedTime?: string;
  discrepancy?: number;
  recommendations: string[];
}

export class XanderTimeInvestigator {
  
  static analyzeTimeDiscrepancy(
    horseName: string,
    calculatedTime: string,
    expectedTime: string
  ): ExpectedTimeComparison {
    
    const parseTime = (timeStr: string): number => {
      const [minutes, rest] = timeStr.split(':');
      const [seconds, tenths] = rest.split('.');
      return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(tenths) / 10;
    };
    
    const calculatedSeconds = parseTime(calculatedTime);
    const expectedSeconds = parseTime(expectedTime);
    const discrepancy = calculatedSeconds - expectedSeconds;
    
    const potentialCauses = [];
    
    if (discrepancy > 1.0) {
      potentialCauses.push("Historical data filtering may be too restrictive");
      potentialCauses.push("Recent fast times might not be in the 12-month window");
      potentialCauses.push("Normalization process might be adding too much time");
    }
    
    if (discrepancy > 0.5) {
      potentialCauses.push("Best-3 average calculation might include slower times");
      potentialCauses.push("Data source might be missing recent races");
    }
    
    return {
      horseName,
      calculatedRawTime: calculatedTime,
      expectedWebsiteTime: expectedTime,
      discrepancySeconds: discrepancy,
      potentialCauses
    };
  }
  
  static generateInvestigationReport(
    raceId: string,
    horseName: string,
    rawHistoricalCount: number,
    validRecordsCount: number,
    best3Times: Array<any>,
    calculatedAverage: string,
    expectedTime?: string
  ): TimeInvestigationReport {
    
    const report: TimeInvestigationReport = {
      raceId,
      horseName,
      historicalRecordsFound: rawHistoricalCount,
      validRecordsAfterFiltering: validRecordsCount,
      filteredOutReasons: {
        "disqualified": 0,
        "galloped": 0,
        "noTime": 0,
        "outsideTimeWindow": 0,
        "invalidPlace": 0
      },
      best3TimesUsed: best3Times.map(time => ({
        date: time.raceDate,
        originalTime: `${time.originalTime.minutes}:${time.originalTime.seconds}.${time.originalTime.tenths}`,
        normalizedTime: `${time.normalizedTime.minutes}:${time.normalizedTime.seconds}.${time.normalizedTime.tenths}`,
        distance: time.distance,
        startMethod: time.startMethod,
        place: time.finishOrder
      })),
      calculatedAverage,
      recommendations: []
    };
    
    if (expectedTime) {
      const comparison = this.analyzeTimeDiscrepancy(horseName, calculatedAverage, expectedTime);
      report.expectedTime = expectedTime;
      report.discrepancy = comparison.discrepancySeconds;
      report.recommendations = comparison.potentialCauses;
    }
    
    // Add specific recommendations based on data patterns
    if (validRecordsCount < rawHistoricalCount / 2) {
      report.recommendations.push("High filtering rate - consider relaxing some filter criteria");
    }
    
    if (validRecordsCount < 3) {
      report.recommendations.push("Insufficient historical data - may need fallback strategy");
    }
    
    return report;
  }
  
  static logDetailedReport(report: TimeInvestigationReport): void {
    console.log(`\n🔍 ===== DETAILED INVESTIGATION REPORT: ${report.horseName.toUpperCase()} =====`);
    console.log(`🎯 Race ID: ${report.raceId}`);
    console.log(`📊 Historical Records: ${report.historicalRecordsFound} found → ${report.validRecordsAfterFiltering} valid`);
    console.log(`🗑️  Filtering Rate: ${((report.historicalRecordsFound - report.validRecordsAfterFiltering) / report.historicalRecordsFound * 100).toFixed(1)}%`);
    
    console.log(`\n📈 Best 3 Times Used:`);
    report.best3TimesUsed.forEach((time, idx) => {
      console.log(`   ${idx + 1}. ${time.date}: ${time.originalTime} → ${time.normalizedTime} (${time.distance}m ${time.startMethod}, P${time.place})`);
    });
    
    console.log(`\n⏱️  Calculated Average: ${report.calculatedAverage}`);
    
    if (report.expectedTime && report.discrepancy !== undefined) {
      console.log(`🌐 Expected Website Time: ${report.expectedTime}`);
      console.log(`⚠️  Discrepancy: ${report.discrepancy > 0 ? '+' : ''}${report.discrepancy.toFixed(2)}s`);
      
      if (report.discrepancy > 0.5) {
        console.log(`❌ SIGNIFICANT DISCREPANCY DETECTED!`);
      }
    }
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
    }
    
    console.log(`===== END INVESTIGATION REPORT =====\n`);
  }
}