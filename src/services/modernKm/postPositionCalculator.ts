
export const calculatePostPositionAdjustment = (postPosition: number, startMethod: string): number => {
  const startMethodLower = startMethod.toLowerCase();
  const isAutoStart = startMethodLower === "auto" || startMethodLower === "a" || !startMethodLower.includes("volte");
  
  console.log(`Calculating post position adjustment for position ${postPosition}, start method: ${startMethod} (${isAutoStart ? 'AUTO' : 'VOLTE'})`);
  
  if (isAutoStart) {
    // Auto start baseline time adjustments
    const autoAdjustments: { [key: number]: number } = {
      1: -0.30,  // Rail advantage
      2: -0.20,  // Good position
      3: -0.25,  // Favorable position
      4: -0.10,  // Neutral
      5: 0.00,   // Baseline
      6: 0.20,   // Wide gate
      7: 0.30,   // Outside
      8: 0.40,   // Widest first-line draw
      9: 0.80,   // Second tier
      10: 0.80,  // Second tier
      11: 1.00,  // Second tier
      12: 1.00   // Second tier
      // Posts 13-15 not applicable for auto start
    };
    
    const adjustment = autoAdjustments[postPosition] || 1.00; // Default for positions beyond 12
    console.log(`AUTO start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  } else {
    // Volt start baseline time adjustments
    const volteAdjustments: { [key: number]: number } = {
      1: -0.20,  // Front-line advantage
      2: 0.20,   // Front line but tight turn
      3: -0.20,  // Favourable in volt start
      4: 0.10,   // Front-line disadvantage
      5: 0.10,   // Front-line disadvantage
      6: -0.10,  // Advantage in volt start
      7: -0.10,  // Advantage in volt start
      8: 0.00,   // Neutral (no post 8 in first line)
      // Post positions 9+ are second row and beyond
      9: 0.50,   // Second row start
      10: 0.50,  // Second row start
      11: 0.70,  // Third row start
      12: 0.70,  // Third row start
      13: 1.00,  // Fourth row start
      14: 1.00,  // Fourth row start
      15: 1.00   // Fourth row start
    };
    
    const adjustment = volteAdjustments[postPosition] || 1.00; // Default for positions beyond 15
    console.log(`VOLTE start position ${postPosition}: +${adjustment.toFixed(3)}s adjustment`);
    return adjustment;
  }
};
