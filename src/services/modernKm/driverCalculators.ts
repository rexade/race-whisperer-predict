
export const calculateDriverAdjustment = (
  winPercentage: number,
  postPosition: number
): number => {
  // Normalize winPercentage into 0-100 range from possible inputs (e.g., 0.20, 20, 2000)
  const wpRaw = Number.isFinite(winPercentage) ? winPercentage : 0;
  let wp = wpRaw;
  if (wp > 100) {
    // Likely basis points (e.g., 1986 -> 19.86%)
    wp = wp / 100;
  } else if (wp > 0 && wp <= 1) {
    // Likely fractional (e.g., 0.20 -> 20%)
    wp = wp * 100;
  }
  wp = Math.max(0, Math.min(100, wp));

  const pos = Number.isFinite(postPosition) ? postPosition : 1;
  console.log(`[DRIVER DEBUG] Input: rawWin%=${wpRaw} -> normalized=${wp}%, postPosition=${pos}`);

  // Smooth, bounded mapping around a realistic baseline (~15%)
  // Use a gentle sigmoid so small differences don't explode adjustments
  const baseline = 15; // % where adjustment ~ 0
  const scale = 8;     // steeper -> smaller number; controls sensitivity
  const maxReward = -0.12; // seconds at very high win%
  const maxPenalty = 0.08; // seconds at very low win%

  const x = (wp - baseline) / scale; // normalized deviation
  const sigmoid = Math.tanh(x); // in [-1, 1]

  // Map to [-maxReward, +maxPenalty] but note rewards are negative (faster)
  // When wp > baseline -> negative (reward), else positive (penalty)
  const rewardSpan = Math.abs(maxReward);
  const penaltySpan = Math.abs(maxPenalty);
  const baseAdjustment = sigmoid >= 0
    ? -rewardSpan * sigmoid // reward up to -maxReward
    : penaltySpan * (-sigmoid); // penalty up to +maxPenalty

  // Tiny synergy: strong drivers slightly mitigate wide/outside positions
  // Only applies when wp > baseline and for positions worse than 8
  const posDeviation = Math.max(0, pos - 8); // 0 for 1-8, grows for 9+
  const skillFactor = Math.max(0, Math.min(1, (wp - baseline) / 10)); // 0..1
  const positionMitigation = -0.005 * posDeviation * skillFactor; // up to ~ -0.02s

  let adjustment = baseAdjustment + positionMitigation;

  // Final clamp for safety
  adjustment = Math.max(maxReward, Math.min(maxPenalty, adjustment));

  console.log(`[DRIVER DEBUG] Base=${baseAdjustment.toFixed(3)}s, PosMit=${positionMitigation.toFixed(3)}s -> Final=${adjustment.toFixed(3)}s`);
  return adjustment;
};
