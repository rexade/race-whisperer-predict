
import { extractHorseNameAsString, extractDriverNameAsString, extractTrackNameAsString } from './dataExtraction';

export interface ExtractedHorseData {
  safeHorseName: string;
  safeDriverName: string;
  safeHorseTrack: string;
  frontShoesBoolean: boolean;
  backShoesBoolean: boolean;
  frontShoesStr: string;
  backShoesStr: string;
  sulkyTypeString: string;
}

export const extractAndValidateHorseData = (horse: any): ExtractedHorseData => {
  // CRITICAL: Extract ALL string fields as strings to prevent object rendering
  const safeHorseName = extractHorseNameAsString(horse.name);
  const safeDriverName = extractDriverNameAsString(horse.driver);
  const safeHorseTrack = extractTrackNameAsString(horse.homeTrack);

  console.log(`🛡️ FINAL SAFETY CHECK - Horse ${horse.horseId}:`);
  console.log(`  - Horse name: "${safeHorseName}" (type: ${typeof safeHorseName})`);
  console.log(`  - Driver name: "${safeDriverName}" (type: ${typeof safeDriverName})`);
  console.log(`  - Home track: "${safeHorseTrack}" (type: ${typeof safeHorseTrack})`);
  
  // ENHANCED shoes and sulky logging and validation
  console.log(`👟 Horse ${horse.horseId} ENHANCED shoes data validation:`, {
    shoesObject: horse.shoes,
    frontShoes: horse.shoes?.front,
    backShoes: horse.shoes?.back,
    frontType: typeof horse.shoes?.front,
    backType: typeof horse.shoes?.back,
    frontBoolean: Boolean(horse.shoes?.front),
    backBoolean: Boolean(horse.shoes?.back)
  });
  
  console.log(`🛷 Horse ${horse.horseId} ENHANCED sulky data validation:`, {
    sulkyObject: horse.sulky,
    sulkyType: horse.sulky?.type,
    sulkyTypeType: typeof horse.sulky?.type,
    sulkyTypeString: String(horse.sulky?.type || 'VA')
  });

  // Validate that ALL critical string fields are actually strings
  if (typeof safeHorseName !== 'string') {
    console.error(`🚨 CRITICAL ERROR - Horse name is not a string after extraction! Type: ${typeof safeHorseName}, Value:`, safeHorseName);
    throw new Error(`Horse name extraction failed for horse ${horse.horseId}`);
  }

  if (typeof safeDriverName !== 'string') {
    console.error(`🚨 CRITICAL ERROR - Driver name is not a string after extraction! Type: ${typeof safeDriverName}, Value:`, safeDriverName);
    throw new Error(`Driver name extraction failed for horse ${horse.horseId}`);
  }

  if (typeof safeHorseTrack !== 'string') {
    console.error(`🚨 CRITICAL ERROR - Home track is not a string after extraction! Type: ${typeof safeHorseTrack}, Value:`, safeHorseTrack);
    throw new Error(`Home track extraction failed for horse ${horse.horseId}`);
  }

  // ENHANCED shoes handling for normalization with proper boolean conversion
  const frontShoesBoolean = Boolean(horse.shoes?.front);
  const backShoesBoolean = Boolean(horse.shoes?.back);
  const frontShoesStr = frontShoesBoolean ? "1" : "0";
  const backShoesStr = backShoesBoolean ? "1" : "0";
  
  console.log(`🛡️ Normalization shoes input for horse ${horse.horseId} (${safeHorseName}):`, {
    originalShoesObject: horse.shoes,
    frontRawValue: horse.shoes?.front,
    backRawValue: horse.shoes?.back,
    frontShoesBoolean,
    backShoesBoolean,
    frontShoesStr,
    backShoesStr,
    frontIsBarefoot: !frontShoesBoolean,
    backIsBarefoot: !backShoesBoolean
  });

  // ENHANCED: Ultra-safe sulky type extraction with comprehensive corruption detection
  let sulkyTypeString = "VA"; // Default fallback
  
  const safeSulkyExtraction = (sulkyData: any, sourcePath: string): string => {
    if (!sulkyData) {
      console.log(`🛷 No sulky data at ${sourcePath}, using default VA`);
      return "VA";
    }
    
    // Direct string check
    if (typeof sulkyData === 'string') {
      if (sulkyData.includes('[object Object]')) {
        console.error(`🚨 SULKY CORRUPTION at ${sourcePath}: Found [object Object]`);
        return "VA";
      }
      const cleaned = sulkyData.trim();
      if (cleaned) {
        console.log(`🛷 ✅ Valid string sulky at ${sourcePath}:`, cleaned);
        return cleaned;
      }
    }
    
    // Object extraction with multiple fallbacks
    if (typeof sulkyData === 'object' && sulkyData !== null) {
      const extractionPaths = ['code', 'type', 'name', 'category'];
      
      for (const prop of extractionPaths) {
        if (sulkyData[prop] && typeof sulkyData[prop] === 'string') {
          const value = sulkyData[prop].trim();
          if (value && !value.includes('[object Object]')) {
            console.log(`🛷 ✅ Extracted sulky from ${sourcePath}.${prop}:`, value);
            return value;
          }
        }
      }
      
      console.warn(`🛷 ⚠️ Object at ${sourcePath} has no extractable string properties:`, Object.keys(sulkyData));
      return "VA";
    }
    
    // Safe conversion for other types
    const converted = String(sulkyData);
    if (converted.includes('[object Object]')) {
      console.error(`🚨 CONVERSION CORRUPTION at ${sourcePath}:`, sulkyData, '→', converted);
      return "VA";
    }
    
    if (converted && converted !== 'undefined' && converted !== 'null') {
      console.log(`🛷 ✅ Converted sulky at ${sourcePath}:`, converted);
      return converted;
    }
    
    console.log(`🛷 Empty/invalid sulky at ${sourcePath}, using default VA`);
    return "VA";
  };
  
  // Try multiple extraction paths with comprehensive logging
  const sulkyExtractionPaths = [
    { data: horse.sulky?.type, path: 'horse.sulky.type' },
    { data: horse.sulky?.code, path: 'horse.sulky.code' },
    { data: horse.sulky?.category, path: 'horse.sulky.category' },
    { data: horse.sulky?.name, path: 'horse.sulky.name' },
    { data: horse.sulky, path: 'horse.sulky' },
    { data: horse.equipment?.sulky?.type, path: 'horse.equipment.sulky.type' },
    { data: horse.equipment?.sulky?.code, path: 'horse.equipment.sulky.code' }
  ];
  
  for (const { data, path } of sulkyExtractionPaths) {
    const extracted = safeSulkyExtraction(data, path);
    if (extracted !== "VA") {
      sulkyTypeString = extracted;
      break;
    }
  }
  
  console.log(`🛡️ Normalization sulky input for horse ${horse.horseId}:`, {
    originalSulkyType: horse.sulky?.type,
    originalType: typeof horse.sulky?.type,
    extractedSulkyTypeString: sulkyTypeString,
    extractedType: typeof sulkyTypeString
  });

  return {
    safeHorseName,
    safeDriverName,
    safeHorseTrack,
    frontShoesBoolean,
    backShoesBoolean,
    frontShoesStr,
    backShoesStr,
    sulkyTypeString
  };
};
