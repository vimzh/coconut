# Module 05: Provider Access and Credentials

## Status

Independent

## Type

Feasibility

## Purpose

Prove that visitors can use their own credentials with each promised hosted service while keeping those credentials out of project records and public views. This module owns the credential lifecycle and G-PROVIDERS, not model discovery or the complete inference layer.

## Finished Outcome

A verified connection and credential-handling capability for OpenAI, OpenRouter, and Hugging Face Inference Providers. Each service has an explicit Go or No-go verdict supported by real access evidence and credential-safety checks.

## Why It Comes Here

Provider access, permissions, and credential handling could invalidate the user journey independently of the mathematical engine. This module can start alongside 01 and must precede provider-backed discovery and execution.

## Prerequisites

None beyond [idea.md](../idea.md), [ROADMAP.md](../ROADMAP.md), and the current repository context.

## Build Readiness Gate

Inspect current provider documentation and the repository before writing a technical plan. Identify the credential required by each service and what evidence distinguishes a valid credential from permission to perform the required inference.

Live checks require controlled test credentials and an explicitly authorized budget. Never request secrets in documentation or capture them in a handoff. If credentials or permission are absent, implement and verify the locally testable parts, record the missing live evidence, and leave the affected gate unresolved.

## Scope

### Included

- Visitor-owned connection validation for all three promised services.
- Credential lifetime, redaction, disconnection, and interruption policy.
- Explicit access and permission errors.
- Minimal authorized inference evidence sufficient to establish service feasibility.
- Checks that credentials cannot leak through errors, records, public data, or logs.

### Not Included

- Model catalog search and capability assessment, owned by 06.
- The common individual-call interface and retry behavior, owned by 07.
- Trial scheduling, result publication, account features, and public interface construction.
- Shared owner-funded visitor execution or unrequested local model hosting.

## Detailed Work

### Establish each service's access requirements

Document the required credential, permissions, and account conditions from current official sources. For Hugging Face, prove supported execution through Inference Providers; discovering a repository is not proof it can be served.

Distinguish invalid credentials, insufficient permissions, missing model access, exhausted credit, and service failure where the service exposes those differences. A successful catalog request must not be reported as verified inference access.

### Resolve the credential lifecycle

Resolve D-06 before downstream consumers store or reuse a connection. Define when a credential enters use, how long it can be used, what disconnect means, and what happens after refresh, interruption, process restart, or cancellation. Any persistence must be an explicit decision with a justified protection and retention policy; an account system is not implied by this module.

Tell users what they are authorizing and which service is charged. A project-owned credential must never silently replace missing visitor credentials. Validation must not conceal a paid inference request or initiate an unbounded test.

### Prove credential boundaries

Cover credentials across entry, execution, errors, telemetry, records, and public results. Display safe connection information without exposing the credential itself. Exercise provider messages and rejected requests to check that upstream details do not reflect credentials into responses or logs.

Run evidence can retain provider identifiers and nonsecret diagnostic information. It must not contain authorization material. Define what downstream modules receive and what they are forbidden to persist.

### Record service-specific feasibility

For each promised service, perform a controlled permitted inference check after local validation passes. Record the service, model identity, date, operation, authorization/budget reference, nonsecret request outcome, and credential-safety evidence.

Mark a service Go only with both access and safety evidence. A No-go must identify the obstacle. Other independent work can continue, but a platform missing a promised service cannot pass final completion without an explicit product-scope change.

## User Experience

Visitors understand which credential to provide, whether their connection can perform the needed work, which account bears charges, and how to stop using the connection. Errors provide an actionable reason without exposing secrets.

## Decisions to Resolve

- **D-06**, owner 05: credential lifetime, validation, retention/redaction boundary, and interruption/re-entry behavior. Resolve before G-PROVIDERS and modules 06 through 09 use credentials.

## Technical Plan Required Before Coding

Write `docs/plans/05-provider-access-and-credentials.md`. Inspect the current repository and identify architecture, affected files, credential interfaces, dependencies, validation, failure handling, redaction checks, and live-test authorization. Include exact build, lint, type-check, test, and run commands. Do not preselect a storage or authentication mechanism in this product module.

## Deliverables

- Implemented and locally tested connection/credential capability.
- D-06 resolution and a nonsecret downstream handling contract.
- Per-service G-PROVIDERS evidence and verdicts.
- `docs/handoffs/05-provider-access-and-credentials.md` without credentials.

## Completion Criteria

- Each service's access status is reported truthfully.
- Credential handling follows the recorded lifecycle throughout success, failure, and interruption.
- No credential appears in saved outputs, errors returned to other visitors, logs, or handoffs.
- Live checks stay within their authorized scope and budget.
- Go verdicts have real service evidence; missing access remains explicitly unresolved.

## Validation

Use safe fixtures for malformed credentials, authorization rejection, permission denial, exhausted credit, and provider unavailability. Verify redaction with synthetic secret markers rather than logging real keys. Test separate visitor connections for accidental credential crossover. Exercise disconnection and interruption under D-06. Perform the controlled live checks separately and record their actual results.

## Implementation Handoff

Record the technical plan, implemented artifact paths, D-06, exact commands/results, tested environments, per-service evidence, and remaining limitations. Specify the nonsecret connection metadata, access states, credential-use boundary, and lifecycle obligations that 06, 07, 08, and 09 must follow.

## Dependencies and Handoff

Modules 06 and 07 receive the proven access path and lifecycle contract. Run execution and the user interface inherit the same restrictions. Later modules must revalidate changed permissions instead of assuming an earlier Go guarantees permanent access.

## Risks and Open Questions

Service support, permissions, and billing conditions can change. A visitor may revoke access or lose credit during a run. Interrupted execution may require re-entry of credentials under D-06. Those conditions must stay visible and must not cause substitution of another visitor's or the project owner's connection.
