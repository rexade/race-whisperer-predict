import { ResultLikeRecord, StartMethod, Distance } from './recordsFallback';
import { HorseDebugger } from '../debugging/horseDebugger';

/**
 * Extended race endpoint structure for fallback data extraction
 */
interface ExtendedHorseData {
  id: number;
  name: string;
  record?: {
    code?: string;
    startMethod?: string;
    distance?: number;
    time?: {
      minutes: number;
      seconds: number;
      tenths: number;
    };
  };
  results?: {
    records?: any[];
  };
  statistics?: {
    life?: {
      records?: any[];
      placement?: Record<string, number>;
    };
    years?: Record<string, {
      records?: any[];
    }>;
  };
  money?: number;
  startPoints?: number;
}

interface ExtendedRaceStart {
  number: number;
  postPosition?: number;
  horse: ExtendedHorseData;
}

interface ExtendedRaceData {
  starts: ExtendedRaceStart[];
  track?: {
    name: string;
  };
  distance?: number;
}

// Cache for extended race data (per race run)
const extendedRaceCache = new Map<string, ExtendedRaceData | null>();

/**
 * Fetch extended race data from ATG API as ultimate fallback
 * Tries both www.atg.se and api.atg.se domains with retry + timeout
 * Caches result per raceId to avoid duplicate fetches
 */
export async function fetchExtendedRaceData(
  raceId: string
): Promise<ExtendedRaceData | null> {
  // Check cache first
  if (extendedRaceCache.has(raceId)) {
    return extendedRaceCache.get(raceId) ?? null;
  }

  try {
    const [date, track, raceNum] = raceId.split('_');
    const path = `${date}_${track}_${raceNum}/extended`;
    const candidates = [
      `/api/atg/races/${path}`,
      `https://api.atg.se/v1/races/${path}`
    ];
    
    for (const url of candidates) {
      try {
        console.log(`📡 [Extended Fallback] Trying: ${url}`);
        
        // Add timeout and retry logic
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        
        try {
          const response = await fetch(url, { 
            signal: controller.signal,
            headers: { accept: 'application/json' } 
          });
          
          if (response.ok) {
            console.log(`✅ [Extended Fallback] Success: ${url}`);
            const data = await response.json();
            
            // Cache the result
            extendedRaceCache.set(raceId, data);
            return data;
          }
          console.warn(`⚠️ [Extended Fallback] ${url} -> ${response.status}`);
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        console.warn(`⚠️ [Extended Fallback] ${url} failed:`, err);
      }
    }
    
    // Cache null result to avoid retry
    extendedRaceCache.set(raceId, null);
    return null;
  } catch (error) {
    console.error('❌ [Extended Fallback] Error fetching extended race data:', error);
    extendedRaceCache.set(raceId, null);
    return null;
  }
}

/**
 * Clear the extended race cache (call between races)
 */
export function clearExtendedRaceCache(): void {
  extendedRaceCache.clear();
}

/**
 * Extract records from extended endpoint horse data (3rd fallback tier)
 */
export function extractRecordsFromExtended(
  horse: ExtendedHorseData,
  debugLog: boolean = false
): ResultLikeRecord[] {
  const records: ResultLikeRecord[] = [];
  
  // 1️⃣ Try standard results.records (same as /horse/{id})
  // Normalize to 'results' source for 1.0 confidence (these are real race results)
  // Keep provenance flag for telemetry
  if (horse.results?.records?.length) {
    if (debugLog) {
      console.log(`📄 [Extended] Found ${horse.results.records.length} results.records for ${horse.name}`);
    }
    return horse.results.records.map(r => ({
      ...r,
      meta: { source: 'results' as const, extended: true }
    }));
  }
  
  // 2️⃣ Try statistics.life.records
  const lifeRecords = horse.statistics?.life?.records ?? [];
  if (lifeRecords.length > 0) {
    if (debugLog) {
      console.log(`📊 [Extended] Found ${lifeRecords.length} life records for ${horse.name}`);
    }
    records.push(...lifeRecords.map(r => ({
      ...r,
      meta: { source: 'extended-statistics-life' }
    })));
  }
  
  // 3️⃣ Try statistics.years records
  const yearRecords = Object.values(horse.statistics?.years ?? {})
    .flatMap((year: any) => year.records ?? []);
  if (yearRecords.length > 0) {
    if (debugLog) {
      console.log(`📊 [Extended] Found ${yearRecords.length} year records for ${horse.name}`);
    }
    records.push(...yearRecords.map(r => ({
      ...r,
      meta: { source: 'extended-statistics-years' }
    })));
  }
  
  // 4️⃣ Ultimate fallback: use horse.record.time (single best time)
  if (records.length === 0 && horse.record?.time) {
    if (debugLog) {
      console.log(`🔴 [Extended] Using horse.record.time fallback for ${horse.name}`);
    }
    
    // Guard against missing statistics
    const wins = Number(horse.statistics?.life?.placement?.['1'] ?? 0);
    const hasWin = Number.isFinite(wins) && wins > 0;
    
    const startMethod = horse.record.startMethod as StartMethod | undefined;
    
    records.push({
      date: undefined,
      kmTime: {
        minutes: horse.record.time.minutes,
        seconds: horse.record.time.seconds,
        tenths: horse.record.time.tenths,
        code: horse.record.code
      },
      place: hasWin ? 1 : 0,
      race: {
        startMethod: startMethod
      },
      track: { name: 'Unknown' },
      start: {
        // Leave empty - no reliable position data from single record
      },
      galloped: false,
      disqualified: false,
      meta: { 
        source: 'extended-fallback-record',
        isLastResort: true,
        code: horse.record.code,
        startMethod: startMethod,
        distance: undefined, // Can't reliably map meters to category from single record
        extended: true
      }
    });
  }
  
  return records;
}

/**
 * Check if records originated from extended API fallback
 */
export function isExtendedFallback(records: ResultLikeRecord[]): boolean {
  return records.some(r => 
    r.meta?.extended === true ||
    r.meta?.source?.startsWith('extended-') || 
    r.meta?.isLastResort === true
  );
}

/**
 * Get confidence multiplier based on extended fallback usage
 * Treats extended-results as real results (1.0 confidence)
 */
export function getExtendedConfidenceMultiplier(records: ResultLikeRecord[]): number {
  if (records.length === 0) return 0;
  
  // Real results from extended endpoint = full confidence
  if (records.some(r => r.meta?.source === 'results')) {
    return 1.0;
  }
  
  // Last resort (single horse.record.time) = lowest confidence
  if (records.some(r => r.meta?.isLastResort === true)) {
    return 0.5;
  }
  
  // Extended statistics data = medium confidence
  if (records.some(r => r.meta?.source?.startsWith('extended-statistics'))) {
    return 0.7;
  }
  
  return 1.0; // Default
}

/**
 * Log extended fallback usage to telemetry
 */
export function logExtendedFallbackUsage(
  horseId: number,
  horseName: string,
  records: ResultLikeRecord[]
): void {
  if (isExtendedFallback(records)) {
    const isLastResort = records.some(r => r.meta?.isLastResort === true);
    const hasRealResults = records.some(r => r.meta?.source === 'results' && r.meta?.extended === true);
    
    if (isLastResort) {
      HorseDebugger.log(
        horseId,
        horseName,
        'EXTENDED_API_FALLBACK_USED',
        {
          recordCount: records.length,
          source: 'horse.record.time',
          confidence: 0.5,
          fallbackType: 'last-resort'
        }
      );
      console.log(`📡 [EXTENDED Fallback] ${horseName}: used horse.record.time (confidence: 0.5)`);
    } else if (hasRealResults) {
      HorseDebugger.log(
        horseId,
        horseName,
        'EXTENDED_API_USED',
        {
          recordCount: records.length,
          source: 'extended.results.records',
          confidence: 1.0,
          fallbackType: 'real-results-via-extended'
        }
      );
      console.log(`📡 [EXTENDED Source] ${horseName}: used real results from extended endpoint (confidence: 1.0)`);
    } else {
      HorseDebugger.log(
        horseId,
        horseName,
        'EXTENDED_API_FALLBACK_USED',
        {
          recordCount: records.length,
          sources: records.map(r => r.meta?.source).filter(Boolean),
          confidence: 0.7,
          fallbackType: 'statistics-via-extended'
        }
      );
      console.log(`📡 [EXTENDED Fallback] ${horseName}: used extended API statistics (confidence: 0.7)`);
    }
  }
}

/**
 * Get telemetry breakdown for extended fallback usage
 */
export function getExtendedBreakdown(records: ResultLikeRecord[]): {
  totalRecords: number;
  extendedRecords: number;
  lastResortRecords: number;
  regularRecords: number;
  realResultsViaExtended: number;
} {
  return {
    totalRecords: records.length,
    extendedRecords: records.filter(r => r.meta?.extended === true).length,
    lastResortRecords: records.filter(r => r.meta?.isLastResort === true).length,
    regularRecords: records.filter(r => !r.meta?.extended).length,
    realResultsViaExtended: records.filter(r => r.meta?.source === 'results' && r.meta?.extended === true).length
  };
}
