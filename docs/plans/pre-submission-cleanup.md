# Pre-submission cleanup

The user requests removal of confusing obsolete tests and unused code. The source ZIP already fits the 50 MB cap, so scope is reducing unused implementation and obsolete coverage without weakening current mathematical, scoring, credential or execution checks.

1. Trace retired landing-table components, their exclusive projection helpers/exporters and corresponding tests. Remove chains with no active route, library or supported CLI consumer. Preserve historical JSON and experiment evidence explicitly retained by the user. Verify remaining imports and current result projections.
2. Trace orphaned leaderboard components, the old decorative Noise component and unused badge. Remove only confirmed unused components and exclusively attached license material. Keep active publication/result services and their tests. Verify routes and frontend build.
3. Audit experiment-only historical tests separately from tests protecting active features. Do not remove coverage by age: all seven visitor suites, the current configurable CLI, inference/SDK credential isolation and scoring remain supported. Remove or reorganize only evidence-backed obsolete checks after the audit.
4. Correct current documentation commands or broken links caused by retirement, and record removed paths/remaining coverage in a handoff. Historical handoffs remain records of their original checkpoints. Run appropriate tests, lint, types and builds, inspect current UI, then commit explicit paths and regenerate/inspect the source ZIP under 50,000,000 bytes.

Workers have non-overlapping frontend cleanup ownership; root owns documentation, test-scope decisions, integrated verification, commits and archive creation. No live model calls, dependency changes, mathematical policy changes or deletion of private/raw experiment evidence are authorized or needed.
