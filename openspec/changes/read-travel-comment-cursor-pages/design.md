## Context

See proposal.md. `api/comments.ts:53–85` assumes a single array; `getTravelComments` also catches child-thread errors and returns incomplete conversations. Backend #3273 supplies signed opaque tokens on ordinary lists only.

## Goals / Non-Goals

Goals: preserve array consumers while completing each ordinary lookup. Non-goals: changing tree/expand responses or introducing UI loading controls.

## Decisions

- One private reader handles both ordinary lookups, parses arrays/pages, and reconstructs URLs from the original query. Avoid following server URLs; tokens have no authority to change destination or filters.
- Only the initial request retains existing missing/auth empty-state behavior. Continuation failures propagate, including through the legacy BFS fallback. Catching them would display an incomplete discussion as complete.
- Track requested cursors and reject repeats. A silent fixed page cap would truncate legitimate long discussions, so it is rejected.
- Keep expanded-list calls unchanged: cursor plus expand is invalid by the backend contract.

## Risks / Trade-offs

- More requests for ordinary discussions above 50 comments → bounded server pages; preserve stable ordering supplied by the server.
- Old installed clients still use the array endpoint → the backend legacy ceiling remains disabled until compatibility evidence; native distribution is a separate gate.
- Backend not yet deployed → accept its unchanged array response to the new query.

## Migration Plan

Review and push #3383, publish web through the standard frontend deploy, and verify the deployed API contract. Backend #3273 can then enable its agreed ceiling. Rollback: restore the prior frontend SHA while the backend ceiling is disabled. No dependencies or persisted data change.

## Validation

Focused adapter behavior tests cover multiple pages, lookup isolation, legacy arrays, expanded reads, failed continuations and cycles. Run selective lint/type checks and independent review. After testing begins, use a two-page local integration fixture and bounded live API probes; one shared runtime layer suffices because rendering/native branches are unchanged.
