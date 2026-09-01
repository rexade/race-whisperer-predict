import { describe, expect, it } from 'vitest';
import { BASELINE_ANCHORS, buildRaceObservations, conditionalLogit, impliedProbabilities, isWorthRecording, pairByAnchors } from '../oddsDrift';

describe('impliedProbabilities', () => {
  it('strips the overround so a race sums to one', () => {
    // Decimal odds always imply more than 100%: the difference is the
    // operator's margin. Differencing raw 1/odds across two snapshots would
    // measure the margin tightening toward post and read it as every horse
    // drifting at once.
    const probs = impliedProbabilities([1.8, 3.6, 3.6]);

    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(probs).toEqual([
      expect.closeTo(0.5, 10),
      expect.closeTo(0.25, 10),
      expect.closeTo(0.25, 10),
    ]);
  });
});

const capture = (minutesToPost: number, odds = 5) =>
  ({ raceId: 'r1', startNumber: 1, horseName: 'Horse', minutesToPost, odds });

describe('pairByAnchors', () => {
  it('takes the capture nearest each anchor, not the first and last', () => {
    // First/last would pick 2000 and 20. Anchoring keeps the lever arm
    // comparable across cards that happened to be captured for different spans.
    const { paired } = pairByAnchors([
      capture(2000), capture(1500), capture(1400),
      capture(300), capture(65), capture(20),
    ]);

    expect(paired).toHaveLength(1);
    expect(paired[0].early.minutesToPost).toBe(300);
    expect(paired[0].late.minutesToPost).toBe(65);
  });
});

const horse = (raceId: string, startNumber: number, minutesToPost: number, odds: number | null = 5) =>
  ({ raceId, startNumber, horseName: `H${startNumber}`, minutesToPost, odds });

describe('pairByAnchors drop accounting', () => {
  it('counts why each unpaired horse was dropped', () => {
    // Drops are not neutral: if late captures are the ones going missing, the
    // surviving sample is biased toward cards the scheduler happened to catch
    // near post, which is exactly the variable under test.
    const { paired, dropped } = pairByAnchors([
      horse('r1', 1, 300), horse('r1', 1, 65),
      horse('r1', 2, 65),
      horse('r1', 3, 300),
      horse('r1', 4, 300, null), horse('r1', 4, 65, null),
    ]);

    expect(paired.map(p => p.startNumber)).toEqual([1]);
    expect(dropped).toEqual({ noEarly: 1, noLate: 1, noOdds: 1 });
  });
});

describe('conditionalLogit', () => {
  it('recovers the analytic MLE and its standard error', () => {
    // Two horses, covariate 0 vs 1, and the x=1 horse wins 300 of 400 races.
    // Conditional logit on two alternatives reduces to binary logit, so the
    // maximum is exact: b = log(300/100), se = sqrt(1/(n*p*(1-p))).
    const races = [
      ...Array.from({ length: 300 }, () => ({ covariates: [[0], [1]], winnerIndex: 1 })),
      ...Array.from({ length: 100 }, () => ({ covariates: [[0], [1]], winnerIndex: 0 })),
    ];

    const fit = conditionalLogit(races);

    expect(fit.coefficients[0]).toBeCloseTo(Math.log(3), 6);
    expect(fit.standardErrors[0]).toBeCloseTo(Math.sqrt(1 / (400 * 0.75 * 0.25)), 6);
  });
});

/** Deterministic PRNG - a statistical test that changes verdict per run is useless. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const normal = (rand: () => number) =>
  Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

/**
 * Build races where the market prices `marketUtility` correctly and drift has
 * the given true effect. driftBeta = 0 is the null: drift is pure noise.
 */
const syntheticRaces = (seed: number, raceCount: number, driftBeta: number) => {
  const rand = mulberry32(seed);
  return Array.from({ length: raceCount }, () => {
    const field = Array.from({ length: 8 }, () => ({
      marketUtility: normal(rand),
      drift: normal(rand),
    }));

    // log(softmax(u)) = u - logsumexp(u); the constant cancels within a race,
    // so a coefficient of 1 on this covariate reproduces the market exactly.
    const softmax = (us: number[]) => {
      const max = Math.max(...us);
      const e = us.map(u => Math.exp(u - max));
      const total = e.reduce((a, b) => a + b, 0);
      return e.map(v => v / total);
    };

    const truth = softmax(field.map(h => h.marketUtility + driftBeta * h.drift));
    let u = rand();
    let winnerIndex = truth.findIndex(p => (u -= p) <= 0);
    if (winnerIndex < 0) winnerIndex = truth.length - 1;

    return {
      covariates: field.map(h => [h.marketUtility, h.drift]),
      winnerIndex,
    };
  });
};

describe('conditionalLogit on synthetic drift data', () => {
  it('reports drift as insignificant when it is pure noise', () => {
    // The result that would waste months: believing a spurious drift effect.
    const fit = conditionalLogit(syntheticRaces(20260901, 800, 0));

    expect(fit.converged).toBe(true);
    expect(fit.coefficients[0]).toBeGreaterThan(0.7); // market signal recovered
    expect(fit.coefficients[0]).toBeLessThan(1.3);
    expect(Math.abs(fit.z[1])).toBeLessThan(2);       // drift is not
  });

  it('detects drift when it genuinely carries information', () => {
    const fit = conditionalLogit(syntheticRaces(20260901, 800, 0.8));

    expect(fit.coefficients[1]).toBeGreaterThan(0.6);
    expect(fit.coefficients[1]).toBeLessThan(1.0);
    expect(fit.z[1]).toBeGreaterThan(2);
  });
});

const pairOf = (startNumber: number, earlyOdds: number, lateOdds: number) => ({
  raceId: 'r1',
  startNumber,
  horseName: `H${startNumber}`,
  early: { raceId: 'r1', startNumber, horseName: `H${startNumber}`, minutesToPost: 1440, odds: earlyOdds },
  late: { raceId: 'r1', startNumber, horseName: `H${startNumber}`, minutesToPost: 60, odds: lateOdds },
});

describe('buildRaceObservations', () => {
  it('builds covariates from within-race normalized probabilities', () => {
    // H1 shortens 2.0 -> 1.5, H2 drifts out 2.0 -> 3.0. Normalized late probs
    // are 2/3 and 1/3, so H1's drift is log((2/3) / (1/2)).
    const { observations } = buildRaceObservations(
      [pairOf(1, 2.0, 1.5), pairOf(2, 2.0, 3.0)],
      new Map([['r1', 1]])
    );

    expect(observations).toHaveLength(1);
    expect(observations[0].winnerIndex).toBe(0);
    expect(observations[0].covariates[0][0]).toBeCloseTo(Math.log(2 / 3), 10);
    expect(observations[0].covariates[0][1]).toBeCloseTo(Math.log((2 / 3) / 0.5), 10);
  });

  it('drops a race whose winner did not survive pairing', () => {
    // Scoring a race while its winner is missing from the field would silently
    // hand the win to whichever horse happened to be listed first.
    const { observations, droppedRaces } = buildRaceObservations(
      [pairOf(1, 2.0, 1.5), pairOf(2, 2.0, 3.0)],
      new Map([['r1', 7]])
    );

    expect(observations).toHaveLength(0);
    expect(droppedRaces).toBe(1);
  });

  it('drops a race whose field collapsed to one horse', () => {
    // Softmax over a single alternative is probability 1 regardless of beta:
    // it contributes nothing to the fit but inflates the race count, making
    // the sample look larger than it is.
    const { observations, droppedThinFields } = buildRaceObservations(
      [pairOf(1, 2.0, 1.5)],
      new Map([['r1', 1]])
    );

    expect(observations).toHaveLength(0);
    expect(droppedThinFields).toBe(1);
  });
});

describe('isWorthRecording', () => {
  it('records the final hours densely and a baseline near 24h, nothing between', () => {
    // Prices barely move more than a day out, so storing that stretch costs
    // megabytes per card and buys nothing. The 24h baselines are kept because
    // they are cheap and keep the wider comparison askable later.
    expect(isWorthRecording(30)).toBe(true);     // deep in the dense window
    expect(isWorthRecording(480)).toBe(true);    // 8h, edge of dense
    expect(isWorthRecording(600)).toBe(false);   // 10h, the dead zone
    expect(isWorthRecording(1440)).toBe(true);   // 24h baseline
    expect(isWorthRecording(1600)).toBe(false);  // too early to have settled
  });

  it('leaves a 24h baseline narrow enough to catch exactly one hourly run', () => {
    // A window wider than an hour would land two captures for the price of a
    // check we only need once. 60 minutes still absorbs the ~15min GitHub
    // routinely delays a scheduled run by before it would miss entirely.
    expect(isWorthRecording(1410)).toBe(true);
    expect(isWorthRecording(1470)).toBe(true);
    expect(isWorthRecording(1400)).toBe(false);
    expect(isWorthRecording(1480)).toBe(false);
  });

  it('refuses captures taken after the race started', () => {
    expect(isWorthRecording(-5)).toBe(false);
    expect(isWorthRecording(null)).toBe(false);
  });
});

describe('pairByAnchors anchor selection', () => {
  it('pairs against the 24h baseline when asked to rule out the wider window', () => {
    // The default is the late-money test inside the dense window. The baseline
    // anchors exist so a null at 6h can be checked against 24h rather than
    // being a dead end.
    const rows = [horse('r1', 1, 1440), horse('r1', 1, 300), horse('r1', 1, 65)];

    expect(pairByAnchors(rows).paired[0].early.minutesToPost).toBe(300);
    expect(pairByAnchors(rows, BASELINE_ANCHORS).paired[0].early.minutesToPost).toBe(1440);
  });
});
