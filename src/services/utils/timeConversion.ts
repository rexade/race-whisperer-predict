
import { KmTime } from '../types/kmTimeTypes';

export const convertKmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};

/**
 * Converts legacy KM time object to new KM time format
 */
export const convertToKmTime = (kmTime: { minutes: number; seconds: number; tenths: number }): KmTime => {
  return {
    minutes: kmTime.minutes,
    seconds: kmTime.seconds,
    tenths: kmTime.tenths
  };
};
