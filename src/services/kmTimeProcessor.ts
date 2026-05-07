import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime, ProcessedKmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords, ATGHistoricalRecord } from './atgHistoricalApi';
import { DataValidator } from './debugging/dataValidator';
import { collectHorseRecordCandidates, distanceCategoryToMeters, getSourceConfidenceMultiplier } from './utils/recordsFallback';
import { toSeconds, secondsToKmParts } from './utils/robustTimeConversion';
import { fetchExtendedRaceData, extractRecordsFromExtended, isExtendedFallback, logExtendedFallbackUsage, getExtendedConfidenceMultiplier } from './utils/extendedFallbackHandler';
import { hasNumericKmTime, isZeroTime } from './utils/kmTimeUtils';
import { makeHorseKey } from './horseIdentity';
import { log } from '@/lib/logger';

export const calculateRawKmTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void,
  /** ISO date of the race — passed to processHistoricalRecords to prevent data leakage
   *  in calibration (only records strictly before this date are used). */
  raceDateCutoff?: string
): Promise<HorseRawKmTime[]> => {
  const rawKmTimes: HorseRawKmTime[] = [];

  log.debug(`Calculating RAW KM times for race ${raceId} with ${starts.length} horses`);

  // Fetch extended race data once for all horses (3rd tier fallback)
  let extendedRaceData: Awaited<ReturnType<typeof fetchExtendedRaceData>> = null;
  let extendedDataFetched = false;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition;
    progressCallback?.(i + 1, starts.length);

    try {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id ?? 0;
      const horseKey = start.horseKey ?? makeHorseKey(raceId, horseId, postPosition);

      // Data integrity: each iteration uses only this start's postPosition and identity key.
      // fetchHorseHistoricalData(raceId, postPosition) is cached by (raceId, postPosition);
      // downstream matching is by horseKey so null-id foreign horses do not collide.
      // No data leaks between horses as long as post positions are unique per race.

      log.debug(`Processing horse ${i + 1}/${starts.length}: ${horseName} (ID: ${horseId})`);

      log.debug(`[KmTimeProcessor] Fetching historical data for ${horseName}...`);
      const historicalData = await fetchHorseHistoricalData(raceId, postPosition);

      log.debug(`[KmTimeProcessor] Historical data fetch result for ${horseName}:`, {
        hasData: !!historicalData,
        hasHorse: !!historicalData?.horse,
        hasResults: !!historicalData?.horse?.results,
        hasRecords: !!historicalData?.horse?.results?.records,
        recordsCount: historicalData?.horse?.results?.records?.length || 0
      });

      // ❶ Collect all normal per-horse time candidates from the start payload.
      // results.records are real starts; statistics records are aggregate lower-
      // confidence supplements; horse.record.time is only used when both are absent.
      const collected = collectHorseRecordCandidates(historicalData?.horse);
      let records = collected.records;
      let invalidCandidates: Array<{ normalizedTime: { minutes: number; seconds: number; tenths: number }; dropReason?: string; source?: string }> = [];
      let usingStatisticsFallback = collected.counts.statistics > 0 || collected.counts.bestRecord > 0;
      let usingExtendedFallback = false;
      let perHorseWarning: { type: 'invalid-record'; message: string; reason: string } | undefined;
      let pendingConfidenceOverride: number | undefined;

      if (collected.counts.total > 0) {
        log.debug(`[KmTimeProcessor] Candidate records for ${horseName}: results=${collected.counts.results}, stats=${collected.counts.statistics}, bestRecord=${collected.counts.bestRecord}`);
      }

      // ❷ If still nothing, try extended API fallback (last resort)
      if (!records || records.length === 0) {
        if (!extendedDataFetched) {
          log.debug(`[KmTimeProcessor] No data from primary/statistics sources, fetching extended race data...`);
          extendedRaceData = await fetchExtendedRaceData(raceId);
          extendedDataFetched = true;
        }

        // Guard against nullish extended payloads
        if (extendedRaceData?.starts?.length) {
          const extendedHorse = extendedRaceData.starts.find(s =>
            (horseId > 0 && s.horse.id === horseId) ||
            s.number === postPosition ||
            s.postPosition === postPosition
          )?.horse;
          if (extendedHorse) {
            log.debug(`[KmTimeProcessor] Trying extended API fallback for ${horseName}...`);
            const extendedRecords = extractRecordsFromExtended(extendedHorse, true);

            if (extendedRecords.length > 0) {
              log.debug(`[KmTimeProcessor] Extended fallback successful for ${horseName}: ${extendedRecords.length} records found`);
              records = extendedRecords as any;
              usingExtendedFallback = true;

              logExtendedFallbackUsage(horseId, horseName, extendedRecords);
            }
          }
        }
      }

      // ❺ If still nothing after ALL fallbacks, mark zero and continue
      if (!records || records.length === 0) {
        log.debug(`[KmTimeProcessor] NO HISTORICAL DATA - Horse ${horseName} (Post ${postPosition})`);
        log.debug(`[KmTimeProcessor] Data check: historicalData=${!!historicalData}, horse=${!!historicalData?.horse}, results=${!!historicalData?.horse?.results}, records=${!!historicalData?.horse?.results?.records}`);
        log.debug(`[KmTimeProcessor] Records length: ${historicalData?.horse?.results?.records?.length || 0}`);
        log.debug(`[KmTimeProcessor] Statistics fallback attempted: yes`);
        log.debug(`[KmTimeProcessor] Extended fallback attempted: ${extendedDataFetched ? 'yes' : 'no'}`);
        log.debug(`[KmTimeProcessor] This horse will get zero time and be excluded from analysis`);

        rawKmTimes.push({
          horseKey,
          horseId,
          horseName: start.horse.name,
          allTimes: [],
          bestTime: { minutes: 0, seconds: 0, tenths: 0 },
          bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }

      const dataSourceLabel = usingExtendedFallback ? '(from extended API)' : usingStatisticsFallback ? '(from statistics)' : '';
      log.debug(`[KmTimeProcessor] Historical data found for ${horseName}: ${records.length} records ${dataSourceLabel}`);

      // Validate historical records
      const rawRecords = records;
      const validationResults = rawRecords.map((record, index) =>
        DataValidator.validateHistoricalRecord(record, index)
      );
      DataValidator.logValidationResults(validationResults, `${horseName} Historical Records`);

      const processingResult = processHistoricalRecords(records, horseName, raceDateCutoff);
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

        log.warn(`[INVALID-TIME FALLBACK] Using fastest invalid record for ${horseName}: `
          + `${bestInvalid.normalizedTime.minutes}:${bestInvalid.normalizedTime.seconds.toString().padStart(2, '0')}.`
          + `${bestInvalid.normalizedTime.tenths} +0.5s penalty (reason: ${bestInvalid.dropReason ?? 'unknown'})`);

        const bestTime = secondsToKmParts(penalizedSec);
        const bestRecordTime = { ...bestTime };

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

        rawKmTimes.push({
          horseKey,
          horseId,
          horseName: start.horse.name,
          allTimes: [],
          bestTime,
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
          log.debug(`[KmTimeProcessor] No data anywhere, fetching extended race data for single record...`);
          extendedRaceData = await fetchExtendedRaceData(raceId);
          extendedDataFetched = true;
        }

        if (extendedRaceData?.starts?.length) {
          const extendedHorse = extendedRaceData.starts.find(s =>
            (horseId > 0 && s.horse.id === horseId) ||
            s.number === postPosition ||
            s.postPosition === postPosition
          )?.horse;
          const rt = extendedHorse?.record?.time;

          if (rt
            && Number.isFinite(rt.minutes)
            && Number.isFinite(rt.seconds)
            && Number.isFinite(rt.tenths)
            && !isZeroTime(rt)) {  // Reject 0:00.0 as "no time"

            // Optional: Add conservative penalty (+0.5s) for questionable data
            const sec = toSeconds(rt.minutes, rt.seconds, rt.tenths ?? 0) + 0.5;
            const bestTime = secondsToKmParts(sec);
            const bestRecordTime = { ...bestTime };
            const CONF = 0.5;

            log.warn(`[EXTENDED SINGLE RECORD] Using horse.record.time for ${horseName}: `
              + `${bestTime.minutes}:${bestTime.seconds.toString().padStart(2, '0')}.${bestTime.tenths} (+0.5s penalty)`);

            rawKmTimes.push({
              horseKey,
              horseId,
              horseName: start.horse.name,
              allTimes: [],
              bestTime,
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

      log.debug(`[KmTimeProcessor] Historical records processing for ${horseName}:`);
      log.debug(`   - Raw records from API: ${rawRecords.length}`);
      log.debug(`   - Valid records after filtering: ${validRecords.length}`);
      log.debug(`   - Filtered out: ${rawRecords.length - validRecords.length}`);
      log.debug(`   - Data source: ${metadata.dataSource.toUpperCase()}`);
      if (usingStatisticsFallback) {
        log.debug(`   STATISTICS FALLBACK: Using statistics.records data (limited race details)`);
      }
      if (usingExtendedFallback) {
        log.debug(`   EXTENDED API FALLBACK: Using extended race endpoint data (confidence: ${extendedConfidenceMultiplier})`);
      }
      if (metadata.usedFallback) {
        log.debug(`   TIME WINDOW FALLBACK: Using historical data (${metadata.oldestRecordDate} to ${metadata.newestRecordDate})`);
      }

      const historicalRaces = validRecords.map(record => ({
        raceId: record.race.id,
        date: record.date,
        distance: record.start?.distance ?? distanceCategoryToMeters((record as any).meta?.distance) ?? 2140,
        startMethod: record.race?.startMethod ?? (record as any).meta?.startMethod ?? 'auto',
        track: record.track?.name ?? 'Unknown',
        kmTime: record.kmTime as { minutes: number; seconds: number; tenths: number },
        finishOrder: parseInt(record.place ?? '0', 10) || 0,
        postPosition: record.start?.postPosition ?? 1,
        galloped: record.galloped || false,
        disqualified: record.disqualified || false,
        meta: (record as any).meta,
      }));

      log.debug(`[KmTimeProcessor] Sending ${historicalRaces.length} historical races to processHorseKmTimes for ${horseName}`);

      const horseRawKmTime = await processHorseKmTimes(
        horseId,
        start.horse.name,
        historicalRaces,
        metadata
      );
      horseRawKmTime.horseKey = horseKey;

      // processHorseKmTimes receives validRecords with galloped races removed.
      // Recompute gallop and last-race fields from the raw records so recent
      // gallops still count for reliability and layoff calculations.
      {
        const upperBound = raceDateCutoff ? new Date(raceDateCutoff).getTime() : Infinity;
        const sortedAllRecords = [...(records as ATGHistoricalRecord[])]
          .filter(r => r.date && new Date(r.date).getTime() < upperBound)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recentTenRaw = sortedAllRecords.slice(0, 10);
        const gallopedRaw = recentTenRaw.filter(r => r.galloped === true);
        horseRawKmTime.gallopCount = gallopedRaw.length;
        horseRawKmTime.gallopDates = gallopedRaw.map(r => r.date).filter(Boolean) as string[];
        horseRawKmTime.gallopRate = recentTenRaw.length > 0 ? horseRawKmTime.gallopCount / recentTenRaw.length : 0;
        if (sortedAllRecords[0]?.date) horseRawKmTime.lastRaceDate = sortedAllRecords[0].date;
      }

      // Build data source chain for transparency (Part 4)
      const chainParts: string[] = [];
      const primaryCount = historicalData?.horse?.results?.records?.length ?? 0;
      chainParts.push(`records(${primaryCount})`);
      if (usingStatisticsFallback && !usingExtendedFallback) chainParts.push('stats→used');
      else if (usingExtendedFallback) chainParts.push('extended→used');
      else if (primaryCount > 0) chainParts.push('→used');
      horseRawKmTime.dataSourceChain = chainParts.join('→');

      log.debug(`[KmTimeProcessor] processHorseKmTimes result for ${horseName}:`, {
        validTimesCount: horseRawKmTime.validTimesCount,
        bestTime: horseRawKmTime.bestTime,
        allTimesLength: horseRawKmTime.allTimes.length
      });

      rawKmTimes.push(horseRawKmTime);

      const calculatedTimeStr = `${horseRawKmTime.bestTime.minutes}:${horseRawKmTime.bestTime.seconds.toString().padStart(2, '0')}.${horseRawKmTime.bestTime.tenths}`;
      log.debug(`[KmTimeProcessor] RAW KM time calculated for ${horseName}: ${calculatedTimeStr} (from ${horseRawKmTime.validTimesCount} valid times)`);

    } catch (error) {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id ?? 0;
      const horseKey = start.horseKey ?? makeHorseKey(raceId, horseId, postPosition);

      log.warn(`[KmTimeProcessor] PROCESSING ERROR - Horse ${horseName} (Post ${postPosition}):`, error);
      log.debug(`[KmTimeProcessor] Error type: ${error.name}`);
      log.debug(`[KmTimeProcessor] Error message: ${error.message}`);

      rawKmTimes.push({
        horseKey,
        horseId,
        horseName: start.horse.name,
        allTimes: [],
        bestTime: { minutes: 0, seconds: 0, tenths: 0 },
        bestRecordTime: { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW KM time (best first) with tie-breakers
  rawKmTimes.sort((a, b) => {
    const aSeconds = toSeconds(a.bestTime.minutes, a.bestTime.seconds, a.bestTime.tenths ?? 0);
    const bSeconds = toSeconds(b.bestTime.minutes, b.bestTime.seconds, b.bestTime.tenths ?? 0);

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
    log.debug(`[RACE FALLBACK SUMMARY] ${horsesUsingFallback}/${totalHorses} horses used fallback data`);
    if (horsesViaExtended > 0) {
      log.debug(`   ${horsesViaExtended} via extended API statistics (confidence: 0.7)`);
    }
    if (horsesLastResort > 0) {
      log.debug(`   ${horsesLastResort} last-resort records (confidence: 0.5)`);
    }
    if (horsesWarn > 0) {
      log.debug(`   ${horsesWarn} used invalid-time fallback (confidence: 0.4)`);
    }
    if (horsesWithLowConfidence > 0) {
      log.debug(`[CONFIDENCE WARNING] ${horsesWithLowConfidence} horses have confidence < 0.7`);
    }

    // Emit race-level telemetry for monitoring data drift
    log.debug(`[FALLBACK_RATE] ${horsesUsingFallback}/${totalHorses} used fallback (${Math.round(horsesUsingFallback / totalHorses * 100)}%)`);
  }

  // Invariant: Assert no horse has times but shows 0:00.0
  for (const h of rawKmTimes) {
    const hasAny = h.validTimesCount > 0;
    const isZero = (h.bestTime.minutes | h.bestTime.seconds | h.bestTime.tenths) === 0;

    if (hasAny && !isZero) {
      // Expected: has times and has non-zero average ✓
    } else if (!hasAny && isZero) {
      // Expected: no times and zero average ✓
    } else if (hasAny && isZero) {
      // ERROR: Has valid times but average is 0 - this should never happen!
      log.warn(`[ASSERTION FAILED] ${h.horseName} has ${h.validTimesCount} valid times but best3Average is 0:00.0`);
      log.warn(`   This indicates a bug in the averaging logic or confidence penalty calculation`);
      log.warn(`   Raw average: ${h.rawBestTime ? `${h.rawBestTime.minutes}:${h.rawBestTime.seconds}.${h.rawBestTime.tenths}` : 'undefined'}`);
      log.warn(`   Confidence: ${h.confidenceMultiplier ?? 'undefined'}`);
      log.warn(`   Data source: ${h.dataSource ?? 'undefined'}`);
    }
  }

  log.debug(`Final RAW KM Time Rankings:`);
  rawKmTimes.forEach((horse, index) => {
    const kmTime = horse.bestTime;

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
      log.debug(`${index + 1}. ${horse.horseName}: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths} (${horse.validTimesCount} races)${dataSourceTag}${confidenceTag}`);
    } else {
      log.debug(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  return rawKmTimes;
};
