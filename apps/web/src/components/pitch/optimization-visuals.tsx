// Illustrative optimization structures, separate from evaluation tasks and results.
import styles from "./optimization-visuals.module.css";

const labels = {
  control: "Control loop: state determines an action, producing a next state that is compared with a target.",
  inverse: "Inverse problem: observed data enters an objective combining a fit term and a regularizer to produce an estimate.",
  allocation: "Resource allocation: one fixed total capacity is divided among three demands.",
} as const;

export function OptimizationVisual({ kind }: { kind: keyof typeof labels }) {
  return (
    <svg className={styles.visual} data-kind={kind} viewBox="0 0 320 132" role="img" aria-label={labels[kind]}>
      {kind === "control" && (
        <>
          <g className={styles.box}>
            <rect x="8" y="20" width="76" height="48" rx="8" />
            <rect x="122" y="20" width="76" height="48" rx="8" />
            <rect x="236" y="20" width="76" height="48" rx="8" />
          </g>
          <path className={styles.flow} pathLength="1" d="M84 44H122M198 44H236M274 68V100H46V68" />
          <path className={styles.arrow} d="m116 39 6 5-6 5m114-10 6 5-6 5M41 74l5-6 5 6" />
          <circle className={styles.target} cx="160" cy="100" r="7" />
          <circle cx="160" cy="100" r="2.5" fill="currentColor" />
          <g className={styles.text}>
            <text x="46" y="49">State</text><text x="160" y="49">Action</text><text x="274" y="40">Next</text><text x="274" y="58">state</text>
            <text x="160" y="126">Compare with target</text>
          </g>
        </>
      )}
      {kind === "inverse" && (
        <>
          <g className={styles.box}>
            <rect x="8" y="20" width="64" height="56" rx="8" />
            <rect x="96" y="20" width="116" height="56" rx="8" />
            <rect x="228" y="20" width="84" height="56" rx="8" />
          </g>
          <path className={styles.flow} pathLength="1" d="M72 48H96M212 48H228" />
          <path className={styles.arrow} d="m90 43 6 5-6 5m132-10 6 5-6 5" />
          <g className={styles.text}>
            <text x="40" y="53">Data</text><text x="154" y="43">Fit +</text><text x="154" y="63">regularizer</text><text x="270" y="53">Estimate</text>
            <text x="160" y="112">One combined objective</text>
          </g>
        </>
      )}
      {kind === "allocation" && (
        <>
          <g className={styles.allocated} fill="currentColor">
            <rect x="16" y="28" width="96" height="24" opacity="0.8" />
            <rect x="112" y="28" width="80" height="24" opacity="0.5" />
            <rect x="192" y="28" width="112" height="24" opacity="0.25" />
          </g>
          <rect className={styles.capacity} x="16" y="28" width="288" height="24" />
          <path className={styles.flow} pathLength="1" d="M64 52V82M152 52V82M248 52V82" />
          <path className={styles.arrow} d="m59 76 5 6 5-6m78 0 5 6 5-6m86 0 5 6 5-6" />
          <g className={styles.text}>
            <text x="160" y="16">Total capacity</text>
            <text x="64" y="106">Demand A</text><text x="152" y="106">Demand B</text><text x="248" y="106">Demand C</text>
          </g>
        </>
      )}
    </svg>
  );
}
