
import { EnhancedRaceData, EnhancedHorseData } from './enhancedAtgApi';

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

export const validateRaceData = (raceData: EnhancedRaceData): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fixes: []
  };

  console.log(`\n=== Validating race data for ${raceData.raceId} ===`);

  // Check for duplicate post positions
  const postPositionMap = new Map<number, EnhancedHorseData[]>();
  
  raceData.horses.forEach(horse => {
    const pos = horse.postPosition;
    if (!postPositionMap.has(pos)) {
      postPositionMap.set(pos, []);
    }
    postPositionMap.get(pos)!.push(horse);
  });

  // Detect duplicates
  const duplicates: number[] = [];
  postPositionMap.forEach((horses, position) => {
    if (horses.length > 1) {
      duplicates.push(position);
      result.isValid = false;
      result.errors.push(`Duplicate post position ${position}: ${horses.map(h => h.name).join(', ')}`);
      
      result.fixes.push({
        type: 'duplicate_position',
        description: `Reassign post positions for horses at position ${position}`,
        horsesAffected: horses.map(h => h.horseId)
      });
    }
  });

  // Check for missing sequential positions
  const positions = raceData.horses.map(h => h.postPosition).sort((a, b) => a - b);
  const expectedSequence = Array.from({length: raceData.horses.length}, (_, i) => i + 1);
  
  const missingPositions = expectedSequence.filter(pos => !positions.includes(pos));
  if (missingPositions.length > 0) {
    result.warnings.push(`Missing post positions: ${missingPositions.join(', ')}`);
  }

  // Check for gaps in sequence
  const maxPosition = Math.max(...positions);
  if (maxPosition > raceData.horses.length) {
    result.warnings.push(`Post position sequence has gaps (max: ${maxPosition}, horses: ${raceData.horses.length})`);
  }

  console.log(`Validation result: ${result.isValid ? 'VALID' : 'INVALID'}`);
  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }
  if (result.warnings.length > 0) {
    console.log('Warnings:', result.warnings);
  }

  return result;
};

export const fixRaceDataIssues = (raceData: EnhancedRaceData): EnhancedRaceData => {
  console.log(`\n=== Attempting to fix race data issues ===`);
  
  const validation = validateRaceData(raceData);
  
  if (validation.isValid) {
    console.log('✅ No fixes needed - data is valid');
    return raceData;
  }

  // Create a copy to avoid mutating original data
  const fixedData = JSON.parse(JSON.stringify(raceData)) as EnhancedRaceData;
  
  // Fix duplicate post positions by reassigning based on start number
  const duplicateFixes = validation.fixes.filter(fix => fix.type === 'duplicate_position');
  
  if (duplicateFixes.length > 0) {
    console.log('🔧 Fixing duplicate post positions...');
    
    // Reassign post positions based on start number (index + 1)
    fixedData.horses.forEach((horse, index) => {
      const newPostPosition = index + 1;
      if (horse.postPosition !== newPostPosition) {
        console.log(`  Reassigning ${horse.name}: ${horse.postPosition} → ${newPostPosition}`);
        horse.postPosition = newPostPosition;
      }
    });
    
    // Update data quality
    fixedData.dataQuality.hasValidPostPositions = true;
    fixedData.dataQuality.duplicatePositions = [];
  }
  
  const finalValidation = validateRaceData(fixedData);
  console.log(`Fix result: ${finalValidation.isValid ? 'SUCCESS' : 'FAILED'}`);
  
  return fixedData;
};
