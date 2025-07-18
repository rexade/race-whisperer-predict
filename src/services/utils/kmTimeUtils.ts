
import { TimeLogger } from './enhancedLogging';
import { validateKmTime } from './timeValidation';

export interface KmTime {
  minutes: number;
  seconds: number;
  tenths: number;
}

/**
 * Converts KM time object to seconds for calculations
 */
export const kmTimeToSeconds = (kmTime: KmTime): number => {
  // Validate input
  const validation = validateKmTime(kmTime, 'kmTimeToSeconds input');
  if (!validation.isValid) {
    TimeLogger.logValidation('kmTimeToSeconds', false, validation.errors);
    console.warn('Invalid KM time in kmTimeToSeconds:', validation.errors);
  }

  const result = kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
  
  TimeLogger.logTimeConversion('kmTimeToSeconds', kmTime, result);
  
  return result;
};

/**
 * Converts seconds back to KM time format
 */
export const secondsToKmTime = (seconds: number): KmTime => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    TimeLogger.logValidation('secondsToKmTime', false, { input: seconds, error: 'Invalid seconds value' });
    console.warn('Invalid seconds value in secondsToKmTime:', seconds);
    return { minutes: 0, seconds: 0, tenths: 0 };
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const secs = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - secs) * 10);
  
  let result: KmTime;
  
  // Handle tenths overflow
  if (tenths >= 10) {
    result = {
      minutes: minutes,
      seconds: secs + 1,
      tenths: 0
    };
  } else {
    result = {
      minutes: minutes,
      seconds: secs,
      tenths: tenths
    };
  }

  // Validate output
  const validation = validateKmTime(result, 'secondsToKmTime output');
  if (!validation.isValid) {
    TimeLogger.logValidation('secondsToKmTime output', false, validation.errors);
    console.warn('Invalid KM time generated in secondsToKmTime:', validation.errors);
  }

  TimeLogger.logTimeConversion('secondsToKmTime', seconds, result);
  
  return result;
};

/**
 * Formats KM time object as string
 */
export const formatKmTime = (kmTime: KmTime): string => {
  const validation = validateKmTime(kmTime, 'formatKmTime input');
  if (!validation.isValid) {
    TimeLogger.logValidation('formatKmTime', false, validation.errors);
    return 'INVALID';
  }

  return `${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths}`;
};

/**
 * Parses KM time string to object
 */
export const parseKmTime = (kmTimeString: string): KmTime => {
  if (!kmTimeString || typeof kmTimeString !== 'string') {
    TimeLogger.logValidation('parseKmTime', false, { input: kmTimeString, error: 'Invalid input string' });
    return { minutes: 0, seconds: 0, tenths: 0 };
  }

  try {
    const [minutes, secondsPart] = kmTimeString.split(':');
    const [seconds, tenths] = secondsPart.split('.');
    
    const result: KmTime = {
      minutes: parseInt(minutes),
      seconds: parseInt(seconds),
      tenths: parseInt(tenths)
    };

    const validation = validateKmTime(result, 'parseKmTime output');
    if (!validation.isValid) {
      TimeLogger.logValidation('parseKmTime', false, validation.errors);
      console.warn('Invalid parsed KM time:', validation.errors);
      return { minutes: 0, seconds: 0, tenths: 0 };
    }

    TimeLogger.logTimeConversion('parseKmTime', kmTimeString, result);
    return result;
    
  } catch (error) {
    TimeLogger.logValidation('parseKmTime', false, { input: kmTimeString, error: error instanceof Error ? error.message : 'Parse error' });
    console.warn('Failed to parse KM time string:', kmTimeString, error);
    return { minutes: 0, seconds: 0, tenths: 0 };
  }
};

/**
 * Adds seconds to a KM time object
 */
export const addSecondsToKmTime = (kmTime: KmTime, secondsToAdd: number): KmTime => {
  const validation = validateKmTime(kmTime, 'addSecondsToKmTime input');
  if (!validation.isValid) {
    TimeLogger.logValidation('addSecondsToKmTime', false, validation.errors);
    console.warn('Invalid input KM time in addSecondsToKmTime:', validation.errors);
    return kmTime;
  }

  if (!Number.isFinite(secondsToAdd)) {
    TimeLogger.logValidation('addSecondsToKmTime', false, { secondsToAdd, error: 'Invalid seconds to add' });
    console.warn('Invalid seconds to add:', secondsToAdd);
    return kmTime;
  }

  const totalSeconds = kmTimeToSeconds(kmTime) + secondsToAdd;
  const result = secondsToKmTime(totalSeconds);
  
  TimeLogger.logTimeConversion('addSecondsToKmTime', { kmTime, secondsToAdd }, result);
  
  return result;
};

/**
 * Subtracts seconds from a KM time object
 */
export const subtractSecondsFromKmTime = (kmTime: KmTime, secondsToSubtract: number): KmTime => {
  const validation = validateKmTime(kmTime, 'subtractSecondsFromKmTime input');
  if (!validation.isValid) {
    TimeLogger.logValidation('subtractSecondsFromKmTime', false, validation.errors);
    console.warn('Invalid input KM time in subtractSecondsFromKmTime:', validation.errors);
    return kmTime;
  }

  if (!Number.isFinite(secondsToSubtract)) {
    TimeLogger.logValidation('subtractSecondsFromKmTime', false, { secondsToSubtract, error: 'Invalid seconds to subtract' });
    console.warn('Invalid seconds to subtract:', secondsToSubtract);
    return kmTime;
  }

  const totalSeconds = kmTimeToSeconds(kmTime) - secondsToSubtract;
  const result = secondsToKmTime(Math.max(0, totalSeconds)); // Prevent negative times
  
  TimeLogger.logTimeConversion('subtractSecondsFromKmTime', { kmTime, secondsToSubtract }, result);
  
  return result;
};

/**
 * Compares two KM times (-1 if a < b, 0 if equal, 1 if a > b)
 */
export const compareKmTimes = (a: KmTime, b: KmTime): number => {
  const aValidation = validateKmTime(a, 'compareKmTimes first time');
  const bValidation = validateKmTime(b, 'compareKmTimes second time');
  
  if (!aValidation.isValid || !bValidation.isValid) {
    TimeLogger.logValidation('compareKmTimes', false, { 
      aErrors: aValidation.errors, 
      bErrors: bValidation.errors 
    });
    console.warn('Invalid KM times in comparison:', { aValidation, bValidation });
    return 0; // Return equal for invalid comparisons
  }

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
  const validation = validateKmTime(kmTime, 'cloneKmTime input');
  if (!validation.isValid) {
    TimeLogger.logValidation('cloneKmTime', false, validation.errors);
    console.warn('Invalid KM time in cloneKmTime:', validation.errors);
    return { minutes: 0, seconds: 0, tenths: 0 };
  }

  const result = {
    minutes: kmTime.minutes,
    seconds: kmTime.seconds,
    tenths: kmTime.tenths
  };

  TimeLogger.logTimeConversion('cloneKmTime', kmTime, result);
  
  return result;
};
