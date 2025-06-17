
export const calculateDriverAdjustment = (
  driverExperience: number,
  winPercentage: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  if (winPercentage > 20) adjustment -= 0.25;
  else if (winPercentage > 15) adjustment -= 0.15;
  else if (winPercentage > 10) adjustment -= 0.05;
  else if (winPercentage <= 5) adjustment += 0.02;
  
  if (winPercentage > 20 && postPosition >= 9) {
    adjustment -= 0.05;
  } else if (winPercentage > 15 && postPosition >= 11) {
    adjustment -= 0.03;
  }
  
  return adjustment;
};

export const calculateDriver2025Adjustment = (
  winPercentage2025: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  if (winPercentage2025 > 25) adjustment -= 0.3;
  else if (winPercentage2025 > 20) adjustment -= 0.2;
  else if (winPercentage2025 > 15) adjustment -= 0.1;
  else if (winPercentage2025 > 10) adjustment -= 0.05;
  else if (winPercentage2025 <= 5) adjustment += 0.05;
  
  if (winPercentage2025 > 25 && postPosition >= 9) {
    adjustment -= 0.08;
  } else if (winPercentage2025 > 20 && postPosition >= 11) {
    adjustment -= 0.05;
  }
  
  return adjustment;
};
