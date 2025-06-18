
// CRITICAL: Enhanced safety functions to ensure we never render an object as React child

export const extractHorseNameAsString = (horseName: any): string => {
  console.log('🔍 EXTRACTING HORSE NAME - Input:', JSON.stringify(horseName), 'Type:', typeof horseName);
  
  // If it's already a string, return it
  if (typeof horseName === 'string') {
    console.log('✅ Horse name is already a string:', horseName);
    return horseName;
  }
  
  // If it's null or undefined
  if (!horseName) {
    console.warn('⚠️ Horse name is null/undefined, using fallback');
    return 'Unknown Horse';
  }
  
  // If it's an object with name property
  if (typeof horseName === 'object' && horseName !== null) {
    console.log('🔧 Horse name is an object, attempting to extract name:', JSON.stringify(horseName));
    
    if ('name' in horseName && typeof horseName.name === 'string') {
      console.log('✅ Extracted name from object.name:', horseName.name);
      return horseName.name;
    }
    
    // If it's an object with id and name
    if ('id' in horseName && 'name' in horseName) {
      const nameValue = (horseName as any).name;
      if (typeof nameValue === 'string') {
        console.log('✅ Extracted name from id/name object:', nameValue);
        return nameValue;
      }
    }
    
    console.error('❌ Horse name is an object but no valid name found:', JSON.stringify(horseName));
    return 'Unknown Horse';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Horse name is unexpected type:', typeof horseName, horseName);
  return String(horseName) || 'Unknown Horse';
};

export const extractDriverNameAsString = (driver: any): string => {
  console.log('🔍 EXTRACTING DRIVER NAME - Input:', JSON.stringify(driver), 'Type:', typeof driver);
  
  // If it's already a string, return it
  if (typeof driver === 'string') {
    console.log('✅ Driver name is already a string:', driver);
    return driver;
  }
  
  // If it's null or undefined
  if (!driver) {
    console.warn('⚠️ Driver is null/undefined, using fallback');
    return 'Unknown Driver';
  }
  
  // If it's an object with firstName and lastName
  if (typeof driver === 'object' && driver !== null) {
    console.log('🔧 Driver is an object, attempting to extract name:', JSON.stringify(driver));
    
    if ('firstName' in driver && 'lastName' in driver) {
      const firstName = typeof driver.firstName === 'string' ? driver.firstName : String(driver.firstName || '');
      const lastName = typeof driver.lastName === 'string' ? driver.lastName : String(driver.lastName || '');
      const fullName = `${firstName} ${lastName}`.trim();
      console.log('✅ Extracted driver name from firstName/lastName:', fullName);
      return fullName || 'Unknown Driver';
    }
    
    // If it's an object with name property
    if ('name' in driver && typeof driver.name === 'string') {
      console.log('✅ Extracted driver name from object.name:', driver.name);
      return driver.name;
    }
    
    console.error('❌ Driver is an object but no valid name found:', JSON.stringify(driver));
    return 'Unknown Driver';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Driver is unexpected type:', typeof driver, driver);
  return String(driver) || 'Unknown Driver';
};

export const extractTrackNameAsString = (track: any): string => {
  console.log('🔍 EXTRACTING TRACK NAME - Input:', JSON.stringify(track), 'Type:', typeof track);
  
  // If it's already a string, return it
  if (typeof track === 'string') {
    console.log('✅ Track name is already a string:', track);
    return track;
  }
  
  // If it's null or undefined
  if (!track) {
    console.warn('⚠️ Track is null/undefined, using fallback');
    return 'Unknown Track';
  }
  
  // If it's an object with name property
  if (typeof track === 'object' && track !== null) {
    console.log('🔧 Track is an object, attempting to extract name:', JSON.stringify(track));
    
    if ('name' in track && typeof track.name === 'string') {
      console.log('✅ Extracted track name from object.name:', track.name);
      return track.name;
    }
    
    // If it's an object with id and name
    if ('id' in track && 'name' in track) {
      const nameValue = (track as any).name;
      if (typeof nameValue === 'string') {
        console.log('✅ Extracted track name from id/name object:', nameValue);
        return nameValue;
      }
    }
    
    console.error('❌ Track is an object but no valid name found:', JSON.stringify(track));
    return 'Unknown Track';
  }
  
  // Fallback for any other type
  console.warn('⚠️ Track is unexpected type:', typeof track, track);
  return String(track) || 'Unknown Track';
};
