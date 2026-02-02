/**
 * Kusk seger% → påslag/avdrag (sek/km), tabellvärden ±0.30.
 * Neutral ~12%; mjukare kurva (större scale) så 12% vs 15% inte ger för stort hopp.
 * x = (winPct - baseline) / scale; adjustment = -0.30 * tanh(x)
 */
export const calculateDriverAdjustment = (
  winPercentage: number,
  _postPosition: number
): number => {
  const wpRaw = Number.isFinite(winPercentage) ? winPercentage : 0;
  let wpFraction: number; // 0..1 (12% = 0.12)
  if (wpRaw > 1 && wpRaw <= 100) {
    wpFraction = wpRaw / 100;
  } else if (wpRaw > 100) {
    wpFraction = wpRaw / 10000;
  } else {
    wpFraction = Math.max(0, Math.min(1, wpRaw));
  }

  const baseline = 0.12;  // 12% = neutral
  const scale = 0.10;     // mjukare kurva: 3% skillnad (12%→15%) ger ~0.09s, inte ~0.15s
  const cap = 0.30;

  const x = (wpFraction - baseline) / scale;
  const adjustment = -cap * Math.tanh(x);

  console.log(`[DRIVER DEBUG] Kusk ${(wpFraction * 100).toFixed(1)}% -> påslag/avdrag ${adjustment.toFixed(3)}s`);
  return adjustment;
};
