
export const calculateDriverAdjustment = (
  winPercentage: number,
  postPosition: number
): number => {
  console.log(`[DRIVER DEBUG] Input: winPercentage=${winPercentage}%, postPosition=${postPosition}`);
  
  let adjustment = 0;
  let reason = '';
  
  if (winPercentage > 25) {
    adjustment -= 0.3;
    reason = 'Win% > 25%';
  } else if (winPercentage > 20) {
    adjustment -= 0.2;
    reason = 'Win% > 20%';
  } else if (winPercentage > 15) {
    adjustment -= 0.1;
    reason = 'Win% > 15%';
  } else if (winPercentage > 10) {
    adjustment -= 0.05;
    reason = 'Win% > 10%';
  } else if (winPercentage > 5) {
    adjustment += 0.02;
    reason = 'Win% 5-10%';
  } else {
    adjustment += 0.05;
    reason = 'Win% <= 5%';
  }
  
  console.log(`[DRIVER DEBUG] Base adjustment: ${adjustment}s (${reason})`);
  
  // Post position bonus for good drivers
  let positionBonus = 0;
  if (winPercentage > 25 && postPosition >= 9) {
    positionBonus = -0.08;
    console.log(`[DRIVER DEBUG] Position bonus: ${positionBonus}s (win% > 25% and pos >= 9)`);
  } else if (winPercentage > 20 && postPosition >= 11) {
    positionBonus = -0.05;
    console.log(`[DRIVER DEBUG] Position bonus: ${positionBonus}s (win% > 20% and pos >= 11)`);
  }
  
  adjustment += positionBonus;
  
  console.log(`[DRIVER DEBUG] Final adjustment: ${adjustment}s`);
  return adjustment;
};
