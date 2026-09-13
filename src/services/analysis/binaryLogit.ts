/**
 * Logistic regression for yes/no outcomes, fitted by Newton-Raphson.
 *
 * Distinct from conditionalLogit in oddsDrift.ts, which models "which of these
 * horses won" within a race. This models "did this thing happen", one row at a
 * time - the right shape for questions like "does our top pick still win less
 * from a wide gate once the price is accounted for".
 *
 * Having the price as a covariate is the whole point. Bucketing a feature
 * against outcomes will happily show an eight-point trend that is nothing but
 * the market having already priced it; only controlling for the price
 * separates a real signal from a restatement of the odds.
 */
export interface LogitRow {
  /** Covariates, without the intercept - that is added here. */
  x: number[];
  /** 1 or 0. */
  y: number;
}

export interface BinaryLogitFit {
  /** Intercept first, then one per covariate. */
  coefficients: number[];
  standardErrors: number[];
  z: number[];
  iterations: number;
  converged: boolean;
}

/** Gauss-Jordan inverse, small k only. */
const invert = (m: number[][]): number[][] => {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) {
      throw new Error('Information matrix is singular - a covariate is constant or collinear');
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

export const binaryLogit = (rows: LogitRow[], maxIterations = 100): BinaryLogitFit => {
  const k = (rows[0]?.x.length ?? 0) + 1;
  if (k === 1) throw new Error('No covariates to fit');

  const design = rows.map(r => [1, ...r.x]);
  let beta = new Array(k).fill(0);
  let iterations = 0;
  let converged = false;

  const accumulate = (b: number[]) => {
    const gradient = new Array(k).fill(0);
    const information = Array.from({ length: k }, () => new Array(k).fill(0));
    rows.forEach((row, i) => {
      const xi = design[i];
      // Clamp before exponentiating: a separated covariate drives this to
      // +-Infinity and loses the whole fit to a NaN.
      const z = Math.max(-30, Math.min(30, xi.reduce((s, v, j) => s + v * b[j], 0)));
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p);
      for (let a = 0; a < k; a++) {
        gradient[a] += (row.y - p) * xi[a];
        for (let c = 0; c < k; c++) information[a][c] += w * xi[a] * xi[c];
      }
    });
    return { gradient, information };
  };

  for (; iterations < maxIterations; iterations++) {
    const { gradient, information } = accumulate(beta);
    const step = invert(information).map(r => r.reduce((s, v, j) => s + v * gradient[j], 0));
    beta = beta.map((b, j) => b + step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-10) { converged = true; iterations++; break; }
  }

  const cov = invert(accumulate(beta).information);
  const standardErrors = cov.map((row, j) => Math.sqrt(row[j]));
  return {
    coefficients: beta,
    standardErrors,
    z: beta.map((b, j) => b / standardErrors[j]),
    iterations,
    converged,
  };
};
