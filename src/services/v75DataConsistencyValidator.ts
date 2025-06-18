
import { V75CacheService } from './v75CacheService';
import { KmTime } from './types/kmTimeTypes';

export interface ConsistencyReport {
  raceId: string;
  raceNumber: number;
  analysisDate: string;
  issues: string[];
  horsesChecked: number;
  validPredictedTimes: number;
  estimatedTimes: number;
  missingTimes: number;
}

export class V75DataConsistencyValidator {
  /**
   * Validate data consistency between raw times cache and race analysis cache
   */
  static async validateConsistency(analysisDate: string): Promise<ConsistencyReport[]> {
    console.log(`🔍 VALIDATING DATA CONSISTENCY for ${analysisDate}`);
    
    const reports: ConsistencyReport[] = [];
    
    try {
      // Get all race analyses for the date
      const allAnalyses = await V75CacheService.getAllRaceAnalyses();
      const relevantAnalyses = allAnalyses.filter(analysis => analysis.analysisDate === analysisDate);
      
      console.log(`📋 Found ${relevantAnalyses.length} race analyses for ${analysisDate}`);
      
      for (const analysis of relevantAnalyses) {
        const report: ConsistencyReport = {
          raceId: analysis.raceId,
          raceNumber: analysis.raceNumber,
          analysisDate: analysis.analysisDate,
          issues: [],
          horsesChecked: 0,
          validPredictedTimes: 0,
          estimatedTimes: 0,
          missingTimes: 0
        };
        
        console.log(`\n🏁 Validating race ${analysis.raceNumber} (${analysis.raceId})`);
        
        // Get the full race analysis data
        const raceAnalysis = await V75CacheService.getRaceAnalysis(analysis.raceId);
        if (!raceAnalysis) {
          report.issues.push('Could not retrieve full race analysis data');
          reports.push(report);
          continue;
        }
        
        // Check raw times cache
        const rawTimesCache = await V75CacheService.getRawTimes(analysis.raceId);
        if (!rawTimesCache) {
          report.issues.push('No raw times cache found');
        } else {
          console.log(`  📊 Raw times cache: ${rawTimesCache.rawTimes.length} horses`);
        }
        
        report.horsesChecked = raceAnalysis.horses.length;
        
        // Validate each horse's data
        for (const horse of raceAnalysis.horses) {
          console.log(`  🐎 Checking horse ${horse.horseName} (${horse.horseId})`);
          
          // Check if horse has predicted time
          if (horse.predictedTime && this.isValidKmTime(horse.predictedTime)) {
            report.validPredictedTimes++;
            console.log(`    ✅ Valid predicted time: ${horse.predictedTime.minutes}:${horse.predictedTime.seconds.toString().padStart(2, '0')}.${horse.predictedTime.tenths}`);
          } else if (!horse.predictedTime) {
            report.missingTimes++;
            console.log(`    ❌ Missing predicted time`);
            
            // Check if raw time exists for this horse
            if (rawTimesCache) {
              const rawTimeExists = rawTimesCache.rawTimes.some(rt => rt.horseId === horse.horseId);
              if (rawTimeExists) {
                report.issues.push(`Horse ${horse.horseName} has raw time but no predicted time`);
              } else {
                console.log(`    📝 No raw time available (likely estimated data)`);
                report.estimatedTimes++;
              }
            }
          } else {
            report.issues.push(`Horse ${horse.horseName} has invalid predicted time format`);
            console.log(`    ⚠️ Invalid predicted time format:`, horse.predictedTime);
          }
        }
        
        console.log(`  📊 Race ${analysis.raceNumber} summary:`);
        console.log(`    - Horses checked: ${report.horsesChecked}`);
        console.log(`    - Valid predicted times: ${report.validPredictedTimes}`);
        console.log(`    - Missing times: ${report.missingTimes}`);
        console.log(`    - Estimated times: ${report.estimatedTimes}`);
        console.log(`    - Issues found: ${report.issues.length}`);
        
        reports.push(report);
      }
      
      // Overall summary
      const totalHorses = reports.reduce((sum, r) => sum + r.horsesChecked, 0);
      const totalValidTimes = reports.reduce((sum, r) => sum + r.validPredictedTimes, 0);
      const totalMissing = reports.reduce((sum, r) => sum + r.missingTimes, 0);
      const totalEstimated = reports.reduce((sum, r) => sum + r.estimatedTimes, 0);
      
      console.log(`\n📊 OVERALL CONSISTENCY REPORT for ${analysisDate}:`);
      console.log(`  - Races validated: ${reports.length}`);
      console.log(`  - Total horses: ${totalHorses}`);
      console.log(`  - Valid predicted times: ${totalValidTimes} (${((totalValidTimes/totalHorses)*100).toFixed(1)}%)`);
      console.log(`  - Missing times: ${totalMissing} (${((totalMissing/totalHorses)*100).toFixed(1)}%)`);
      console.log(`  - Estimated times: ${totalEstimated} (${((totalEstimated/totalHorses)*100).toFixed(1)}%)`);
      
      return reports;
      
    } catch (error) {
      console.error('❌ Error validating data consistency:', error);
      return [];
    }
  }
  
  /**
   * Validate KmTime object structure
   */
  private static isValidKmTime(time: any): time is KmTime {
    return time &&
           typeof time === 'object' &&
           typeof time.minutes === 'number' &&
           typeof time.seconds === 'number' &&
           typeof time.tenths === 'number' &&
           !isNaN(time.minutes) &&
           !isNaN(time.seconds) &&
           !isNaN(time.tenths) &&
           time.minutes >= 0 &&
           time.seconds >= 0 && time.seconds < 60 &&
           time.tenths >= 0 && time.tenths <= 9;
  }
  
  /**
   * Get a summary of cache status
   */
  static async getCacheStatus(): Promise<{
    rawTimesCount: number;
    raceAnalysesCount: number;
    availableDates: string[];
  }> {
    try {
      const cacheInfo = V75CacheService.getCacheInfo();
      const allAnalyses = await V75CacheService.getAllRaceAnalyses();
      const availableDates = [...new Set(allAnalyses.map(a => a.analysisDate))].sort().reverse();
      
      return {
        rawTimesCount: cacheInfo.raceIds.length,
        raceAnalysesCount: allAnalyses.length,
        availableDates
      };
    } catch (error) {
      console.error('❌ Error getting cache status:', error);
      return {
        rawTimesCount: 0,
        raceAnalysesCount: 0,
        availableDates: []
      };
    }
  }
}
