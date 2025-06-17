
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
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const secs = Math.floor(remainingSeconds);
  const tenths = Math.round((remainingSeconds - secs) * 10);
  
  // Handle tenths overflow
  if (tenths >= 10) {
    return {
      minutes: minutes,
      seconds: secs + 1,
      tenths: 0
    };
  }
  
  return {
    minutes: minutes,
    seconds: secs,
    tenths: tenths
  };
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
