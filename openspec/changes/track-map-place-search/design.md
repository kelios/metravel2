## Context

The existing map data controller debounces input. Its query hook knows whether the current radius result belongs to the active request, and exposes the final result count used by the screen.

## Decisions

- Derive the outcome from the active radius query and compare the normalized input with the debounced term at the data controller. This avoids counting keystrokes, previous-query placeholders, or route-address searches.
- Keep the last reported term and radius only in a component ref for deduplication. Use the existing map analytics helper and consent-aware provider queue.
- Count distinct settled term and radius combinations in radius mode. A radius change measures a retry in a wider or narrower area.
- Success measures matches returned to the user. Opening a marker is a separate signal.

## Risks and rollback

Late responses and empty responses have different meanings. Regression tests hold a request pending across input changes and exercise success, zero and error. Removing the event and its observer rolls back the change without a migration.
