
import { ATGStartInfo } from './atgApi';
import { HorseRawKmTime, KmTime } from './types/kmTimeTypes';
import { processHorseKmTimes } from './horseProcessing';
import { fetchHorseHistoricalData, processHistoricalRecords } from './atgHistoricalApi';
import { Race7Debugger } from './investigation/race7DebugUtils';
import { EnhancedXanderDebugger } from './investigation/enhancedXanderDebugger';
import { ConnectionResilience } from './investigation/connectionResilience';

export const calculateRawKmTimesForRaceWithId = async (
  raceId: string,
  starts: ATGStartInfo[],
  progressCallback?: (current: number, total: number) => void
): Promise<HorseRawKmTime[]> => {
  const rawKmTimes: HorseRawKmTime[] = [];

  console.log(`\n=== Calculating RAW KM times for race ${raceId} with ${starts.length} horses ===`);
  console.log('🔥 STRICT MODE: Using POST POSITIONS for historical data fetch ONLY for RAW KM time calculation');
  console.log('🔍 INVESTIGATION MODE: Enhanced debugging for time discrepancy analysis');
  
  // 🔍 XANDER DETECTION: Enhanced multi-pattern detection with data structure validation
  console.log(`\n🎯 XANDER DETECTION: Scanning ${starts.length} horses...`);
  starts.forEach((start, idx) => {
    console.log(`   Horse ${idx + 1}: ${start.horse?.name || 'NO_NAME'} (ID: ${start.horse?.id || 'NO_ID'})`);
  });
  
  const xanderDetectionPatterns = [
    (start: any) => start.horse?.name?.toLowerCase().includes('xander'),
    (start: any) => start.horse?.name?.toLowerCase() === 'xander',
    (start: any) => start.horse?.id === 786472, // From console logs
    (start: any) => start.horseName?.toLowerCase().includes('xander'), // Fallback structure
    (start: any) => start.horseId === 786472 // Alternative structure
  ];
  
  const detectedXander = starts.find(start => 
    xanderDetectionPatterns.some(pattern => pattern(start))
  );
  
  if (detectedXander) {
    console.log(`🎯 XANDER DETECTED using enhanced patterns:`, {
      horseName: detectedXander.horse?.name,
      horseId: detectedXander.horse?.id,
      postPosition: detectedXander.postPosition,
      dataStructure: {
        hasHorseObject: !!detectedXander.horse,
        horseKeys: detectedXander.horse ? Object.keys(detectedXander.horse) : [],
        directProperties: Object.keys(detectedXander).filter(k => k !== 'horse')
      }
    });
  } else {
    console.log(`⚠️  XANDER NOT DETECTED - Detailed analysis:`);
    starts.forEach((start, idx) => {
      console.log(`   ${idx + 1}. Name: "${start.horse?.name || 'N/A'}" | ID: ${start.horse?.id || 'N/A'}"`);
    });
  }
  
  // 🔍 INVESTIGATION: Auto-enable Race 7 debugging if this is Race 7
  if (raceId.includes('7') || raceId.toLowerCase().includes('race_7') || starts.some(s => s.horse.name.toLowerCase().includes('xander'))) {
    Race7Debugger.enableRace7Debugging(raceId, {
      enableDetailedLogging: true,
      compareWithWebsiteTimes: true,
      trackDataSources: true,
      validateNormalizationSteps: true
    });
  }

  // 🔍 ENHANCED XANDER INVESTIGATION: Enable enhanced debugging for Xander
  const xanderHorse = detectedXander || starts.find(s => s.horse?.name?.toLowerCase().includes('xander'));
  if (xanderHorse) {
    const horseName = xanderHorse.horse?.name || 'Xander';
    console.log(`🕵️ ENHANCED DEBUGGING: Xander detected in race ${raceId}, enabling enhanced investigation`);
    console.log(`🔧 Debug state before enabling:`, {
      isCurrentlyEnabled: EnhancedXanderDebugger.isDebugEnabled(),
      targetHorse: EnhancedXanderDebugger.isTargetHorse(horseName)
    });
    
    EnhancedXanderDebugger.enableXanderDebugging(horseName, `kmtime_race_${raceId}_${Date.now()}`);
    
    console.log(`🔧 Debug state after enabling:`, {
      isCurrentlyEnabled: EnhancedXanderDebugger.isDebugEnabled(),
      targetHorse: EnhancedXanderDebugger.isTargetHorse(horseName)
    });
    
    EnhancedXanderDebugger.addCheckpoint(
      'race_analysis_start',
      'initialization',
      horseName,
      {
        raceId,
        totalHorses: starts.length,
        xanderPostPosition: xanderHorse.postPosition,
        detectionMethod: 'enhanced_patterns',
        dataStructure: {
          hasHorseObject: !!xanderHorse.horse,
          horseName: horseName,
          horseId: xanderHorse.horse?.id
        },
        timestamp: new Date().toISOString()
      },
      true
    );
  } else {
    console.log(`⚠️  No Xander detected - Enhanced debugging will not be enabled for this race`);
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const postPosition = start.postPosition;
    progressCallback?.(i + 1, starts.length);

    try {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 'Unknown';
      
      console.log(`\n--- Processing horse ${i + 1}/${starts.length}: ${horseName} (ID: ${horseId}) ---`);
      console.log(`🎯 Using POST POSITION: ${postPosition} for historical data fetch`);
      
      // 🔍 ENHANCED XANDER DETECTION: Multiple pattern matching
      const isXanderHorse = xanderDetectionPatterns.some(pattern => pattern(start));
      
      if (isXanderHorse) {
        console.log(`🎯 PROCESSING XANDER: Enhanced debugging active`);
        console.log(`🔧 Debug verification:`, {
          debugEnabled: EnhancedXanderDebugger.isDebugEnabled(),
          isTargetHorse: EnhancedXanderDebugger.isTargetHorse(horseName),
          horseName: horseName
        });
        
        EnhancedXanderDebugger.addCheckpoint(
          'start_data_fetch',
          'data_fetching',
          horseName,
          {
            horseId: horseId,
            postPosition,
            raceId,
            processingIndex: i + 1,
            totalHorses: starts.length,
            dataStructure: {
              originalStart: start,
              extractedName: horseName,
              extractedId: horseId
            }
          },
          true
        );
      }
      
      const historicalDataResult = await ConnectionResilience.executeWithRetry(
        () => fetchHorseHistoricalData(raceId, postPosition),
        {
          horseName: start.horse.name,
          operationName: 'fetch_historical_data',
          url: `ATG API - Race ${raceId}, Position ${postPosition}`
        },
        {
          maxRetries: 2,
          timeout: 20000
        }
      );
      
      if (!historicalDataResult.success) {
        console.error(`❌ Failed to fetch historical data for ${start.horse.name}: ${historicalDataResult.error}`);
        
        if (isXanderHorse) {
          EnhancedXanderDebugger.addCheckpoint(
            'data_fetch_failed',
            'data_fetching',
            horseName,
            {
              error: historicalDataResult.error,
              attempts: historicalDataResult.attempts,
              totalTime: historicalDataResult.totalTime,
              postPosition: postPosition,
              debugState: {
                enabled: EnhancedXanderDebugger.isDebugEnabled(),
                isTarget: EnhancedXanderDebugger.isTargetHorse(horseName)
              }
            },
            false,
            historicalDataResult.error
          );
        }
        
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      const historicalData = historicalDataResult.data!;
      
      if (!historicalData.horse.results?.records) {
        console.warn(`No historical records found for horse ${start.horse.name}`);
        rawKmTimes.push({
          horseId: start.horse.id,
          horseName: start.horse.name,
          allTimes: [],
          best3Average: { minutes: 0, seconds: 0, tenths: 0 },
          validTimesCount: 0
        });
        continue;
      }
      
      const validRecords = processHistoricalRecords(historicalData.horse.results.records, horseName);
      console.log(`Found ${validRecords.length} valid historical races for ${horseName}`);
      
      // 🔍 ENHANCED INVESTIGATION: Debug raw historical records
      if (isXanderHorse) {
        EnhancedXanderDebugger.addCheckpoint(
          'data_fetch_success',
          'data_fetching',
          horseName,
          {
            rawRecordsCount: historicalData.horse.results.records.length,
            fetchTime: historicalDataResult.totalTime,
            attempts: historicalDataResult.attempts,
            debugState: {
              enabled: EnhancedXanderDebugger.isDebugEnabled(),
              isTarget: EnhancedXanderDebugger.isTargetHorse(horseName)
            }
          },
          true
        );
        
        EnhancedXanderDebugger.logDataQualityCheck(
          horseName,
          'historical_data_availability',
          validRecords.length > 0,
          {
            rawRecordsCount: historicalData.horse.results.records.length,
            validRecordsAfterFiltering: validRecords.length,
            filteringRate: ((historicalData.horse.results.records.length - validRecords.length) / historicalData.horse.results.records.length * 100).toFixed(1) + '%'
          }
        );
        
        console.log(`🕵️ ENHANCED XANDER INVESTIGATION: Raw historical records count: ${historicalData.horse.results.records.length}`);
        console.log(`🕵️ ENHANCED XANDER INVESTIGATION: Valid records after filtering: ${validRecords.length}`);
        
        validRecords.forEach((record, idx) => {
          const timeStr = record.kmTime && typeof record.kmTime === 'object' && 'minutes' in record.kmTime 
            ? `${record.kmTime.minutes}:${record.kmTime.seconds}.${record.kmTime.tenths}`
            : 'No time';
          console.log(`🕵️ Record ${idx + 1}: ${record.date} - ${timeStr} (${record.start.distance}m, ${record.race.startMethod}, place: ${record.place})`);
          
          EnhancedXanderDebugger.logProcessingPhase(
            horseName,
            `historical_record_${idx + 1}`,
            {
              date: record.date,
              time: timeStr,
              distance: record.start.distance,
              startMethod: record.race.startMethod,
              place: record.place,
              galloped: record.galloped,
              disqualified: record.disqualified
            }
          );
        });
      }
      
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
      
      const horseRawKmTime = await processHorseKmTimes(
        start.horse.id,
        start.horse.name,
        historicalRaces
      );
      
      rawKmTimes.push(horseRawKmTime);
      
      const calculatedTimeStr = `${horseRawKmTime.best3Average.minutes}:${horseRawKmTime.best3Average.seconds.toString().padStart(2, '0')}.${horseRawKmTime.best3Average.tenths}`;
      console.log(`✅ RAW KM time calculated for ${horseName}: ${calculatedTimeStr}`);
      console.log(`🗑️  HISTORICAL DATA DISCARDED - NEVER TO BE USED AGAIN`);
      
      // 🔍 ENHANCED XANDER INVESTIGATION: Log final calculation
      if (isXanderHorse) {
        console.log(`🎯 XANDER FINAL CALCULATION:`, {
          calculatedTime: calculatedTimeStr,
          validTimesCount: horseRawKmTime.validTimesCount,
          debugState: {
            enabled: EnhancedXanderDebugger.isDebugEnabled(),
            isTarget: EnhancedXanderDebugger.isTargetHorse(horseName)
          }
        });
        
        EnhancedXanderDebugger.addCheckpoint(
          'final_time_calculated',
          'time_calculation',
          horseName,
          {
            finalTime: calculatedTimeStr,
            validTimesUsed: horseRawKmTime.validTimesCount,
            allTimesProcessed: horseRawKmTime.allTimes?.length || 0,
            processingIndex: i + 1
          },
          true
        );
      }
      
      // 🔍 INVESTIGATION: Log data source comparison for Race 7 debugging
      Race7Debugger.logDataSourceComparison(
        horseName,
        historicalData.horse.results.records.length,
        horseRawKmTime.validTimesCount,
        calculatedTimeStr
      );
      
    } catch (error) {
      const horseName = start.horse?.name || 'Unknown';
      const horseId = start.horse?.id || 'Unknown';
      
      console.error(`❌ Error processing KM times for horse ${horseName} (post position ${postPosition}):`, error);
      
      // 🔍 ENHANCED XANDER ERROR HANDLING
      const isXanderHorse = xanderDetectionPatterns.some(pattern => pattern(start));
      if (isXanderHorse) {
        console.log(`🎯 XANDER ERROR HANDLING:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          debugState: {
            enabled: EnhancedXanderDebugger.isDebugEnabled(),
            isTarget: EnhancedXanderDebugger.isTargetHorse(horseName)
          }
        });
        
        EnhancedXanderDebugger.addCheckpoint(
          'processing_error',
          'error_handling',
          horseName,
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            phase: 'km_time_processing',
            processingIndex: i + 1
          },
          false,
          error instanceof Error ? error.message : String(error)
        );
      }
      
      rawKmTimes.push({
        horseId: start.horse.id,
        horseName: start.horse.name,
        allTimes: [],
        best3Average: { minutes: 0, seconds: 0, tenths: 0 },
        validTimesCount: 0
      });
    }
  }

  // Sort by RAW KM time (best first)
  rawKmTimes.sort((a, b) => {
    const aSeconds = a.best3Average.minutes * 60 + a.best3Average.seconds + a.best3Average.tenths / 10;
    const bSeconds = b.best3Average.minutes * 60 + b.best3Average.seconds + b.best3Average.tenths / 10;
    
    if (aSeconds === 0 && bSeconds === 0) return 0;
    if (aSeconds === 0) return 1;
    if (bSeconds === 0) return -1;
    return aSeconds - bSeconds;
  });

  console.log(`\n=== Final RAW KM Time Rankings ===`);
  rawKmTimes.forEach((horse, index) => {
    const kmTime = horse.best3Average;
    if (kmTime.minutes > 0 || kmTime.seconds > 0 || kmTime.tenths > 0) {
      console.log(`${index + 1}. ${horse.horseName}: ${kmTime.minutes}:${kmTime.seconds.toString().padStart(2, '0')}.${kmTime.tenths} (${horse.validTimesCount} races)`);
    } else {
      console.log(`${index + 1}. ${horse.horseName}: No valid times`);
    }
  });

  // 🔍 ENHANCED XANDER INVESTIGATION: Finalize debugging session
  if (EnhancedXanderDebugger.isDebugEnabled()) {
    const xanderResult = rawKmTimes.find(h => h.horseName.toLowerCase().includes('xander'));
    if (xanderResult) {
      EnhancedXanderDebugger.addCheckpoint(
        'race_analysis_complete',
        'completion',
        xanderResult.horseName,
        {
          finalRanking: rawKmTimes.findIndex(h => h.horseName === xanderResult.horseName) + 1,
          calculatedTime: `${xanderResult.best3Average.minutes}:${xanderResult.best3Average.seconds.toString().padStart(2, '0')}.${xanderResult.best3Average.tenths}`,
          validTimesUsed: xanderResult.validTimesCount,
          totalProcessingTime: Date.now() - (performance.now() || 0)
        },
        true
      );
    }
    
    // Generate final report and disable debugging
    console.log('🕵️ ENHANCED DEBUGGING: Generating final investigation report for Xander...');
    EnhancedXanderDebugger.disableDebugging();
  }

  return rawKmTimes;
};
