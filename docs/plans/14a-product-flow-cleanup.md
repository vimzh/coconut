# 14a Product Flow Cleanup Plan

Implement the presentation cleanup in [Module 14a](../modules/14a-product-flow-cleanup.md). Preserve the existing three-step evaluation, audited scores, settings, reference evidence, publication policy and all task/historical JSON. No inference calls or new benchmark generation.

## Page order and disclosures

1. Home: current workload and actions (**View results**, then **Run this benchmark**) → audited result summary → one domain-sensitive mathematical example. Identify the summary's inspection limits and link to methodology.
2. Setup: recommended workload → selected workload preview. Put the six alternatives under **Advanced workloads**, keeping the selected workload visible when collapsed. Review shows model/provider, actual task/request counts, reasoning and charge consent; technical identifiers and secondary settings use disclosures.
3. Results: preserve primary pooled macro-F1; show accuracy with correct/included counts and completion. Separate wrong valid labels, unusable model responses, service failures and unfinished work. Keep task/answer inspection and reference disclosures reachable; diagnostics stay in their existing tab.
4. Use verified nonlinear stage metadata only for the exact current suite identity. Raw AST values remain **expression-tree depth**, including chart axes, filters and task inspection. Never infer stages from arbitrary depth.

## Files and ownership

- Home/current summary/methodology and directly affected README wording: existing page and marketing components/styles.
- Setup/review: existing evaluation workspace, suite and configuration components/styles; no controller or policy changes.
- Results: dashboard, task inspector, depth/diagnostic labels and result styles. A small browser helper reads the retained current stage metadata; focused tests reject stale identities and guessed stage conversions.
- Completion: this plan, module/roadmap status and `docs/handoffs/14a-product-flow-cleanup.md`.

Design direction: Coconut lets evaluators compare mathematical labels with certified references. Its character is calm and exact; its visual world is an instrument workbench. Keep the current dark home palette/serif headings and light evaluation surfaces. Curvature illustrations and measured charts carry the visual detail; exact intervals and reference labels are the signature. Reuse native disclosures, established controls and component interfaces; add no dependencies or new wizard.

## Verification

- `bun run --filter @coconut/web test`
- `bun run --filter @coconut/web lint`
- `bun run --filter @coconut/web typecheck`
- `bun run --filter @coconut/web build`
- Browser: desktop and mobile, primary anchors, one current home table, default/advanced suite selection and counts, keyboard disclosure/focus, charge consent, result filters, complete/partial/error evidence and reference access. Use retained data or explicitly intercepted synthetic responses; dispatch no provider requests.
- Compare historical JSON against the starting commit, inspect staged changes for credentials/generated artifacts, and retain root `AGENTS.md` exclusion.

Phase 15 will introduce its future suite through the existing suite catalog and frozen preview export after 14b's handoff; it remains outside this change.
