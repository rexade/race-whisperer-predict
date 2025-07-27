import { KmTime } from '../types/kmTimeTypes';
import { formatKmTime, parseKmTime } from '../utils/kmTimeUtils';

/**
 * Service for comparing calculated times with expected/website times
 */
export class TimeComparisonService {
  private static expectedTimes: Map<string, string> = new Map([
    // Expected times from website analysis (can be expanded)
    ['xander', '1:14.6'],
    ['global_alm', '1:15.2'],
    ['ecurie_d_alba', '1:14.8']
  ]);

  /**
   * Get expected time for a horse from various sources
   */
  static getExpectedTime(horseName: string, raceId?: string): string | null {
    const normalizedName = horseName.toLowerCase().replace(/\s+/g, '_');
    
    // Check our expected times database
    for (const [key, time] of this.expectedTimes.entries()) {
      if (normalizedName.includes(key)) {
        console.log(`📊 Found expected time for ${horseName}: ${time} (source: internal database)`);
        return time;
      }
    }

    // Could be extended to fetch from real website APIs
    return null;
  }

  /**
   * Add or update expected time for a horse
   */
  static setExpectedTime(horseName: string, expectedTime: string): void {
    const normalizedName = horseName.toLowerCase().replace(/\s+/g, '_');
    this.expectedTimes.set(normalizedName, expectedTime);
    console.log(`📝 Updated expected time for ${horseName}: ${expectedTime}`);
  }

  /**
   * Compare calculated time with expected time if available
   */
  static compareWithExpectedIfAvailable(
    calculated: KmTime,
    horseName: string,
    context: string,
    raceId?: string
  ): any {
    const expectedTimeStr = this.getExpectedTime(horseName, raceId);
    
    if (!expectedTimeStr) {
      console.log(`ℹ️  No expected time available for ${horseName} - skipping comparison`);
      return {
        hasExpectedTime: false,
        calculated: formatKmTime(calculated),
        message: 'No expected time available for comparison'
      };
    }

    console.log(`\n📊 EXPECTED TIME COMPARISON - ${horseName} - ${context}`);
    
    try {
      const expectedKmTime = parseKmTime(expectedTimeStr);
      const calculatedSeconds = calculated.minutes * 60 + calculated.seconds + calculated.tenths / 10;
      const expectedSeconds = expectedKmTime.minutes * 60 + expectedKmTime.seconds + expectedKmTime.tenths / 10;
      const difference = calculatedSeconds - expectedSeconds;

      console.log(`Calculated: ${formatKmTime(calculated)} (${calculatedSeconds}s)`);
      console.log(`Expected: ${formatKmTime(expectedKmTime)} (${expectedSeconds}s)`);
      console.log(`Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(3)}s`);
      
      const accuracyLevel = Math.abs(difference) <= 0.5 ? 'EXCELLENT' : 
                           Math.abs(difference) <= 1.0 ? 'GOOD' : 
                           Math.abs(difference) <= 2.0 ? 'MARGINAL' : 'POOR';
      
      console.log(`Accuracy: ${accuracyLevel}`);

      return {
        hasExpectedTime: true,
        calculated: formatKmTime(calculated),
        expected: formatKmTime(expectedKmTime),
        calculatedSeconds,
        expectedSeconds,
        differenceSeconds: difference,
        accuracyLevel,
        isAcceptable: Math.abs(difference) <= 2.0,
        source: 'internal_database'
      };
    } catch (error) {
      console.warn(`Failed to parse expected time "${expectedTimeStr}" for ${horseName}:`, error);
      return {
        hasExpectedTime: false,
        calculated: formatKmTime(calculated),
        error: `Invalid expected time format: ${expectedTimeStr}`
      };
    }
  }

  /**
   * Analyze calculation accuracy for a race
   */
  static analyzeRaceAccuracy(results: Array<{ horseName: string; calculatedTime: KmTime }>): any {
    console.log(`\n📊 RACE ACCURACY ANALYSIS`);
    
    const comparisons = results.map(result => {
      const comparison = this.compareWithExpectedIfAvailable(
        result.calculatedTime,
        result.horseName,
        'Race Analysis'
      );
      
      return {
        horseName: result.horseName,
        ...comparison
      };
    });

    const horsesWithExpected = comparisons.filter(c => c.hasExpectedTime);
    const accurateCalculations = horsesWithExpected.filter(c => c.isAcceptable);
    
    console.log(`Horses with expected times: ${horsesWithExpected.length}/${results.length}`);
    console.log(`Accurate calculations: ${accurateCalculations.length}/${horsesWithExpected.length}`);
    
    if (horsesWithExpected.length > 0) {
      const averageError = horsesWithExpected.reduce((sum, c) => sum + Math.abs(c.differenceSeconds || 0), 0) / horsesWithExpected.length;
      console.log(`Average absolute error: ${averageError.toFixed(3)}s`);
    }

    return {
      totalHorses: results.length,
      horsesWithExpected: horsesWithExpected.length,
      accurateCalculations: accurateCalculations.length,
      accuracyRate: horsesWithExpected.length > 0 ? (accurateCalculations.length / horsesWithExpected.length) : 0,
      comparisons: horsesWithExpected
    };
  }
}