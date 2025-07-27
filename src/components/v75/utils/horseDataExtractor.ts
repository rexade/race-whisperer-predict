
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
  
  console.log(`🛡️ Normalization shoes input for horse ${horse.horseId}:`, {
    frontShoesBoolean,
    backShoesBoolean,
    frontShoesStr,
    backShoesStr
  });

  // CRITICAL FIX: Proper sulky type extraction to prevent [object Object] conversion
  let sulkyTypeString = "VA"; // Default fallback
  
  if (horse.sulky?.type) {
    if (typeof horse.sulky.type === 'string') {
      sulkyTypeString = horse.sulky.type;
    } else if (typeof horse.sulky.type === 'object' && horse.sulky.type !== null) {
      // Handle object cases - look for common properties
      if (horse.sulky.type.name && typeof horse.sulky.type.name === 'string') {
        sulkyTypeString = horse.sulky.type.name;
      } else if (horse.sulky.type.code && typeof horse.sulky.type.code === 'string') {
        sulkyTypeString = horse.sulky.type.code;
      } else if (horse.sulky.type.type && typeof horse.sulky.type.type === 'string') {
        sulkyTypeString = horse.sulky.type.type;
      } else {
        console.warn(`🚨 SULKY DATA CORRUPTION: Unable to extract string from object for horse ${horse.horseId}:`, horse.sulky.type);
        sulkyTypeString = "VA"; // Safe fallback
      }
    } else {
      // Handle other types by safe conversion
      sulkyTypeString = String(horse.sulky.type);
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
