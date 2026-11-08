// Works through the retained mixed-branches case using its independent analytic curvature witnesses.
import deck from "./pitch.module.css";
import styles from "./function-case-slide.module.css";

const taskPrompt = `f(x) = ((log(((1)+exp(((2)*x))))+sqrt(((1)+(x^2))))+((-3/4)*(x^2)))
Domain: x in [-1, 1].`;

const referenceReply = '{"label":"neither","explanation":"The second derivative is positive at 0 and negative at 3/4, both inside [-1,1]."}';

export function FunctionCaseSlide() {
  return (
    <div className={styles.study}>
      <div className={`${deck.heading} ${styles.heading}`}><h2>A complete function test case.</h2></div>
      <div className={styles.equation} aria-label="f of x equals log of one plus e to the two x, plus the square root of one plus x squared, minus three quarters x squared">
        <span>f(x) = log(1 + e<sup>2x</sup>)</span><span>+ √(1 + x<sup>2</sup>)</span><span>− (3/4)x<sup>2</sup></span>
      </div>
      <p className={styles.domain}>Exact domain: x ∈ [−1, 1]. Natural logarithm and exponential; nonnegative square root.</p>
      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Model-visible task">
          <h3>1. The model-visible task</h3>
          <pre className={styles.prompt}>{taskPrompt}</pre>
          <p>Choose <strong>convex, concave, or neither</strong> over the entire interval. Return JSON with <code>label</code> and a brief mathematical <code>explanation</code>.</p>
          <p className={styles.validity}><strong>Domain check:</strong> 1 + e<sup>2x</sup> &gt; 1 and 1 + x<sup>2</sup> ≥ 1. Every operation is defined and smooth throughout the interval.</p>
        </section>
        <section className={`${styles.panel} ${styles.branches}`} aria-label="Function decomposition">
          <h3>2. Follow each branch</h3>
          <div className={styles.branch}>
            <p>u(x) = log(1 + e<sup>2x</sup>)</p>
            <p className={styles.math}>u″(x) = 4e<sup>2x</sup> / (1 + e<sup>2x</sup>)<sup>2</sup> &gt; 0</p>
          </div>
          <div className={styles.branch}>
            <p>v(x) = √(1 + x<sup>2</sup>)</p>
            <p className={styles.math}>v″(x) = (1 + x<sup>2</sup>)<sup>−3/2</sup> &gt; 0</p>
          </div>
          <div className={styles.branch}>
            <p>w(x) = −(3/4)x<sup>2</sup></p>
            <p className={styles.math}>w″(x) = −3/2</p>
          </div>
          <p className={styles.sum}>f″(x) = u″(x) + v″(x) + w″(x)</p>
          <p>Opposing component curvatures alone do not establish the sum’s classification.</p>
        </section>
        <section className={styles.panel} aria-label="Hidden reference proof">
          <h3>3. The hidden reference check</h3>
          <div className={styles.witness}>
            <h4>At x = 0</h4>
            <p className={styles.math}>f″(0) = 1 + 1 − 3/2 = 1/2 &gt; 0</p>
          </div>
          <div className={styles.witness}>
            <h4>At x = 3/4</h4>
            <p className={styles.math}>f″(3/4) &lt; 16/25 + 64/125 − 3/2<br />= −87/250 &lt; 0</p>
            <p className={styles.bound}>Here t = e<sup>3/2</sup> &gt; 67/16 &gt; 4 by Taylor terms n = 0,…,3. Since t/(1 + t)<sup>2</sup> decreases for t &gt; 1, the exponential term is &lt; 16/25.</p>
          </div>
          <p className={styles.verdict}><strong>Reference: neither.</strong> Both witnesses are strictly inside the interval. Their opposite signs rule out convexity and concavity on the full domain.</p>
        </section>
      </div>
      <div className={styles.reply}><p>A valid reference reply, withheld during evaluation</p><pre>{referenceReply}</pre></div>
      <p className={styles.note}>Worked example from the certified challenge suite. The prompt above shows the user message; shared system instructions also define the output rules. No measured model response or failure is shown.</p>
    </div>
  );
}
