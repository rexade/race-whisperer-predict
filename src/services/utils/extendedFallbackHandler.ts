import { ResultLikeRecord, StartMethod } from './recordsFallback';
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
  horse: ExtendedHorseData;
  startNumber: number;
}

interface ExtendedRaceData {
  starts: ExtendedRaceStart[];
  track?: {
    name: string;
  };
  distance?: number;
}

/**
 * Fetch extended race data from ATG API as ultimate fallback
 */
export async function fetchExtendedRaceData(
  raceId: string
): Promise<ExtendedRaceData | null> {
  try {
    const [date, track, raceNum] = raceId.split('_');
    const url = `https://api.atg.se/v1/races/${date}_${track}_${raceNum}/extended`;
    
    console.log(`📡 [Extended Fallback] Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`⚠️ [Extended Fallback] Failed to fetch: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ [Extended Fallback] Error fetching extended race data:', error);
    return null;
  }
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
  if (horse.results?.records?.length) {
    if (debugLog) {
      console.log(`📄 [Extended] Found ${horse.results.records.length} results.records for ${horse.name}`);
    }
    return horse.results.records.map(r => ({
      ...r,
      meta: { source: 'extended-results' }
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
    
    const hasWin = horse.statistics?.life?.placement?.['1'] > 0;
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
        distance: horse.record.distance
      },
      galloped: false,
      disqualified: false,
      meta: { 
        source: 'extended-fallback-record',
        isLastResort: true,
        code: horse.record.code,
        startMethod: startMethod
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
    r.meta?.source?.startsWith('extended-') || 
    r.meta?.isLastResort === true
  );
}

/**
 * Get confidence multiplier based on extended fallback usage
 */
export function getExtendedConfidenceMultiplier(records: ResultLikeRecord[]): number {
  if (records.length === 0) return 0;
  
  const hasLastResort = records.some(r => r.meta?.isLastResort === true);
  if (hasLastResort) {
    return 0.5; // Single record fallback = lowest confidence
  }
  
  const hasExtended = isExtendedFallback(records);
  if (hasExtended) {
    return 0.7; // Extended API data = medium confidence
  }
  
  return 1.0; // Normal confidence
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
    
    if (isLastResort) {
      HorseDebugger.log(
        horseId,
        horseName,
        'EXTENDED_API_FALLBACK_USED',
        {
          recordCount: records.length,
          source: 'horse.record.time',
          confidence: 0.5
        }
      );
      console.log(`📡 [EXTENDED Fallback] ${horseName}: used horse.record.time (confidence: 0.5)`);
    } else {
      HorseDebugger.log(
        horseId,
        horseName,
        'EXTENDED_API_FALLBACK_USED',
        {
          recordCount: records.length,
          sources: records.map(r => r.meta?.source).filter(Boolean),
          confidence: 0.7
        }
      );
      console.log(`📡 [EXTENDED Fallback] ${horseName}: used extended API data (confidence: 0.7)`);
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
} {
  return {
    totalRecords: records.length,
    extendedRecords: records.filter(r => r.meta?.source?.startsWith('extended-')).length,
    lastResortRecords: records.filter(r => r.meta?.isLastResort === true).length,
    regularRecords: records.filter(r => !r.meta?.source?.startsWith('extended-')).length
  };
}
