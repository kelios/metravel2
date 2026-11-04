## Why

The public-profile button reads every subscription to answer one question. Social tabs also read every relation and request travel previews individually for each author. The deployed API from #3004 exposes bounded pages and single-author status.

## What Changes

- Read owner-scoped single-author status and refresh it after successful relationship changes.
- Render active social tabs with compact pages and server-supplied previews.
- Load a subscriber's exact reciprocal status on explicit disclosure.
- Keep the invitation picker on its existing subscriber directory.

## Capabilities

### New Capabilities

- `social-subscriptions`: bounded subscription reads, status and pagination.

### Modified Capabilities

None.

## Impact

Shared React Query and profile screens. Web acceptance at 390 and 1440 px, with equivalent shared app rendering. Backend prerequisite #3004.
