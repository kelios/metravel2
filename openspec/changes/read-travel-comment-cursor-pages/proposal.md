## Why

Backend task #3273 adds bounded cursor pages for travel comments. The shared adapter currently assumes one array and must consume every page before the backend can cap ordinary legacy lists.

## What Changes

- Read ordinary thread/travel lists with `pagination=cursor`, retaining the public `Promise<TravelComment[]>` contract.
- Follow opaque `next` tokens on the same endpoint and lookup; reject invalid/repeated continuations and propagate continuation failures.
- Accept an old backend's array response. Keep the existing bounded `expand=sub_threads` contract.

## Capabilities

### New Capabilities

- `travel-comment-cursor-reader`: complete shared comment reads across cursor pages.

### Modified Capabilities

None.

## Impact

Task-owned code: `api/comments.ts` and `__tests__/api/comments.test.ts`.
Platform impact: shared; one transport implementation for web, Android and iOS.
Localization impact: none; no user-facing copy changes.
User-visible result: long discussions remain complete when server responses are bounded.
API/data: backend #3273 supplies `{results: TravelComment[], next: string|null}`, 50 items per page; ordinary legacy arrays remain supported.
Security/performance: requests remain on the original endpoint; repeated cursors fail rather than loop or silently truncate.
SEO, accessibility and analytics: none; rendering and instrumentation are unchanged.
Non-goals: UI pagination, tree/expanded-list limits, place comments, mail delivery, native builds or store releases.
Dependencies: backend #3273 for live cursor acceptance; ship this compatible reader before enabling the legacy ceiling.
Fallback/mock policy: legacy arrays are accepted; focused tests may stub transport, and live API acceptance verifies integration after review/deploy.
