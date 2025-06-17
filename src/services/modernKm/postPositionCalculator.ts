
export const calculatePostPositionAdjustment = (postPosition: number, startMethod: string): number => {
  const startMethodLower = startMethod.toLowerCase();
  const isAutoStart = startMethodLower === "auto" || startMethodLower === "a" || !startMethodLower.includes("volte");
  
  console.log(`Calculating post position adjustment for position ${postPosition}, start method: ${startMethod} (${isAutoStart ? 'AUTO' : 'VOLTE'})`);
  
  if (isAutoStart) {
    // Auto start baseline time adjustments from your data
    const autoAdjustments: { [key: number]: number } = {
      1: 0.25,   // 9.7% win rate, 0.25s time adj
      2: 0.06,   // 11.6% win rate, 0.06s time adj  
      3: 0.03,   // 11.9% win rate, 0.03s time adj
      4: 0.08,   // 11.9% win rate, 0.08s time adj
      5: 0.0,    // 12.2% win rate, 0.0s time adj (best performance)
      6: 0.09,   // 11.3% win rate, 0.09s time adj
      7: 0.25,   // 9.7% win rate, 0.25s time adj
      8: 0.48,   // 7.4% win rate, 0.48s time adj
      9: 0.49,   // 7.3% win rate, 0.49s time adj
      10: 0.5,   // 7.2% win rate, 0.5s time adj
      11: 0.5,   // 7.2% win rate, 0.5s time adj
      12: 0.61,  // 6.1% win rate, 0.61s time adj
      13: 1.05,  // 1.7% win rate, 1.05s time adj
      14: 1.1,   // 1.2% win rate, 1.1s time adj
      15: 1.1    // 1.2% win rate, 1.1s time adj
    };
    
    const adjustment = autoAdjustments[postPosition] || 1.1; // Default to worst case for positions beyond 15
    console.log(`AUTO start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  } else {
    // Volte start baseline time adjustments from your data
    const volteAdjustments: { [key: number]: number } = {
      1: 0.03,   // 12.2% win rate, 0.03s time adj
      2: 0.11,   // 11.4% win rate, 0.11s time adj
      3: 0.4,    // 8.5% win rate, 0.4s time adj
      4: 0.0,    // 12.5% win rate, 0.0s time adj (best performance)
      5: 0.31,   // 9.4% win rate, 0.31s time adj
      6: 0.47,   // 7.8% win rate, 0.47s time adj
      7: 0.71,   // 5.4% win rate, 0.71s time adj
      8: 0.64,   // 6.1% win rate, 0.64s time adj
      9: 0.66,   // 5.9% win rate, 0.66s time adj
      10: 0.83,  // 4.2% win rate, 0.83s time adj
      11: 0.84,  // 4.1% win rate, 0.84s time adj
      12: 0.9,   // 3.5% win rate, 0.9s time adj
      13: 1.23,  // 0.2% win rate, 1.23s time adj
      14: 1.22,  // 0.3% win rate, 1.22s time adj
      15: 1.23   // 0.2% win rate, 1.23s time adj
    };
    
    const adjustment = volteAdjustments[postPosition] || 1.23; // Default to worst case for positions beyond 15
    console.log(`VOLTE start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  }
};
