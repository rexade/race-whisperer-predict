
export const convertKmTimeToSeconds = (kmTime: { minutes: number; seconds: number; tenths: number }): number => {
  return kmTime.minutes * 60 + kmTime.seconds + kmTime.tenths / 10;
};
