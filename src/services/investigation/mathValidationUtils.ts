import { KmTime } from '../types/kmTimeTypes';
import { kmTimeToSeconds, secondsToKmTime, formatKmTime } from '../utils/kmTimeUtils';

/**
 * Mathematical validation utilities for precise time calculations
 */
export class MathValidationUtils {
  /**
   * Validate time format conversions with detailed logging
   */
  static validateTimeConversions(kmTime: KmTime, context: string): number {
    console.log(`\n🔍 TIME CONVERSION VALIDATION - ${context}`);
    console.log(`Original KmTime:`, kmTime);
    
    const seconds = kmTimeToSeconds(kmTime);
    console.log(`Converted to seconds: ${seconds} (precise)`);
    
    const backToKmTime = secondsToKmTime(seconds);
    console.log(`Back to KmTime:`, backToKmTime);
    
    const formatted = formatKmTime(kmTime);
    console.log(`Formatted: ${formatted}`);
    
    // Validate precision loss
    const originalSeconds = kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
    const precision = Math.abs(seconds - originalSeconds);
    console.log(`Precision check: ${precision < 0.001 ? '✅ PASS' : '❌ FAIL'} (diff: ${precision})`);
    
    return seconds;
  }

  /**
   * Calculate average with step-by-step logging
   */
  static calculateBest3AverageWithValidation(
    times: KmTime[], 
    horseName: string, 
    context: string
  ): { average: KmTime; validation: any } {
    console.log(`\n🧮 BEST-3 AVERAGE CALCULATION - ${horseName} - ${context}`);
    console.log(`Input times (${times.length}):`, times.map(formatKmTime));
    
    if (times.length === 0) {
      console.log(`❌ No times to average`);
      return { 
        average: { minutes: 0, seconds: 0, tenths: 0 }, 
        validation: { error: 'No times provided' } 
      };
    }

    // Convert to seconds for precise calculation
    const secondsArray = times.map((time, index) => {
      const seconds = this.validateTimeConversions(time, `Time ${index + 1}`);
      return seconds;
    });

    console.log(`Times in seconds:`, secondsArray);

    // Calculate average
    const totalSeconds = secondsArray.reduce((sum, seconds) => {
      console.log(`Adding: ${sum} + ${seconds} = ${sum + seconds}`);
      return sum + seconds;
    }, 0);
    
    console.log(`Total seconds: ${totalSeconds}`);
    console.log(`Division: ${totalSeconds} ÷ ${times.length} = ${totalSeconds / times.length}`);
    
    const averageSeconds = totalSeconds / times.length;
    console.log(`Average in seconds: ${averageSeconds} (precise)`);

    // Convert back to KmTime
    const averageKmTime = secondsToKmTime(averageSeconds);
    console.log(`Average as KmTime:`, averageKmTime);
    console.log(`Average formatted: ${formatKmTime(averageKmTime)}`);

    // Manual verification calculation
    const manualVerification = this.manualAverageCalculation(times);
    console.log(`Manual verification: ${formatKmTime(manualVerification)}`);
    
    const verification = {
      inputTimes: times.map(formatKmTime),
      inputTimesInSeconds: secondsArray,
      totalSeconds,
      averageSeconds,
      averageKmTime,
      averageFormatted: formatKmTime(averageKmTime),
      manualVerification: formatKmTime(manualVerification),
      matchesManual: Math.abs(kmTimeToSeconds(averageKmTime) - kmTimeToSeconds(manualVerification)) < 0.01
    };

    console.log(`Verification summary:`, verification);
    
    return { average: averageKmTime, validation: verification };
  }

  /**
   * Manual calculation method for cross-validation
   */
  private static manualAverageCalculation(times: KmTime[]): KmTime {
    console.log(`\n🔄 MANUAL VERIFICATION CALCULATION`);
    
    let totalTenths = 0;
    let totalSeconds = 0;
    let totalMinutes = 0;

    times.forEach((time, index) => {
      console.log(`Time ${index + 1}: ${time.minutes}:${time.seconds}.${time.tenths}`);
      totalMinutes += time.minutes;
      totalSeconds += time.seconds;
      totalTenths += time.tenths;
      console.log(`  Running totals - M:${totalMinutes} S:${totalSeconds} T:${totalTenths}`);
    });

    console.log(`Raw totals - Minutes: ${totalMinutes}, Seconds: ${totalSeconds}, Tenths: ${totalTenths}`);

    // Convert excess tenths to seconds
    const extraSeconds = Math.floor(totalTenths / 10);
    totalSeconds += extraSeconds;
    totalTenths = totalTenths % 10;
    console.log(`After tenths conversion - S:${totalSeconds} T:${totalTenths} (added ${extraSeconds}s)`);

    // Convert excess seconds to minutes
    const extraMinutes = Math.floor(totalSeconds / 60);
    totalMinutes += extraMinutes;
    totalSeconds = totalSeconds % 60;
    console.log(`After seconds conversion - M:${totalMinutes} S:${totalSeconds} (added ${extraMinutes}m)`);

    // Calculate averages
    const avgMinutes = Math.floor(totalMinutes / times.length);
    const avgSeconds = Math.floor(totalSeconds / times.length);
    const avgTenths = Math.floor(totalTenths / times.length);

    console.log(`Raw averages - M:${avgMinutes} S:${avgSeconds} T:${avgTenths}`);

    // Handle remainders by converting to seconds and back
    const totalSecondsForAverage = (totalMinutes * 60 + totalSeconds + totalTenths / 10) / times.length;
    const preciseResult = secondsToKmTime(totalSecondsForAverage);
    
    console.log(`Precise manual result: ${formatKmTime(preciseResult)}`);
    
    return preciseResult;
  }

  /**
   * Compare calculated result with expected time
   */
  static compareWithExpected(
    calculated: KmTime,
    expected: string | KmTime,
    horseName: string,
    context: string
  ): any {
    console.log(`\n📊 EXPECTED VS CALCULATED COMPARISON - ${horseName} - ${context}`);
    
    let expectedKmTime: KmTime;
    if (typeof expected === 'string') {
      const [minutes, secondsPart] = expected.split(':');
      const [seconds, tenths] = secondsPart.split('.');
      expectedKmTime = {
        minutes: parseInt(minutes),
        seconds: parseInt(seconds),
        tenths: parseInt(tenths)
      };
    } else {
      expectedKmTime = expected;
    }

    const calculatedSeconds = kmTimeToSeconds(calculated);
    const expectedSeconds = kmTimeToSeconds(expectedKmTime);
    const difference = calculatedSeconds - expectedSeconds;

    console.log(`Calculated: ${formatKmTime(calculated)} (${calculatedSeconds}s)`);
    console.log(`Expected: ${formatKmTime(expectedKmTime)} (${expectedSeconds}s)`);
    console.log(`Difference: ${difference > 0 ? '+' : ''}${difference.toFixed(3)}s`);
    console.log(`Accuracy: ${Math.abs(difference) <= 0.5 ? '✅ GOOD' : Math.abs(difference) <= 1.0 ? '⚠️ MARGINAL' : '❌ POOR'}`);

    return {
      calculated: formatKmTime(calculated),
      expected: formatKmTime(expectedKmTime),
      calculatedSeconds,
      expectedSeconds,
      differenceSeconds: difference,
      isAccurate: Math.abs(difference) <= 0.5,
      accuracyLevel: Math.abs(difference) <= 0.5 ? 'GOOD' : Math.abs(difference) <= 1.0 ? 'MARGINAL' : 'POOR'
    };
  }
}