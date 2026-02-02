
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
      2: -0.25,  // Good position
      3: -0.20,  // Favorable position
      4: -0.10,  // Neutral
      5: 0.00,   // Baseline
      6: 0.05,   // Wide gate
      7: 0.15,   // Outside
      8: 0.30,   // Widest first-line draw
      9: 0.55,   // Second tier
      10: 0.65,  // Second tier
      11: 0.75,  // Second tier
      12: 0.85,  // Second tier
      13: 0.90,  // Extended
      14: 0.95,  // Extended
      15: 1.00   // Extended
    };
    
    const adjustment = autoAdjustments[postPosition] ?? 1.00; // Default for positions beyond 15
    console.log(`AUTO start position ${postPosition}: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s adjustment${customCurves ? ' (CUSTOM)' : ' (DEFAULT)'}`);
    return adjustment;
  } else {
    // Use custom curves if provided, otherwise use default VOLTE adjustments
    // Spår 6–10: +0.10 s; spår 11–15: +0.15 s (lägg på vs inner positions)
    const volteAdjustments = customCurves?.volte || {
      1: -0.25,  // Front-line advantage
      2: -0.20,  // Good position
      3: -0.10,  // Favourable in volt start
      4: 0.00,   // Neutral
      5: 0.05,   // Slight disadvantage
      6: 0.20,   // Wider position (+0.10)
      7: 0.25,   // Outside position (+0.10)
      8: 0.30,   // Widest first-line (+0.10)
      9: 0.50,   // Second row start (+0.10)
      10: 0.60,  // Second row start (+0.10)
      11: 0.75,  // Third row start (+0.15)
      12: 0.85,  // Third row start (+0.15)
      13: 0.90,  // Fourth row start (+0.15)
      14: 0.95,  // Fourth row start (+0.15)
      15: 1.00   // Fourth row start (+0.15)
    };
    
    const adjustment = volteAdjustments[postPosition] ?? 1.00; // Default for positions beyond 15
    console.log(`VOLTE start position ${postPosition}: ${adjustment >= 0 ? '+' : ''}${adjustment.toFixed(3)}s adjustment${customCurves ? ' (CUSTOM)' : ' (DEFAULT)'}`);
    return adjustment;
  }
};
