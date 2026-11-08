// Illustrate the chord relationship for the three introductory functions.
import styles from "./pitch.module.css";

const sketches = {
  convex: { label: "A bowl-shaped convex curve with a straight chord above it", curve: "M20 14Q120 146 220 14", chord: "M60 56.24H180", axis: 80 },
  concave: { label: "A dome-shaped concave curve with a straight chord below it", curve: "M20 86Q120 -46 220 86", chord: "M60 43.76H180", axis: 20 },
  neither: { label: "An S-shaped cubic curve; a left chord is below the curve and a right chord is above it", curve: "M20 86C86.6667 14 153.3333 86 220 14", chord: "M20 86L120 50L220 14", axis: 50 },
} as const;

export function CurvatureSketch({ kind }: { kind: keyof typeof sketches }) {
  const { label, curve, chord, axis } = sketches[kind];
  return (
    <svg className={styles.curvatureSketch} viewBox="0 0 240 100" role="img" aria-label={label}>
      <path d={`M12 ${axis}H228 M120 6V94`} className={styles.axis} />
      <path d={chord} className={styles.chord} />
      <path d={curve} className={styles.curve} />
    </svg>
  );
}
