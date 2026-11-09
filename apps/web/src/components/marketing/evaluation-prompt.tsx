// Display the deep-study instructions verbatim without importing server evaluation code.
const instructions = "Classify the real-valued scalar function on exactly the supplied closed interval. All displayed decimal numbers are exact. Numeric literals using e or E are base-10 scientific notation: for example, 1e-05 means 1 times 10^(-5), not the mathematical constant e. Otherwise use ordinary mathematical notation, including the stated LaTeX expression. Choose \"convex\" for convex and not concave, \"concave\" for concave and not convex, or \"neither\" for neither property. Affine and constant functions are excluded. A composition rule that does not apply is inconclusive. Use any valid mathematical argument. Return one JSON object with exactly two string fields, \"label\" and \"explanation\", each appearing once. The label must be convex, concave, or neither in lowercase. Give a brief nonblank explanation of at most 4096 Unicode code points, and keep the complete response within 65536 UTF-16 code units. Include no markdown fences or additional text.";
const example = "f(x) = x^3\nDomain: x in [-1, 1].";

export function EvaluationPrompt() {
  return (
    <section aria-labelledby="prompt-title" className="border-t border-border py-12 sm:py-16">
      <h2 id="prompt-title" className="text-2xl font-medium sm:text-3xl">The prompt models receive</h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">These are the exact system instructions used in the deep function research study. Each question adds its own expression and interval. Reference answers and verification evidence are never included. The separate visitor workbench uses its own versioned prompt.</p>
      <h3 className="mt-6 text-sm font-medium">System instructions · verbatim</h3>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-5 font-mono text-xs leading-6">{instructions}</pre>
      <h3 className="mt-6 text-sm font-medium">User message · teaching example</h3>
      <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-5 font-mono text-xs leading-6">{example}</pre>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">This example illustrates the message format and is separate from the scored research tasks.</p>
    </section>
  );
}
