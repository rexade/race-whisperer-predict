
export const calculateDriverAdjustment = (
  winPercentage: number,
  postPosition: number
): number => {
  let adjustment = 0;
  
  if (winPercentage > 25) adjustment -= 0.3;
  else if (winPercentage > 20) adjustment -= 0.2;
  else if (winPercentage > 15) adjustment -= 0.1;
  else if (winPercentage > 10) adjustment -= 0.05;
  else if (winPercentage <= 5) adjustment += 0.05;
  
  if (winPercentage > 25 && postPosition >= 9) {
    adjustment -= 0.08;
  } else if (winPercentage > 20 && postPosition >= 11) {
    adjustment -= 0.05;
  }
  
  return adjustment;
};
