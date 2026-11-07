# Module 06: Model Discovery and Compatibility

## Status

Dependent

## Type

Foundation

## Purpose

Make model discovery useful without implying that every listed model can execute the benchmark. Users need truthful access, capability, and identity information before selecting a model.

## Finished Outcome

Users can search Hugging Face models and select executable models across OpenAI, OpenRouter, and Hugging Face Inference Providers using available evidence. Hugging Face execution is limited to supported hosted models. Missing information remains explicitly unknown; searchable OpenAI/OpenRouter catalogs are not a required additional feature.

## Why It Comes Here

Module 02 defines evaluation requirements; module 05 proves provider access and credential boundaries. This module compares those requirements with available models before module 07 executes requests. It can proceed alongside mathematical suite and scoring work after its prerequisites pass.

## Prerequisites

- Completed module 02 handoff and resolved D-02 and D-03.
- Completed module 05 handoff, resolved D-06, and G-PROVIDERS Go evidence for each promised service.

## Build Readiness Gate

Read both prerequisite handoffs. Confirm the supported evaluation methods, generation requirements, credential lifecycle, and tested provider access. Resolve D-07 before dependent implementation uses model identity or compatibility rules. An unproven service remains blocked; another service does not satisfy its gate.

## Scope

### Included

Hugging Face model search, supported model selection across the three services, catalog and execution distinctions, selection compatibility, provider/model identity, routing disclosures, and unavailable metadata behavior.

### Not Included

Credential collection and lifetime belong to 05; individual inference belongs to 07; run orchestration belongs to 08; user-facing interaction implementation belongs to 09. Downloading models or providing other execution services is outside scope.

## Detailed Work

### Discovery and executable availability

Define what a Hugging Face search result establishes. Distinguish catalog membership, visitor permission, hosted availability, and compatibility with the selected evaluation. A search match must never become an execution promise merely because its description suggests language generation. Identify supported Inference Providers execution separately. For OpenAI and OpenRouter, define model selection using the actual available access and identity evidence without requiring a new catalog-search experience.

Handle no matches, absent credentials, revoked permission, inaccessible models, unavailable providers, and incomplete catalog responses as distinct conditions. An unsuccessful lookup must not appear as a successful empty catalog. Preserve useful search evidence without retaining credentials.

### Compatibility and changing availability

Evaluate requirements from D-02 and D-03, including required answer behavior and generation settings. Mark a requirement supported, unsupported, or unverified according to available evidence. A model description alone does not prove compatibility. Specify what evidence permits selection and what additional validation is needed when compatibility is unknown.

Make incompatible configurations actionable: identify the conflicting requirement and require an explicit permitted change. Never silently discard a generation setting or substitute another model. Availability may change after selection; define when evidence needs renewal and how a newly blocked selection reaches module 07 without pretending the previous check guarantees execution.

### Identity and unavailable metadata

Distinguish the service the visitor connects, the requested model, and any serving provider or effective model identity actually reported. Resolve routing disclosure and selection rules under D-07. If the service cannot establish a detail, preserve that uncertainty instead of inferring an identity from a display name.

Specify the treatment of absent context limits, supported parameters, pricing, usage expectations, and access information. Unknown price is not zero cost. Preserve the provenance and freshness of evidence needed by inference, results, and leaderboard comparisons without promising metadata a provider does not supply.

## User Experience

Users can find models and understand why a result is runnable, blocked, or awaiting verification for their chosen evaluation. They can distinguish a discoverable Hugging Face model from a supported hosted execution choice.

## Decisions to Resolve

- **D-07**, owned by 06: discovery and compatibility evidence, requested/effective identity, routing rules, and unknown metadata presentation. Modules 07, 08, 09, and 10 wait for this resolution.

## Technical Plan Required Before Coding

Inspect the repository and create `docs/plans/06-model-discovery-and-compatibility.md`. Identify architecture, affected files, interfaces, dependencies, failure handling, tests, and exact build, lint, type-check, test, and run commands. This module does not select those details.

## Deliverables

Discovery and compatibility behavior, resolved D-07, representative search/selection evidence for every service, documented unknown states, and `docs/handoffs/06-model-discovery-and-compatibility.md`.

## Completion Criteria

- Hugging Face search works, and all three services support model selection under their documented access rules.
- Discovery, permission, availability, and compatibility remain distinguishable.
- Unsupported or unverified requirements cannot silently become supported.
- Selected identity and uncertainty reach downstream consumers without credentials.

## Validation

Check matching and empty searches, duplicate display names, unsupported Hugging Face execution, unavailable metadata, invalid credentials, permissions changing after discovery, interrupted searches, and provider failures. Verify explicit configuration changes preserve their intended meaning. Any live checks require the authorized budget from 05.

## Implementation Handoff

Record the technical plan, implemented artifact paths, D-07 resolution, exact commands/results, supported environments tested, limitations, and per-service evidence. Supply downstream owners the selection, compatibility, identity, and failure outcomes they must preserve.

## Dependencies and Handoff

Modules 07, 08, 09, and 10 consume the agreed evidence and identity rules. They must retain uncertainty, protect credentials, and reject implicit substitutions.

## Risks and Open Questions

Catalog claims and hosted availability can diverge. Routing and effective identity may remain partially unknown; D-07 must make the resulting comparison limits explicit.
