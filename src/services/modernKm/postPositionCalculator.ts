
export const calculatePostPositionAdjustment = (
  postPosition: number, 
  startMethod: string,
  customCurves?: { auto: { [key: number]: number }, volte: { [key: number]: number } }
): number => {
  const s = String(startMethod ?? '').trim().toLowerCase();
  const isVolteStart = s.startsWith('volt') || s === 'v';
  const isAutoStart = s.startsWith('auto') || s === 'a' || (!isVolteStart);
  
  if (!Number.isFinite(postPosition) || postPosition <= 0) {
    console.warn(`[postPositionAdjustment] Invalid postPosition "${postPosition}", returning 0s`);
    return 0;
  }
  
  console.log(`Calculating post position adjustment for position ${postPosition}, start method: ${startMethod} (${isAutoStart ? 'AUTO' : 'VOLTE'})`);
  
  if (isAutoStart) {
    // Use custom curves if provided, otherwise use default auto adjustments
    const autoAdjustments = customCurves?.auto || {
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
      12: 1.00,  // Second tier
      13: 1.00,  // Extended
      14: 1.00,  // Extended
      15: 1.00   // Extended
    };
    
    const adjustment = autoAdjustments[postPosition] ?? 1.00; // Default for positions beyond 15
    console.log(`AUTO start position ${postPosition}: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s adjustment${customCurves ? ' (CUSTOM)' : ' (DEFAULT)'}`);
    return adjustment;
  } else {
    // Use custom curves if provided, otherwise use default volte adjustments
    const volteAdjustments = customCurves?.volte || {
      1: -0.20,  // Front-line advantage
      2: 0.20,   // Front line but tight turn
      3: -0.20,  // Favourable in volt start
      4: 0.10,   // Front-line disadvantage
      5: 0.10,   // Front-line disadvantage
      6: -0.10,  // Advantage in volt start
      7: -0.10,  // Advantage in volt start
      8: 0.00,   // Neutral
      9: 0.50,   // Second row start
      10: 0.50,  // Second row start
      11: 0.70,  // Third row start
      12: 0.70,  // Third row start
      13: 1.00,  // Fourth row start
      14: 1.00,  // Fourth row start
      15: 1.00   // Fourth row start
    };
    
    const adjustment = volteAdjustments[postPosition] ?? 1.00; // Default for positions beyond 15
    console.log(`VOLTE start position ${postPosition}: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s adjustment${customCurves ? ' (CUSTOM)' : ' (DEFAULT)'}`);
    return adjustment;
  }
};
