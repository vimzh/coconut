// Nonproportional second derivatives exclude affine output changes and affine domain normalization/reflection.
import { Arithmetic, type Rational } from "../math/rational";
import type { Enclosure, NumericalCertificate } from "../numerics/types";

export function provedDifferentCurvatureCore(left: NumericalCertificate, right: NumericalCertificate): boolean {
  const arithmetic = new Arithmetic();
  const q = (value: string): Rational => { const [n, d = "1"] = value.split("/"); return arithmetic.fraction(BigInt(n), BigInt(d)); };
  const interval = (value: Enclosure): readonly [Rational, Rational] => [q(value.min), q(value.max)];
  const a = left.probes.map((point) => interval(point.second)), b = right.probes.map((point) => interval(point.second));
  if (a.length !== 9 || b.length !== 9) return false;
  function product(x: readonly [Rational, Rational], y: readonly [Rational, Rational]): readonly [Rational, Rational] {
    const values = x.flatMap((a) => y.map((b) => arithmetic.multiply(a, b))).sort((a, b) => arithmetic.compare(a, b));
    return [values[0], values[3]];
  }
  function nonproportional(reflected: boolean): boolean {
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
      const p = product(a[i], b[reflected ? 8 - j : j]), r = product(a[j], b[reflected ? 8 - i : i]);
      const minimum = arithmetic.subtract(p[0], r[1]), maximum = arithmetic.subtract(p[1], r[0]);
      if (minimum.numerator > 0n || maximum.numerator < 0n) return true;
    }
    return false;
  }
  // Each replayed certificate contains the nine points min+(max-min)*i/8 in order.
  // A curvature-preserving affine relation would make both second-derivative vectors proportional.
  return nonproportional(false) && nonproportional(true);
}
