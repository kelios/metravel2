## Context

See proposal.md. Source facts: `TravelPeerBadgesSection.tsx:56` uses target travel; `PeerBadgeGiveButton.tsx:44` hides guests; `TravelDeferredAuthorSection.tsx:16–20,41–70` places this after author/share on mobile and omits inline author on wide desktop. `TravelDetailsDeferred.tsx:203–220` gates loading. The new insertion belongs after the description wrapper in `details/sections/TravelDetailsContentSection.tsx:159`, before video/other sections. Browser baseline is recorded before implementation; source alone does not prove the cause of low usage.

## Goals / Non-Goals

Implement the delta spec by composing existing grant, picker, auth navigation and exposure mechanisms. Preserve article-target awards, AuthorCard and #2697 locale/cache ownership. Backend, catalogue content and anti-abuse rules remain unchanged.

## Decisions

1. Add `sections/TravelPeerBadgePrompt.tsx` after the complete description wrapper, outside its content View, only when main text exists. Rejected: keeping the invitation in deferred author, which preserves delayed discovery and different desktop placement.
2. Use canonical owner resolver from `compactSideBar/helpers.ts`, positive author/travel IDs, ready auth and known authenticated user identity. Own/unknown/pending hides the prompt. Reuse `PeerBadgeGiveButton` with an additive click callback, target user, recipientId and existing `useUserAchievements` peerReceived; no travelId grant. Rejected: a second picker/open-state/mutation controller.
3. Guest uses existing Button and `buildLoginHref`/`getWebRedirectPath`; preserve current article pathname/query/hash and intent peer-badge through login/registration. No auto-grant or auto-open after returning.
4. Reuse `useTrackedImpression`, key `peer-badge-prompt:${travel.id}`, 50% visibility and no auth/locale suffix. No mount-based impression. Add exact events to growth analytics; only safe travel_id. Click uses the existing immediate send pattern before navigation/opening, rather than idle queue.
5. Distinguish loading, empty and error. Delay grant until current author awards are known; retry reads and display actual mutation errors/rollback. Correct the grant 400 fallback only after #2697 releases `api/achievementsRequests.ts`: production must throw; preserve explicitly supported dev/mock policy. No fake success accepted from a toast alone.
6. Source review found the same family defect in user and travel received reads: both set `skipAuth:true` although backend annotates `granted_by_me` from request.user (`achievements/views.py:754`, tests at `test_engine_api.py:1967,2016`). Add a small explicit request option to these two existing GETs: known authenticated viewer uses session credentials, guest keeps skipAuth. The option defaults to anonymous for direct callers. The hook captures this mode from the same viewer used in its query key; no ambient authenticated response may be stored under the guest key. authStore.ts:323–334 can report a ready guest when localStorage userId is missing even while an HttpOnly cookie remains live, so unconditional credentials include would be unsafe. Require viewer in keys: `achievementsUser(authorId, viewerId, locale)` and `achievementsTravelPeer(travelId, viewerId)`. Preserve entity prefixes for broad invalidation. Gate personalized hooks until authReady and authenticated identity is known; guest viewer is null. Optimism/rollback captures the initiating viewer key; settled invalidation covers every viewer/locale copy. Update existing achievements/gamification initial-data readers to the new signature. No extra GET, transport helper, catalogue viewer key or backend change. #2697 released these source paths after its pushed bc4f7e4; preserve its locale and private-owner behavior. Native transport's pre-existing 401 anonymous retry is outside this web change; do not change auth client policy or claim new native runtime evidence.

### Design evidence / geometry

Order: full article text → prompt → remaining sections → deferred author. RU heading: «Понравилась статья? Наградите автора значком»; action: «Наградить автора». Canonical soft Button, Feather award, theme surface/border/text, token spacing/radius, no new image. Width stays in the text column. At 390 px use vertical layout/fullWidth action; at 1440 px intrinsic action width left-aligned. Natural height and wrapping across RU/BE/UK/PL/EN, canonical touch target, keyboard and visible focus; existing BottomSheet close/safe-area behavior. This durable design is the reference for browser screenshots.

### Data/API

Existing public peer catalogue supplies user options. Existing author/travel received reads supply viewer-personalized peerReceived, retaining optional authentication rather than forcing anonymity. POST `/achievements/peer-badges/grant/` sends badge_slug and recipient_id, no travel_id for an author award. Existing optimistic mutation/rollback remains authoritative with viewer keys and broad prefix invalidation. Capture real POST plus authenticated subsequent GET state in acceptance.

Received user/travel responses use the existing flat wire projection `{badge_slug,name,image_url,image_media,count,granted_by_me}`. Normalize it to a truthful `PeerBadgeSummary` with endpoint target context; keep catalogue identity and optional visual metadata absent when the response omits them. The shared `BadgePresentation` renderer accepts the display projection, and received rows use the natural slug key. Legacy nested badge DTOs remain compatible. This avoids an extra catalogue request and prevents a successful grant from becoming a read error after reload.

## Risks / Trade-offs

- Wrong recipient or stale open picker across SPA navigation → canonical ID resolution, keyed child and A→B/session-loss tests.
- One earlier public author read → existing shared query cache; no guest read, no new hero/media work.
- False optimistic success on 400 → regression test and prod error propagation; retain API request ownership coordination.
- Invisible/offscreen impression → existing exposure hook, no mount effect; tests for rerender/key changes.
- Concurrent #2697/#2698 work and shared quality locks → explicit paths, source-owner handoff and no duplicate gate.

## Validation

Before code: local read-only guest/reader/owner baseline at 390/1440, actual API target and screenshots/console. Local backend owner #2657 confirmed HEAD=origin/master fc1f2b5 and released canonical host runserver; preserve its untracked OpenSpec, no reset/restart/migrate.

Code-level: eligibility/auth/IDs/recipient, login return query/hash, existing picker grant/revoke and error/retry, route/session changes, exposure/click event contracts, five-locale strings; guest/A/B+locale cache isolation, auth restore barrier, delayed viewer response/rollback and broad target invalidation; targeted peer tests, i18n, lint/typecheck and applicable guards. Independent review-auditor then code-review-gate; review has no runtime probes.

Testing after push/deploy: real production guest/reader/owner at 390/1440, five locales, light/dark and keyboard, screenshots/console/network. Prove login/registration return, user-target grant and persisted GET, both analytics events. Shared UI requires no native device gate unless platform-specific scope emerges. Hero/slider behavior is unchanged; use applicable travel regression checks, adding performance gates only if implementation changes their loading/runtime contract.

## Migration Plan

No migration/new dependency. Follow explicit-path commit/push, testing and normal production deploy. Rollback by reverting task-owned changes; do not delete server awards. Strictly validate this OpenSpec change; archive only after implementation and acceptance tasks pass.

### Initial browser evidence (22 October 2026)

Local baseline completed before source edits: guest, reader104 and owner104 at390/1440, six real article views, no pageerrors. Reader article746 and own745 contain actual main text; no description loading skeleton was accepted. Guest has no award action; reader sees existing deferred “Наградить статью”, own article has none. The requested author prompt is absent in all six. All API requests target localhost8000. Screenshots and structured network/role evidence are in ignored `.codex-temp/task-2678/baseline-evidence.json` and `baseline-*-description/peer.png`; no application behavior was mocked and no content was changed. This demonstrates discovery/placement, not the cause of usage metrics.
