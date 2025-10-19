
// CRITICAL: Enhanced safety functions to ensure we never render an object as React child

export const extractHorseNameAsString = (horseName: any): string => {
  // If it's already a string, return it
  if (typeof horseName === 'string') {
    return horseName;
  }
  
  // If it's null or undefined
  if (!horseName) {
    return 'Unknown Horse';
  }
  
  // If it's an object with name property
  if (typeof horseName === 'object' && horseName !== null) {
    if ('name' in horseName && typeof horseName.name === 'string') {
      return horseName.name;
    }
    
    // If it's an object with id and name
    if ('id' in horseName && 'name' in horseName) {
      const nameValue = (horseName as any).name;
      if (typeof nameValue === 'string') {
        return nameValue;
      }
    }
    
    return 'Unknown Horse';
  }
  
  // Fallback for any other type
  return String(horseName) || 'Unknown Horse';
};

export const extractDriverNameAsString = (driver: any): string => {
  // If it's already a string, return it
  if (typeof driver === 'string') {
    return driver;
  }
  
  // If it's null or undefined
  if (!driver) {
    return 'Unknown Driver';
  }
  
  // If it's an object with firstName and lastName
  if (typeof driver === 'object' && driver !== null) {
    if ('firstName' in driver && 'lastName' in driver) {
      const firstName = typeof driver.firstName === 'string' ? driver.firstName : String(driver.firstName || '');
      const lastName = typeof driver.lastName === 'string' ? driver.lastName : String(driver.lastName || '');
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || 'Unknown Driver';
    }
    
    // If it's an object with name property
    if ('name' in driver && typeof driver.name === 'string') {
      return driver.name;
    }
    
    return 'Unknown Driver';
  }
  
  // Fallback for any other type
  return String(driver) || 'Unknown Driver';
};

export const extractTrackNameAsString = (track: any): string => {
  // If it's already a string, return it
  if (typeof track === 'string') {
    return track;
  }
  
  // If it's null or undefined
  if (!track) {
    return 'Unknown Track';
  }
  
  // If it's an object with name property
  if (typeof track === 'object' && track !== null) {
    if ('name' in track && typeof track.name === 'string') {
      return track.name;
    }
    
    // If it's an object with id and name
    if ('id' in track && 'name' in track) {
      const nameValue = (track as any).name;
      if (typeof nameValue === 'string') {
        return nameValue;
      }
    }
    
    return 'Unknown Track';
  }
  
  // Fallback for any other type
  return String(track) || 'Unknown Track';
};
