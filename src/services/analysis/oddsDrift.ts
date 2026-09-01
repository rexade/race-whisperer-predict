/**
 * Convert a race's decimal odds into probabilities that sum to one.
 *
 * Raw 1/odds sums to more than one — the excess is the operator's margin, and
 * it tightens as post approaches. Differencing un-normalized probabilities
 * across two snapshots would pick that up as every horse shortening at once.
 */
export const impliedProbabilities = (odds: number[]): number[] => {
  const raw = odds.map(o => 1 / o);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map(p => p / total);
};

/**
 * How long before the betting deadline a capture is worth storing.
 *
 * For a V85/V86 the whole ticket must be in before the FIRST leg runs, so the
 * deadline is that leg's start -- not each leg's own post time. Odds keep
 * moving through the rest of the card, but that movement is unbettable, and
 * fitting on it would be look-ahead leakage.
 *
 * Nothing before ~25h: prices have not settled and it is the bulk of the bytes.
 */
export const RECORDING_WINDOW = { from: 0, to: 1500 };

/**
 * Shortest price treated as real. ATG reports 1.00 for a hot favourite before
 * the pool develops - a tote cannot pay stake-back-and-nothing, and 1/1.00 is
 * an implied probability of 1.0, which would swamp the within-race
 * normalization and corrupt every other horse in that race.
 */
export const MIN_REAL_ODDS = 1.02;

export const isRealPrice = (odds: number | null): odds is number =>
  odds !== null && odds >= MIN_REAL_ODDS;

/** Whether a capture this far from the betting deadline is worth a row. */
export const isWorthRecording = (minutesToDeadline: number | null): boolean =>
  minutesToDeadline !== null
  && minutesToDeadline >= RECORDING_WINDOW.from
  && minutesToDeadline <= RECORDING_WINDOW.to;

export interface SnapshotRow {
  raceId: string;
  startNumber: number;
  horseName: string;
  /** Minutes from capture to the card's betting deadline (first leg's start). */
  minutesToDeadline: number | null;
  odds: number | null;
}

export interface Pair {
  raceId: string;
  startNumber: number;
  horseName: string;
  early: SnapshotRow;
  late: SnapshotRow;
}

export interface Anchors {
  early: number;
  earlyTolerance: number;
  late: number;
  lateTolerance: number;
}

/**
 * Which two readings get compared. Recording is continuous, so these can be
 * swept later once the data shows where the movement actually is -- that is
 * the point of storing the whole 24h rather than just these two moments.
 */
export const DEFAULT_ANCHORS: Anchors = {
  early: 1440, earlyTolerance: 90,
  late: 45, lateTolerance: 45,
};

const nearest = (rows: SnapshotRow[], anchor: number, tolerance: number) => {
  const within = rows.filter(r => Math.abs((r.minutesToDeadline as number) - anchor) <= tolerance);
  if (within.length === 0) return null;
  return within.reduce((best, r) =>
    Math.abs((r.minutesToDeadline as number) - anchor) < Math.abs((best.minutesToDeadline as number) - anchor) ? r : best
  );
};

/**
 * Reduce a horse's many captures to one early/late pair.
 *
 * Anchored rather than first/last: drift measured over whatever span a card
 * happened to be captured for is not comparable between cards, and the
 * hypothesis is specifically about late money.
 */
export interface DropCounts {
  /** Horse had no capture near the early anchor. */
  noEarly: number;
  /** Horse had no capture near the late anchor. */
  noLate: number;
  /** Scratched, or the pool never priced it. */
  noOdds: number;
  /** Every capture fell outside the recording window. */
  outsideWindow: number;
}

/**
 * Reduce each horse's many captures to one early/late pair.
 *
 * Anchored rather than first/last: drift measured over whatever span a card
 * happened to be captured for is not comparable between cards, and the
 * hypothesis is specifically about late money.
 *
 * Drops are counted rather than discarded quietly. If late captures are the
 * ones going missing, the surviving sample is skewed toward cards the
 * scheduler caught near post - which is the variable under test, so a silent
 * drop rate would bias the result in the direction of the hypothesis.
 */
export const pairByAnchors = (
  rows: SnapshotRow[],
  anchors: Anchors = DEFAULT_ANCHORS
): { paired: Pair[]; dropped: DropCounts } => {
  const byHorse = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    // A capture taken after betting closed cannot inform a bet.
    const key = `${row.raceId}|${row.startNumber}`;
    const group = byHorse.get(key);
    if (group) group.push(row);
    else byHorse.set(key, [row]);
  }

  const paired: Pair[] = [];
  const dropped: DropCounts = { noEarly: 0, noLate: 0, noOdds: 0, outsideWindow: 0 };

  for (const group of byHorse.values()) {
    // A capture taken after betting closed cannot inform a bet, and one taken
    // before prices settle is not stored at all.
    const inWindow = group.filter(r => isWorthRecording(r.minutesToDeadline));
    if (inWindow.length === 0) { dropped.outsideWindow++; continue; }

    const priced = inWindow.filter(r => isRealPrice(r.odds));
    if (priced.length === 0) { dropped.noOdds++; continue; }

    const early = nearest(priced, anchors.early, anchors.earlyTolerance);
    if (!early) { dropped.noEarly++; continue; }

    const late = nearest(priced, anchors.late, anchors.lateTolerance);
    if (!late || late === early) { dropped.noLate++; continue; }

    paired.push({
      raceId: group[0].raceId,
      startNumber: group[0].startNumber,
      horseName: group[0].horseName,
      early,
      late,
    });
  }
  return { paired, dropped };
};

export interface RaceObservation {
  /** One covariate row per horse in the race. */
  covariates: number[][];
  winnerIndex: number;
}

export interface LogitFit {
  coefficients: number[];
  standardErrors: number[];
  /** coefficient / standard error. |z| > 1.96 is the usual 5% threshold. */
  z: number[];
  logLikelihood: number;
  iterations: number;
  converged: boolean;
}

/** Gauss-Jordan inverse. Small k only (one row per covariate). */
const invert = (m: number[][]): number[][] => {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error('Information matrix is singular - covariates are collinear or a covariate never varies within a race');
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map(row => row.slice(n));
};

/**
 * Conditional (race-level) logit: P(i wins) = exp(b.xi) / sum_j exp(b.xj).
 *
 * Exactly one horse wins each race and the within-race probabilities are
 * dependent, so plain logistic regression would treat a ten-horse field as ten
 * independent trials and overstate significance badly. There is no intercept:
 * it is constant across horses within a race, cancels in the conditional
 * likelihood, and is not identified.
 */
/** Gradient, observed information and log-likelihood at a given beta. */
const accumulate = (races: RaceObservation[], beta: number[], k: number) => {
  const gradient = new Array(k).fill(0);
  const information = Array.from({ length: k }, () => new Array(k).fill(0));
  let logLikelihood = 0;

  for (const race of races) {
    const utilities = race.covariates.map(x => x.reduce((s, v, j) => s + v * beta[j], 0));
    // Subtract the max before exponentiating; long odds make raw exp overflow.
    const max = Math.max(...utilities);
    const exps = utilities.map(u => Math.exp(u - max));
    const total = exps.reduce((a, b) => a + b, 0);
    const p = exps.map(e => e / total);

    logLikelihood += utilities[race.winnerIndex] - (max + Math.log(total));

    const mean = new Array(k).fill(0);
    for (let i = 0; i < race.covariates.length; i++)
      for (let j = 0; j < k; j++) mean[j] += p[i] * race.covariates[i][j];

    for (let j = 0; j < k; j++) gradient[j] += race.covariates[race.winnerIndex][j] - mean[j];

    for (let i = 0; i < race.covariates.length; i++)
      for (let a = 0; a < k; a++)
        for (let b = 0; b < k; b++)
          information[a][b] += p[i] * race.covariates[i][a] * race.covariates[i][b];
    // Subtracting the within-race mean outer product is what makes this a
    // CONDITIONAL likelihood. Without it the ten horses of a field count as ten
    // independent trials and every standard error comes out far too small.
    for (let a = 0; a < k; a++)
      for (let b = 0; b < k; b++) information[a][b] -= mean[a] * mean[b];
  }

  return { gradient, information, logLikelihood };
};

/**
 * Conditional (race-level) logit: P(i wins) = exp(b.xi) / sum_j exp(b.xj).
 *
 * Exactly one horse wins each race and the within-race probabilities are
 * dependent, so plain logistic regression would treat a ten-horse field as ten
 * independent trials and overstate significance badly. There is no intercept:
 * it is constant across horses within a race, cancels in the conditional
 * likelihood, and is not identified.
 */
export const conditionalLogit = (races: RaceObservation[], maxIterations = 100): LogitFit => {
  const k = races[0]?.covariates[0]?.length ?? 0;
  if (k === 0) throw new Error('No covariates to fit');

  let beta = new Array(k).fill(0);
  let iterations = 0;
  let converged = false;

  for (; iterations < maxIterations; iterations++) {
    const step = accumulate(races, beta, k);
    const delta = invert(step.information).map(row =>
      row.reduce((s, v, j) => s + v * step.gradient[j], 0)
    );
    beta = beta.map((b, j) => b + delta[j]);
    if (Math.max(...delta.map(Math.abs)) < 1e-10) { converged = true; iterations++; break; }
  }

  const final = accumulate(races, beta, k);
  const cov = invert(final.information);
  const standardErrors = cov.map((row, j) => Math.sqrt(row[j]));

  return {
    coefficients: beta,
    standardErrors,
    z: beta.map((b, j) => b / standardErrors[j]),
    logLikelihood: final.logLikelihood,
    iterations,
    converged,
  };
};

/**
 * Turn paired snapshots plus results into fittable races.
 *
 * Both snapshots are normalized across the race's surviving field before
 * differencing, so drift measures this horse moving relative to its rivals
 * rather than the whole book tightening toward post.
 */
export const buildRaceObservations = (
  pairs: Pair[],
  winnerStartNumbers: Map<string, number>
): { observations: RaceObservation[]; droppedRaces: number; droppedThinFields: number } => {
  const byRace = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const group = byRace.get(pair.raceId);
    if (group) group.push(pair);
    else byRace.set(pair.raceId, [pair]);
  }

  const observations: RaceObservation[] = [];
  let droppedRaces = 0;
  let droppedThinFields = 0;

  for (const [raceId, field] of byRace) {
    // Softmax over one alternative is probability 1 whatever beta is: the race
    // adds nothing to the fit while making the sample look bigger than it is.
    if (field.length < 2) { droppedThinFields++; continue; }

    const winner = winnerStartNumbers.get(raceId);
    const winnerIndex = field.findIndex(p => p.startNumber === winner);
    // Scoring a race whose winner was dropped would hand the win to whichever
    // horse happened to be listed first.
    if (winnerIndex < 0) { droppedRaces++; continue; }

    const early = impliedProbabilities(field.map(p => p.early.odds as number));
    const late = impliedProbabilities(field.map(p => p.late.odds as number));

    observations.push({
      covariates: field.map((_, i) => [Math.log(late[i]), Math.log(late[i] / early[i])]),
      winnerIndex,
    });
  }

  return { observations, droppedRaces, droppedThinFields };
};
