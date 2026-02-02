import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime, ProcessedKmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords, ATGHistoricalRecord } from './atgHistoricalApi';
import { HorseDebugger } from './debugging/horseDebugger';
import { DataValidator } from './debugging/dataValidator';
import { extractRecordsFromStatistics, originIncludesStatistics, getSourceConfidenceMultiplier } from './utils/recordsFallback';
import { toSeconds, secondsToKmParts } from './utils/robustTimeConversion';
import { fetchExtendedRaceData, extractRecordsFromExtended, isExtendedFallback, logExtendedFallbackUsage, getExtendedConfidenceMultiplier } from './utils/extendedFallbackHandler';
import { hasNumericKmTime, isZeroTime } from './utils/kmTimeUtils';

export const calculateRawKmTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawKmTime[]> => {
  const rawKmTimes: HorseRawKmTime[] = [];

  console.log(`Calculating RAW KM times for race ${raceId} with ${starts.length} horses`);
  
  // Fetch extended race data once for all horses (3rd tier fallback)
  let extendedRaceData: Awaited<ReturnType<typeof fetchExtendedRaceData>> = null;
  let extendedDataFetched = false;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition;
    progressCallback?.(i + 1, starts.length);

    try {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 0;

      // Data integrity: each iteration uses only this start's postPosition and horseId.
      // fetchHorseHistoricalData(raceId, postPosition) is cached by (raceId, postPosition);
      // downstream matching is by horseId (processHorseResults finds rawKmTimes by horseId).
      // No data leaks between horses as long as post positions are unique per race.

      console.log(`Processing horse ${i + 1}/${starts.length}: ${horseName} (ID: ${horseId})`);
      
      // Enhanced debugging for target horses
      HorseDebugger.log(horseId, horseName, 'FETCH_START', {
        raceId,
        postPosition,
        horseData: start.horse
      });
      
      console.log(`📡 [KmTimeProcessor] Fetching historical data for ${horseName}...`);
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);
      
      console.log(`📡 [KmTimeProcessor] Historical data fetch result for ${horseName}:`, {
        hasData: !!historicalData,
        hasHorse: !!historicalData?.horse,
        hasResults: !!historicalData?.horse?.results,
        hasRecords: !!historicalData?.horse?.results?.records,
        recordsCount: historicalData?.horse?.results?.records?.length || 0
      });
      
      // ❶ Try primary source (results.records)
      let records = historicalData?.horse?.results?.records;
      let invalidCandidates: Array<{ normalizedTime: { minutes: number; seconds: number; tenths: number }; dropReason?: string; source?: 'results' | 'stats' | 'extended' | 'extended-last' }> = [];
      let usingStatisticsFallback = false;
      let usingExtendedFallback = false;
      let perHorseWarning: { type: 'invalid-record'; message: string; reason: string } | undefined;
      let pendingConfidenceOverride: number | undefined;
      
      // ❷ If missing/empty, try statistics fallback
      if (!records || records.length === 0) {
        console.log(`📊 [KmTimeProcessor] No results.records found for ${horseName}, trying statistics fallback...`);
        const statsFallback = extractRecordsFromStatistics(historicalData?.horse);
        
        if (statsFallback.length > 0) {
          console.log(`✅ [KmTimeProcessor] Statistics fallback successful for ${horseName}: ${statsFallback.length} records found`);
          records = statsFallback as any;
          usingStatisticsFallback = true;
          
          HorseDebugger.log(horseId, horseName, 'STATISTICS_FALLBACK_USED', {
            statisticsRecordsFound: statsFallback.length,
            sampleRecord: statsFallback[0]
          });
        }
      }
      
      // ❸ If still nothing, try extended API fallback (last resort)
      if (!records || records.length === 0) {
        if (!extendedDataFetched) {
          console.log(`📡 [KmTimeProcessor] No data from primary/statistics sources, fetching extended race data...`);
          extendedRaceData = await fetchExtendedRaceData(raceId);
          extendedDataFetched = true;
        }
        
        // Guard against nullish extended payloads
        if (extendedRaceData?.starts?.length) {
          const extendedHorse = extendedRaceData.starts.find(s => s.horse.id === horseId)?.horse;
          if (extendedHorse) {
            console.log(`📡 [KmTimeProcessor] Trying extended API fallback for ${horseName}...`);
            const extendedRecords = extractRecordsFromExtended(extendedHorse, true);
            
            if (extendedRecords.length > 0) {
              console.log(`✅ [KmTimeProcessor] Extended fallback successful for ${horseName}: ${extendedRecords.length} records found`);
              records = extendedRecords as any;
              usingExtendedFallback = true;
              
              logExtendedFallbackUsage(horseId, horseName, extendedRecords);
            }
          }
        }
      }
      
      // ❺ If still nothing after ALL fallbacks, mark zero and continue
      if (!records || records.length === 0) {
        console.warn(`❌ [KmTimeProcessor] NO HISTORICAL DATA - Horse ${horseName} (Post ${postPosition})`);
        console.warn(`  📊 Data check: historicalData=${!!historicalData}, horse=${!!historicalData?.horse}, results=${!!historicalData?.horse?.results}, records=${!!historicalData?.horse?.results?.records}`);
        console.warn(`  📈 Records length: ${historicalData?.horse?.results?.records?.length || 0}`);
        console.warn(`  📊 Statistics fallback attempted: yes`);
        console.warn(`  📡 Extended fallback attempted: ${extendedDataFetched ? 'yes' : 'no'}`);
        console.warn(`  🚫 This horse will get zero time and be excluded from analysis`);
        
        HorseDebugger.log(horseId, horseName, 'NO_HISTORICAL_DATA', {
          historicalDataExists: !!historicalData,
          hasHorse: !!historicalData?.horse,
          hasResults: !!historicalData?.horse?.results,
          hasRecords: !!historicalData?.horse?.results?.records,
          recordsLength: historicalData?.horse?.results?.records?.length || 0,
          statisticsFallbackAttempted: true,
          extendedFallbackAttempted: extendedDataFetched,
          statisticsRecordsFound: 0
        });
        
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      const dataSourceLabel = usingExtendedFallback ? '(from extended API)' : usingStatisticsFallback ? '(from statistics)' : '';
      console.log(`✅ [KmTimeProcessor] Historical data found for ${horseName}: ${records.length} records ${dataSourceLabel}`);
      
      // Enhanced debugging for historical data
      HorseDebugger.logHistoricalData(horseId, horseName, records);
      
      // Validate historical records
      const rawRecords = records;
      const validationResults = rawRecords.map((record, index) => 
        DataValidator.validateHistoricalRecord(record, index)
      );
      DataValidator.logValidationResults(validationResults, `${horseName} Historical Records`);
      
      const processingResult = processHistoricalRecords(records, horseName);
      const validRecords = processingResult.records;
      
      // Collect invalid candidates from processing
      invalidCandidates.push(...processingResult.invalidCandidates);
      
      // ❹ INVALID-TIME fallback: Use fastest dropped-but-timed record
      if (validRecords.length === 0 && invalidCandidates.length > 0) {
        // Pick fastest invalid candidate
        invalidCandidates.sort((a, b) =>
          toSeconds(a.normalizedTime.minutes, a.normalizedTime.seconds, a.normalizedTime.tenths ?? 0)
          - toSeconds(b.normalizedTime.minutes, b.normalizedTime.seconds, b.normalizedTime.tenths ?? 0)
        );

        const bestInvalid = invalidCandidates[0];
        const invalidSec = toSeconds(
          bestInvalid.normalizedTime.minutes,
          bestInvalid.normalizedTime.seconds,
          bestInvalid.normalizedTime.tenths ?? 0
        );

        // Optional: Add conservative penalty (+0.5s) for questionable data
        const penalizedSec = invalidSec + 0.5;
        
        console.warn(`🔴 [INVALID-TIME FALLBACK] Using fastest invalid record for ${horseName}: `
          + `${bestInvalid.normalizedTime.minutes}:${bestInvalid.normalizedTime.seconds.toString().padStart(2,'0')}.`
          + `${bestInvalid.normalizedTime.tenths} +0.5s penalty (reason: ${bestInvalid.dropReason ?? 'unknown'})`);

        const best3Average = secondsToKmParts(penalizedSec);
        const bestRecordTime = { ...best3Average };

        // Mark provenance + confidence
        usingStatisticsFallback = true;
        const WARNING_CONFIDENCE = 0.4;
        const warningMessage = bestInvalid.dropReason
          ? `Used invalid record (${bestInvalid.dropReason}); prediction may be unreliable`
          : `Used invalid record; prediction may be unreliable`;

        perHorseWarning = {
          type: 'invalid-record',
          message: warningMessage,
          reason: bestInvalid.dropReason ?? 'invalid',
        };

        pendingConfidenceOverride = WARNING_CONFIDENCE;

        HorseDebugger.log(horseId, horseName, 'INVALID_TIME_FALLBACK_USED', {
          reason: bestInvalid.dropReason ?? 'invalid',
          time: best3Average,
          confidence: WARNING_CONFIDENCE,
        });

        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average,
          bestRecordTime,
          validTimesCount: 0,
          usedStatisticsFallback: true,
          usedExtendedFallback: bestInvalid.source === 'extended' || bestInvalid.source === 'extended-last',
          usedInvalidTimeFallback: true,
          warning: perHorseWarning,
          confidenceMultiplier: WARNING_CONFIDENCE
        });
        continue;
      }
      
      // ❺ EXTENDED single-record fallback: Use horse.record.time if available
      if (validRecords.length === 0 && !invalidCandidates.length) {
        if (!extendedDataFetched) {
          console.log(`📡 [KmTimeProcessor] No data anywhere, fetching extended race data for single record...`);
          extendedRaceData = await fetchExtendedRaceData(raceId);
          extendedDataFetched = true;
        }
        
        if (extendedRaceData?.starts?.length) {
          const extendedHorse = extendedRaceData.starts.find(s => s.horse.id === horseId)?.horse;
          const rt = extendedHorse?.record?.time;

          if (rt 
            && Number.isFinite(rt.minutes) 
            && Number.isFinite(rt.seconds) 
            && Number.isFinite(rt.tenths)
            && !isZeroTime(rt)) {  // Reject 0:00.0 as "no time"
            
            // Optional: Add conservative penalty (+0.5s) for questionable data
            const sec = toSeconds(rt.minutes, rt.seconds, rt.tenths ?? 0) + 0.5;
            const best3Average = secondsToKmParts(sec);
            const bestRecordTime = { ...best3Average };
            const CONF = 0.5;

            console.warn(`🔴 [EXTENDED SINGLE RECORD] Using horse.record.time for ${horseName}: `
              + `${best3Average.minutes}:${best3Average.seconds.toString().padStart(2,'0')}.${best3Average.tenths} (+0.5s penalty)`);

            rawKmTimes.push({
              horseId: start.horse.id,
              horseName: start.horse.name,
              allTimes: [],
              best3Average,
              bestRecordTime,
              validTimesCount: 0,
              usedStatisticsFallback: true,
              usedExtendedFallback: true,
              usedInvalidTimeFallback: false,
              warning: {
                type: 'invalid-record',
                message: 'Used single best record from extended; prediction may be unreliable',
                reason: 'extended-single',
              },
              confidenceMultiplier: CONF,
            });

            HorseDebugger.log(horseId, horseName, 'EXTENDED_SINGLE_RECORD_USED', {
              time: best3Average,
              confidence: CONF,
            });

            continue;
          }
        }
      }
      
      // Calculate combined confidence multiplier (most conservative, apply once)
      const sourceConfidenceMultiplier = getSourceConfidenceMultiplier(records as any);
      const extendedConfidenceMultiplier = getExtendedConfidenceMultiplier(records as any);
      const baseConfidence = Math.min(sourceConfidenceMultiplier, extendedConfidenceMultiplier || 1);
      
      const combinedConfidence = pendingConfidenceOverride !== undefined
        ? Math.min(baseConfidence, pendingConfidenceOverride)
        : baseConfidence;
      
      const metadata = {
        ...processingResult.metadata,
        usingStatisticsFallback: usingStatisticsFallback || usingExtendedFallback,
        dataSource: (usingStatisticsFallback || usingExtendedFallback) ? 'fallback' as const : processingResult.metadata.dataSource,
        confidenceMultiplier: combinedConfidence
      };
      
      console.log(`📊 [KmTimeProcessor] Historical records processing for ${horseName}:`);
      console.log(`   - Raw records from API: ${rawRecords.length}`);
      console.log(`   - Valid records after filtering: ${validRecords.length}`);
      console.log(`   - Filtered out: ${rawRecords.length - validRecords.length}`);
      console.log(`   - Data source: ${metadata.dataSource.toUpperCase()}`);
      if (usingStatisticsFallback) {
        console.log(`   📊 STATISTICS FALLBACK: Using statistics.records data (limited race details)`);
      }
      if (usingExtendedFallback) {
        console.log(`   📡 EXTENDED API FALLBACK: Using extended race endpoint data (confidence: ${extendedConfidenceMultiplier})`);
      }
      if (metadata.usedFallback) {
        console.log(`   🚨 TIME WINDOW FALLBACK: Using historical data (${metadata.oldestRecordDate} to ${metadata.newestRecordDate})`);
      }
      
      HorseDebugger.log(horseId, horseName, 'PROCESSED_HISTORICAL_RECORDS', {
        rawRecordsCount: rawRecords.length,
        validRecordsCount: validRecords.length,
        filteredOut: rawRecords.length - validRecords.length,
        sampleRecord: validRecords[0],
        dataSource: metadata.dataSource,
        usedFallback: metadata.usedFallback,
        dateRange: `${metadata.oldestRecordDate} to ${metadata.newestRecordDate}`
      });
      
      const historicalRaces = validRecords.map(record => ({
        raceId: record.race.id,
        date: record.date,
        distance: record.start.distance,
        startMethod: record.race.startMethod,
        track: record.track.name,
        kmTime: record.kmTime as { minutes: number; seconds: number; tenths: number },
        finishOrder: parseInt(record.place!),
        postPosition: record.start.postPosition,
        galloped: record.galloped || false,
        disqualified: record.disqualified || false
      }));
      
      console.log(`⚙️ [KmTimeProcessor] Sending ${historicalRaces.length} historical races to processHorseKmTimes for ${horseName}`);
      
      const horseRawKmTime = await processHorseKmTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces,
        metadata
      );
      
      console.log(`⚙️ [KmTimeProcessor] processHorseKmTimes result for ${horseName}:`, {
        validTimesCount: horseRawKmTime.validTimesCount,
        best3Average: horseRawKmTime.best3Average,
        allTimesLength: horseRawKmTime.allTimes.length
      });
      
      rawKmTimes.push(horseRawKmTime);
      
      const calculatedTimeStr = `${horseRawKmTime.best3Average.minutes}:${horseRawKmTime.best3Average.seconds.toString().padStart(2, '0')}.${horseRawKmTime.best3Average.tenths}`;
      console.log(`✅ [KmTimeProcessor] RAW KM time calculated for ${horseName}: ${calculatedTimeStr} (from ${horseRawKmTime.validTimesCount} valid times)`);
      
    } catch (error) {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 0;
      
      console.error(`❌ PROCESSING ERROR - Horse ${horseName} (Post ${postPosition}):`, error);
      console.error(`  🔍 Error type: ${error.name}`);
      console.error(`  📝 Error message: ${error.message}`);
      
      rawKmTimes.push({
        horseId: start.horse.id,
        horseName: start.horse.name,
        allTimes: [],
        best3Average: { minutes: 0, seconds: 0, tenths: 0 },
        bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW KM time (best first) with tie-breakers
  rawKmTimes.sort((a, b) => {
    const aSeconds = toSeconds(a.best3Average.minutes, a.best3Average.seconds, a.best3Average.tenths ?? 0);
    const bSeconds = toSeconds(b.best3Average.minutes, b.best3Average.seconds, b.best3Average.tenths ?? 0);
    
    if (aSeconds === 0 && bSeconds === 0) return 0;
    if (aSeconds === 0) return 1;
    if (bSeconds === 0) return -1;
    
    // Primary sort: by time (with small epsilon for float comparison)
    if (Math.abs(aSeconds - bSeconds) > 0.01) {
      return aSeconds - bSeconds;
    }
    
    // Tie-breaker #1: prefer results over statistics fallback
    const aUsesStats = a.usedStatisticsFallback ?? false;
    const bUsesStats = b.usedStatisticsFallback ?? false;
    if (aUsesStats !== bUsesStats) {
      return aUsesStats ? 1 : -1; // Results come first
    }
    
    // Tie-breaker #2: prefer newer data (when both use results)
    if (!aUsesStats && !bUsesStats && a.newestRecordDate && b.newestRecordDate) {
      const aDate = new Date(a.newestRecordDate).getTime();
      const bDate = new Date(b.newestRecordDate).getTime();
      if (aDate !== bDate) {
        return bDate - aDate; // Newer first
      }
    }
    
    return 0;
  });

  // Telemetry: Log fallback usage summary with extended breakdown
  const totalHorses = rawKmTimes.length;
  const horsesUsingFallback = rawKmTimes.filter(h => h.usedStatisticsFallback).length;
  const horsesWithLowConfidence = rawKmTimes.filter(h => h.confidenceMultiplier && h.confidenceMultiplier < 0.7).length;
  const horsesViaExtended = rawKmTimes.filter(h => h.confidenceMultiplier && h.confidenceMultiplier < 1.0 && h.confidenceMultiplier >= 0.7).length;
  const horsesLastResort = rawKmTimes.filter(h => h.confidenceMultiplier && h.confidenceMultiplier <= 0.5 && !h.usedInvalidTimeFallback).length;
  const horsesWarn = rawKmTimes.filter(h => h.usedInvalidTimeFallback).length;
  
  if (horsesUsingFallback > 0) {
    console.log(`📊 [RACE FALLBACK SUMMARY] ${horsesUsingFallback}/${totalHorses} horses used fallback data`);
    if (horsesViaExtended > 0) {
      console.log(`   📡 ${horsesViaExtended} via extended API statistics (confidence: 0.7)`);
    }
    if (horsesLastResort > 0) {
      console.log(`   🔴 ${horsesLastResort} last-resort records (confidence: 0.5)`);
    }
    if (horsesWarn > 0) {
      console.log(`   🟥 ${horsesWarn} used invalid-time fallback (confidence: 0.4)`);
    }
    if (horsesWithLowConfidence > 0) {
      console.log(`⚠️ [CONFIDENCE WARNING] ${horsesWithLowConfidence} horses have confidence < 0.7`);
    }
    
    // Emit race-level telemetry for monitoring data drift
    console.log(`[FALLBACK_RATE] ${horsesUsingFallback}/${totalHorses} used fallback (${Math.round(horsesUsingFallback/totalHorses*100)}%)`);
  }
  
  // Invariant: Assert no horse has times but shows 0:00.0
  for (const h of rawKmTimes) {
    const hasAny = h.validTimesCount > 0;
    const isZero = (h.best3Average.minutes | h.best3Average.seconds | h.best3Average.tenths) === 0;
    
    if (hasAny && !isZero) {
      // Expected: has times and has non-zero average ✓
    } else if (!hasAny && isZero) {
      // Expected: no times and zero average ✓
    } else if (hasAny && isZero) {
      // ERROR: Has valid times but average is 0 - this should never happen!
      console.error(`❌ [ASSERTION FAILED] ${h.horseName} has ${h.validTimesCount} valid times but best3Average is 0:00.0`);
      console.error(`   This indicates a bug in the averaging logic or confidence penalty calculation`);
      console.error(`   Raw average: ${h.rawBest3Average ? `${h.rawBest3Average.minutes}:${h.rawBest3Average.seconds}.${h.rawBest3Average.tenths}` : 'undefined'}`);
      console.error(`   Confidence: ${h.confidenceMultiplier ?? 'undefined'}`);
      console.error(`   Data source: ${h.dataSource ?? 'undefined'}`);
    }
  }

  console.log(`Final RAW KM Time Rankings:`);
  rawKmTimes.forEach((horse, index) => {
    const kmTime = horse.best3Average;
    
    // Use provenance flags directly for accurate tagging
    const isWarn = horse.usedInvalidTimeFallback === true;
    const isLastResort = horse.confidenceMultiplier && horse.confidenceMultiplier <= 0.5 && !isWarn;
    const isExtendedSource = horse.confidenceMultiplier && horse.confidenceMultiplier < 1.0 && horse.confidenceMultiplier > 0.5;
    const dataSourceTag = isWarn ? ' [WARN]' :
      (horse.usedStatisticsFallback 
        ? (isLastResort ? ' [EXT-LAST]' : isExtendedSource ? ' [EXT]' : ' [STATS]')
        : '');
    const confidenceTag = horse.confidenceMultiplier && horse.confidenceMultiplier < 1.0 
      ? ` (confidence: ${(horse.confidenceMultiplier * 100).toFixed(0)}%)` 
      : '';
    
    if (kmTime.minutes > 0 || kmTime.seconds > 0 || kmTime.tenths > 0) {
      console.log(`${index + 1}. ${horse.horseName}: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths} (${horse.validTimesCount} races)${dataSourceTag}${confidenceTag}`);
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawKmTimes;
};