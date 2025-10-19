
export class LegacyMethods {
  // Legacy methods for backward compatibility - now deprecated
  static async storeAnalysis(): Promise<void> {
    console.warn('⚠️ storeAnalysis is deprecated - use storeRawTimes instead');
  }

  static async getAnalysis(): Promise<null> {
    console.warn('⚠️ getAnalysis is deprecated - use getRawTimes instead');
    return null;
  }

  static clearAnalysis(date: string): void {
    console.warn('⚠️ clearAnalysis is deprecated - use clearRawTimes instead');
  }
}
