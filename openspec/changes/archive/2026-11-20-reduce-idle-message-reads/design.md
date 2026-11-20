## Context

The conversation screen reads messages and the thread list independently. Numbered pages remain the API for older history. Backend task #3461 provides checkpoints scoped to the thread, reader and visibility rules.

## Decisions

- Bootstrap with a limit of 51 and display the first 50. The extra row indicates whether the next numbered page exists. Poll with the opaque cursor, merge changed messages by ID and apply removals. Follow every remaining change page while the screen is active.
- Recheck the cursor when loading a numbered page because a concurrent removal can shift the page boundary or invalidate the audience. Discard the cached conversation on an access denial or reset.
- Schedule the next poll after the previous read settles. Double quiet intervals to a maximum of 60 seconds for the conversation and 120 seconds for the list. Route focus and application foreground state govern polling. A send triggers a read immediately.
- Keep request ownership with the authenticated session and selected conversation. Support older deployments when a bootstrap returns HTTP 405. This compatibility path ends when the older server is retired.

## Trade-offs

A message arriving in a quiet conversation can wait up to one minute for a timer. Returning to the screen or sending a message triggers an immediate refresh. Explicit history reads can require an extra cursor request to reconcile concurrent changes.
