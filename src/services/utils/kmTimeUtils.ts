
export interface KmTime {
  minutes: number;
  seconds: number;
  tenths: number;
}

/**
 * Converts KM time object to seconds for calculations
 */
export const kmTimeToSeconds = (kmTime: KmTime): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};

/**
 * Converts seconds back to KM time format
 */
export const secondsToKmTime = (seconds: number): KmTime => {
  // Input validation
  if (isNaN(seconds) || !isFinite(seconds)) {
    console.error('🚨 secondsToKmTime: Invalid seconds input:', seconds);
    return { minutes: 0, seconds: 0, tenths: 0 };
  }
  
  if (seconds < 0) {
    console.warn('⚠️ secondsToKmTime: Negative seconds, clamping to 0:', seconds);
    seconds = 0;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const secs = Math.floor(remainingSeconds);
  
  // ENHANCED: Better precision for tenths calculation
  // Use 3 decimal places for intermediate calculation to avoid rounding errors
  const fractionalPart = remainingSeconds - secs;
  const tenths = Math.round(fractionalPart * 10);
  
  // Handle tenths overflow with proper cascading
  if (tenths >= 10) {
    const newSecs = secs + 1;
    if (newSecs >= 60) {
      return {
        minutes: minutes + 1,
        seconds: 0,
        tenths: 0
      };
    } else {
      return {
        minutes: minutes,
        seconds: newSecs,
        tenths: 0
      };
    }
  }
  
  const result = {
    minutes: minutes,
    seconds: secs,
    tenths: Math.max(0, Math.min(9, tenths)) // Clamp tenths to 0-9 range
  };
  
  // Validation of output
  if (result.minutes < 0 || result.seconds < 0 || result.seconds >= 60 || 
      result.tenths < 0 || result.tenths >= 10) {
    console.error('🚨 secondsToKmTime: Invalid result generated:', result, 'from seconds:', seconds);
  }
  
  return result;
};

/**
 * Formats KM time object as string
 */
export const formatKmTime = (kmTime: KmTime): string => {
  return `${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths}`;
};

/**
 * Parses KM time string to object
 */
export const parseKmTime = (kmTimeString: string): KmTime => {
  const [minutes, secondsPart] = kmTimeString.split(':');
  const [seconds, tenths] = secondsPart.split('.');
  
  return {
    minutes: parseInt(minutes),
    seconds: parseInt(seconds),
    tenths: parseInt(tenths)
  };
};

/**
 * Adds seconds to a KM time object
 */
export const addSecondsToKmTime = (kmTime: KmTime, secondsToAdd: number): KmTime => {
  const totalSeconds = kmTimeToSeconds(kmTime) + secondsToAdd;
  return secondsToKmTime(totalSeconds);
};

/**
 * Subtracts seconds from a KM time object
 */
export const subtractSecondsFromKmTime = (kmTime: KmTime, secondsToSubtract: number): KmTime => {
  const totalSeconds = kmTimeToSeconds(kmTime) - secondsToSubtract;
  return secondsToKmTime(Math.max(0, totalSeconds)); // Prevent negative times
};

/**
 * Compares two KM times (-1 if a < b, 0 if equal, 1 if a > b)
 */
export const compareKmTimes = (a: KmTime, b: KmTime): number => {
  const aSeconds = kmTimeToSeconds(a);
  const bSeconds = kmTimeToSeconds(b);
  
  if (aSeconds < bSeconds) return -1;
  if (aSeconds > bSeconds) return 1;
  return 0;
};

/**
 * Creates a copy of a KM time object
 */
export const cloneKmTime = (kmTime: KmTime): KmTime => {
  return {
    minutes: kmTime.minutes,
    seconds: kmTime.seconds,
    tenths: kmTime.tenths
  };
};

/**
 * Checks if a time is 0:00.0 (treat as "no time")
 */
export const isZeroTime = (t: { minutes: number; seconds: number; tenths: number }): boolean => {
  return t.minutes === 0 && t.seconds === 0 && (t.tenths ?? 0) === 0;
};

/**
 * Checks if a record has numeric km time values (excluding 0:00.0)
 */
export const hasNumericKmTime = (r: any): boolean => {
  const ok = Number.isFinite(r?.kmTime?.minutes) &&
    Number.isFinite(r?.kmTime?.seconds) &&
    Number.isFinite(r?.kmTime?.tenths);
  return ok && !isZeroTime(r.kmTime);
};
