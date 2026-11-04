/**
 * Exact split of a total across weights (BR-11-22): share = floor(T x w / W); the leftover paise go one each to the
 * largest fractional parts, ties to the lower position. The shares always add up to the total. BigInt keeps it exact.
 */
export function splitShares(totalPaise: number, weights: number[]): number[] {
  const ZERO = BigInt(0);
  const W = weights.reduce((a, b) => a + BigInt(b), ZERO);
  if (W === ZERO) return weights.map(() => 0);
  const T = BigInt(totalPaise);
  const shares = weights.map(w => (T * BigInt(w)) / W);
  const fractions = weights.map((w, i) => ({ i, f: (T * BigInt(w)) % W }));
  let rest = Number(T - shares.reduce((a, b) => a + b, ZERO));
  fractions
    .filter(x => weights[x.i] > 0)
    .sort((a, b) => (a.f === b.f ? a.i - b.i : a.f > b.f ? -1 : 1))
    .forEach(x => {
      if (rest > 0) {
        shares[x.i] += BigInt(1);
        rest -= 1;
      }
    });
  return shares.map(Number);
}
