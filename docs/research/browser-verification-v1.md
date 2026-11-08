# Browser verification — evaluation journey

Date: 2026-11-08. Scope: local production web server on port 3200 with the
existing API on port 3201. This record distinguishes observed browser behavior
from fixture-only execution behavior.

## Production, read-only observations

- `/evaluate` rendered at 1280 × 800 and 390 × 844 without horizontal
  overflow. Its task, depth, trial, request-limit, output-cap, privacy, and
  charge-consent disclosures were visible.
- Selecting the exact-reference suite updated the displayed population to 75
  cases at depths 5, 10, 20, 40, and 80; the default challenge displayed 72
  cases at depths 3, 4, 5, 6, and 14.
- The initial keyboard focus target was the skip link. Keyboard interaction
  subsequently activated evaluation charge consent, Start evaluation, and
  Request cancellation in the isolated run exercise below.
- `/methodology` rendered at 390 × 844 without horizontal overflow, with one
  main landmark, a skip link, section links, and semantic tables. No browser
  console errors were observed on either page.
- A direct browser request from the page origin received valid 200 responses
  from the provider and model-policy endpoints. No browser provider credential
  or actual evaluation launch was sent to port 3201 during this verification.

## Isolated run exercise

The production UI was used unchanged. In one browser tab only, browser requests
under `/runs` were redirected from port 3201 to a disposable in-memory fixture
on port 3203. The fixture had three generated cases, three trials per case, a
dummy credential, and a fake inference client that waited for cancellation. It
did not use a provider key, write the normal run store, publish a result, or
make a paid request.

1. A dummy credential and model were entered through keyboard input. Evaluation
   charge consent enabled Start evaluation; the Start control became disabled
   once the run began, preventing a duplicate launch.
2. The running UI displayed 0 / 9 finished trials, 4 active trials, and a
   retained private-access section. Network evidence showed a run record request
   only to the fixture service.
3. Selecting Request cancellation produced a settled partial record: 4 / 9
   finished, 0 active, 5 unattempted, 4 cancelled, and no returned model
   outcomes. The dashboard showed unavailable score values, 0 / 9 included
   trials, visible task/trial evidence, and a disabled publication control.
4. Charge consent reset after launch. The retained record correctly warned that
   cancellation cannot determine already-started remote work or provider
   charges; this statement was not tested against a provider.

This validates the browser’s launch/cancellation/partial-report rendering and
state transitions against a controlled API contract. It is not evidence of live
model inference, billing, provider cancellation, or public-result behavior.

## Remaining gaps

- Reduced-motion behavior was not exercised with an operating-system or browser
  preference override.
- Public leaderboard and public result pages are covered separately.
- Live provider execution, billing, and cancellation were intentionally not
  exercised, because this verification used no visitor credential or paid call.
