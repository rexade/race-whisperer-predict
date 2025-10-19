
import { KmTime } from '../../../services/types/kmTimeTypes';
import { kmTimeToSeconds, parseKmTime } from '../../../services/utils/kmTimeUtils';

/**
 * Calculate Mean Absolute Error for position predictions
 */
export const calculatePositionMAE = (predictions: Array<{ predicted: number; actual: number }>): number => {
  if (predictions.length === 0) return 0;
  
  const totalError = predictions.reduce((sum, { predicted, actual }) => {
    return sum + Math.abs(predicted - actual);
  }, 0);
  
  return totalError / predictions.length;
};

/**
 * Calculate Mean Absolute Error for time predictions in seconds
 */
export const calculateTimeMAE = (predictions: Array<{ predicted: KmTime; actual: KmTime }>): number => {
  if (predictions.length === 0) return 0;
  
  const totalError = predictions.reduce((sum, { predicted, actual }) => {
    const predictedSeconds = kmTimeToSeconds(predicted);
    const actualSeconds = kmTimeToSeconds(actual);
    return sum + Math.abs(predictedSeconds - actualSeconds);
  }, 0);
  
  return totalError / predictions.length;
};

/**
 * Parse time string to KmTime object
 * Handles formats like "1:12.5", "1:12.50", "12.5", etc.
 */
export const parseActualTime = (timeString: string): KmTime | null => {
  try {
    if (!timeString || timeString === 'N/A' || timeString === 'Unknown') {
      return null;
    }
    
    // Clean the time string
    const cleanTime = timeString.trim();
    
    // Handle different formats
    if (cleanTime.includes(':')) {
      // Format: "1:12.5" or "1:12.50"
      return parseKmTime(cleanTime);
    } else if (cleanTime.includes('.')) {
      // Format: "72.5" (just seconds.tenths)
      const [seconds, tenths] = cleanTime.split('.');
      const totalSeconds = parseInt(seconds);
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      
      return {
        minutes,
        seconds: remainingSeconds,
        tenths: parseInt(tenths?.charAt(0) || '0')
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to parse time: ${timeString}`, error);
    return null;
  }
};

/**
 * Find the best (fastest) time in a list of times
 */
export const findBestTime = (times: Array<{ horseId: number; time: KmTime }>): { horseId: number; time: KmTime } | null => {
  if (times.length === 0) return null;
  
  return times.reduce((best, current) => {
    const bestSeconds = kmTimeToSeconds(best.time);
    const currentSeconds = kmTimeToSeconds(current.time);
    return currentSeconds < bestSeconds ? current : best;
  });
};

/**
 * Calculate time difference in seconds between two KmTime objects
 */
export const calculateTimeDifference = (predicted: KmTime, actual: KmTime): number => {
  return kmTimeToSeconds(actual) - kmTimeToSeconds(predicted);
};

/**
 * Format time difference for display
 */
export const formatTimeDifference = (seconds: number): string => {
  const sign = seconds >= 0 ? '+' : '';
  return `${sign}${seconds.toFixed(1)}s`;
};

/**
 * Get time accuracy color based on difference
 */
export const getTimeAccuracyColor = (timeDifference: number): string => {
  const absError = Math.abs(timeDifference);
  if (absError <= 1) return "text-green-600";
  if (absError <= 3) return "text-yellow-600";
  return "text-red-600";
};
