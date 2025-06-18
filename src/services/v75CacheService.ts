
export interface CachedV75Horse {
  horseId: number;
  horseName: string;
  postPosition: number;
  rawKmTime?: {
    minutes: number;
    seconds: number;
    tenths: number;
  };
  // Store additional data that doesn't change
  distance: number;
  startMethod: string;
  driverName: string;
  statistics?: {
    startPoints: number;
    placePercentage: number;
    winPercentage: number;
    earningsPerStart: number;
  };
  driver2025WinPercentage?: number;
  sulkyType?: string;
  shoesFront?: boolean;
  shoesBack?: boolean;
  homeTrack?: string;
}

export interface CachedV75Race {
  raceNumber: number;
  raceId: string;
  track: string;
  distance: number;
  startMethod: string;
  name: string;
  prize: number;
  horses: CachedV75Horse[];
  cachedAt: string; // ISO timestamp
}

export interface CachedV75Analysis {
  date: string;
  gameId: string;
  races: CachedV75Race[];
  cachedAt: string;
}

const CACHE_KEY_PREFIX = 'v75_analysis_';
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

export class V75CacheService {
  private static getCacheKey(date: string): string {
    return `${CACHE_KEY_PREFIX}${date}`;
  }

  static async storeAnalysis(date: string, gameId: string, races: CachedV75Race[]): Promise<void> {
    console.log(`💾 Storing V75 analysis cache for ${date}`);
    
    const cacheData: CachedV75Analysis = {
      date,
      gameId,
      races,
      cachedAt: new Date().toISOString()
    };

    try {
      const cacheKey = this.getCacheKey(date);
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      console.log(`✅ V75 analysis cached successfully for ${date}:`);
      console.log(`   - ${races.length} races`);
      console.log(`   - ${races.reduce((sum, race) => sum + race.horses.length, 0)} total horses`);
      console.log(`   - Raw times cached for future use`);
      
    } catch (error) {
      console.error('❌ Failed to store V75 analysis cache:', error);
    }
  }

  static async getAnalysis(date: string): Promise<CachedV75Analysis | null> {
    console.log(`🔍 Looking for cached V75 analysis for ${date}`);
    
    try {
      const cacheKey = this.getCacheKey(date);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) {
        console.log(`❌ No cache found for ${date}`);
        return null;
      }

      const analysis: CachedV75Analysis = JSON.parse(cachedData);
      
      // Check if cache is still valid
      const cachedAt = new Date(analysis.cachedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > CACHE_EXPIRY_HOURS) {
        console.log(`⏰ Cache expired for ${date} (${hoursDiff.toFixed(1)} hours old)`);
        this.clearAnalysis(date);
        return null;
      }

      console.log(`✅ Found valid cached analysis for ${date}:`);
      console.log(`   - Cached ${hoursDiff.toFixed(1)} hours ago`);
      console.log(`   - ${analysis.races.length} races`);
      console.log(`   - Raw times ready for instant use`);
      
      return analysis;
      
    } catch (error) {
      console.error(`❌ Error reading cache for ${date}:`, error);
      return null;
    }
  }

  static clearAnalysis(date: string): void {
    const cacheKey = this.getCacheKey(date);
    localStorage.removeItem(cacheKey);
    console.log(`🗑️ Cleared cache for ${date}`);
  }

  static clearAllCache(): void {
    const keys = Object.keys(localStorage);
    const v75Keys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    v75Keys.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Cleared ${v75Keys.length} V75 cache entries`);
  }

  static getCacheInfo(): { dates: string[], totalSize: number } {
    const keys = Object.keys(localStorage);
    const v75Keys = keys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    const dates = v75Keys.map(key => key.replace(CACHE_KEY_PREFIX, ''));
    const totalSize = v75Keys.reduce((size, key) => {
      const data = localStorage.getItem(key);
      return size + (data ? data.length : 0);
    }, 0);

    return { dates, totalSize };
  }
}
