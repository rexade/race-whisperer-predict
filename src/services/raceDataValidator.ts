import { EnhancedRaceData, EnhancedHorseData } from './enhancedAtgApi';
import { log } from '../lib/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixes: DataFix[];
}

export interface DataFix {
  type: 'duplicate_position' | 'missing_data' | 'sequence_fix';
  description: string;
  horsesAffected: number[];
}

export interface ScratchAnalysis {
  likelyScratches: number[]; // Post positions that appear to be scratched
  actualDuplicates: number[]; // Post positions with genuine duplicates
  maxPosition: number;
  expectedHorses: number;
  actualHorses: number;
}

const analyzeScratchesAndDuplicates = (horses: EnhancedHorseData[]): ScratchAnalysis => {
  log.debug(`analyzing scratches and duplicates`);
  
  // Group horses by post position
  const postPositionMap = new Map<number, EnhancedHorseData[]>();
  horses.forEach(horse => {
    const pos = horse.postPosition;
    if (!postPositionMap.has(pos)) {
      postPositionMap.set(pos, []);
    }
    postPositionMap.get(pos)!.push(horse);
  });

  // Find actual duplicates (multiple horses at same position)
  const actualDuplicates: number[] = [];
  postPositionMap.forEach((horsesAtPosition, position) => {
    if (horsesAtPosition.length > 1) {
      actualDuplicates.push(position);
      log.debug(`actual duplicate at position ${position}: ${horsesAtPosition.map(h => h.name).join(', ')}`);
    }
  });

  const positions = horses.map(h => h.postPosition).sort((a, b) => a - b);
  const maxPosition = Math.max(...positions);
  const minPosition = Math.min(...positions);
  const actualHorses = horses.length;

  // Determine likely scratches based on gaps in sequence
  const likelyScratches: number[] = [];
  
  // If we have no actual duplicates but gaps in sequence, those are likely scratches
  if (actualDuplicates.length === 0) {
    const allPositionsInRange = Array.from({length: maxPosition - minPosition + 1}, (_, i) => minPosition + i);
    const missingPositions = allPositionsInRange.filter(pos => !positions.includes(pos));
    
    // Only consider positions as scratches if they create a reasonable gap pattern
    missingPositions.forEach(pos => {
      // A position is likely scratched if it's between other valid positions
      const hasLowerPosition = positions.some(p => p < pos);
      const hasHigherPosition = positions.some(p => p > pos);
      
      if (hasLowerPosition && hasHigherPosition) {
        likelyScratches.push(pos);
        log.debug(`position ${pos} appears to be scratched (gap in sequence)`);
      }
    });
  }

  const analysis: ScratchAnalysis = {
    likelyScratches,
    actualDuplicates,
    maxPosition,
    expectedHorses: maxPosition, // In a perfect world, this would equal the number of horses
    actualHorses
  };

  log.debug(`scratch analysis result:`, {
    actualHorses: analysis.actualHorses,
    maxPosition: analysis.maxPosition,
    likelyScratches: analysis.likelyScratches,
    actualDuplicates: analysis.actualDuplicates,
    scratchCount: analysis.likelyScratches.length
  });

  return analysis;
};

export const validateRaceData = (raceData: EnhancedRaceData): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fixes: []
  };

  log.debug(`validating race data for ${raceData.raceId}, ${raceData.horses.length} horses`);

  // Analyze scratches and duplicates
  const scratchAnalysis = analyzeScratchesAndDuplicates(raceData.horses);

  // Handle actual duplicate positions (this is a real error)
  if (scratchAnalysis.actualDuplicates.length > 0) {
    result.isValid = false;
    
    scratchAnalysis.actualDuplicates.forEach(position => {
      const horsesAtPosition = raceData.horses.filter(h => h.postPosition === position);
      result.errors.push(`Duplicate post position ${position}: ${horsesAtPosition.map(h => h.name).join(', ')}`);
      
      result.fixes.push({
        type: 'duplicate_position',
        description: `Reassign post positions for horses with duplicate position ${position}`,
        horsesAffected: horsesAtPosition.map(h => h.horseId)
      });
    });
  }

  // Handle likely scratches (this is normal, just informational)
  if (scratchAnalysis.likelyScratches.length > 0) {
    result.warnings.push(
      `Detected ${scratchAnalysis.likelyScratches.length} likely scratched horses at positions: ${scratchAnalysis.likelyScratches.join(', ')}`
    );
    log.debug(`scratched horses detected — normal before race start`);
  }

  // Check for unusual position patterns that might indicate data issues
  const maxGap = scratchAnalysis.maxPosition - scratchAnalysis.actualHorses;
  if (maxGap > 5 && scratchAnalysis.actualDuplicates.length === 0) {
    result.warnings.push(
      `Large gap in post positions (max: ${scratchAnalysis.maxPosition}, horses: ${scratchAnalysis.actualHorses}). ` +
      `This might indicate ${maxGap} scratched horses or data issues.`
    );
  }

  // Update data quality in the race data
  raceData.dataQuality.hasValidPostPositions = scratchAnalysis.actualDuplicates.length === 0;
  raceData.dataQuality.duplicatePositions = scratchAnalysis.actualDuplicates;

  log.debug(`validation result: ${result.isValid ? 'valid' : 'invalid'}`);
  if (result.errors.length > 0) {
    log.debug('errors:', result.errors);
  }
  if (result.warnings.length > 0) {
    log.debug('warnings:', result.warnings);
  }

  return result;
};

export const fixRaceDataIssues = (raceData: EnhancedRaceData): EnhancedRaceData => {
  log.debug(`attempting to fix race data issues`);
  
  const validation = validateRaceData(raceData);
  
  if (validation.isValid) {
    log.debug('no fixes needed — data is valid');
    return raceData;
  }

  // Create a copy to avoid mutating original data
  const fixedData = JSON.parse(JSON.stringify(raceData)) as EnhancedRaceData;
  
  // Only fix actual duplicate positions, NOT scratched horses
  const duplicateFixes = validation.fixes.filter(fix => fix.type === 'duplicate_position');
  
  if (duplicateFixes.length > 0) {
    log.debug('fixing actual duplicate post positions (not scratches)');
    
    const scratchAnalysis = analyzeScratchesAndDuplicates(fixedData.horses);
    
    // For each duplicate position, reassign one of the horses to an available position
    scratchAnalysis.actualDuplicates.forEach(duplicatePosition => {
      const horsesAtPosition = fixedData.horses.filter(h => h.postPosition === duplicatePosition);
      log.debug(`fixing duplicate at position ${duplicatePosition} with ${horsesAtPosition.length} horses`);
      
      // Keep the first horse at the original position, move others
      for (let i = 1; i < horsesAtPosition.length; i++) {
        const horseToMove = horsesAtPosition[i];
        
        // Find the next available position
        let newPosition = duplicatePosition + 1;
        while (fixedData.horses.some(h => h.postPosition === newPosition)) {
          newPosition++;
        }
        
        log.debug(`moving ${horseToMove.name}: ${duplicatePosition} -> ${newPosition}`);
        horseToMove.postPosition = newPosition;
      }
    });
    
    // Update data quality
    fixedData.dataQuality.hasValidPostPositions = true;
    fixedData.dataQuality.duplicatePositions = [];
    
    log.debug('fixed duplicate positions while preserving scratch gaps');
  }
  
  const finalValidation = validateRaceData(fixedData);
  log.debug(`fix result: ${finalValidation.isValid ? 'success' : 'failed'}`);
  
  return fixedData;
};
