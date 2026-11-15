## Context

Home quest covers switch from landscape snapshot URLs to square API URLs; bundled Tre Cime also gains ineffective resize parameters. Cold baseline shows 5 duplicate files on mobile and 6 on desktop. Source and response evidence are stored in `.codex-temp/s35-media/before.json`.

## Goals / Non-Goals

Goals: A healthy home load and five viewport scrolls request at most one effective URL per quest cover, Tre Cime file and visible travel cover.
Non-Goals: backend/schema changes, authored content, native redesign, new dependency, budget relaxation.

## Decisions

Keep preview structure but defer snapshot-only legacy media until the fresh API result; use existing square manifest. Treat exported /assets/ images as immutable files in the canonical image optimizer. No projection/API schema change.

Paths and ownership: hooks/useQuestsApi.ts, components/home/HomeQuestsPromoSection.tsx, components/quests/QuestForCityCard.tsx, utils/imageProxy.ts. Existing media primitives, query keys and session-aware transports are reused. API response fields and public route identities remain unchanged. All five locale strings remain unchanged. Rendering, heading, alt, keyboard, history, SEO and analytics contracts are preserved.

## Risks / Trade-offs

Do not infer nonexistent square derivatives or carry unfiltered media through the public snapshot. API failure may retain the existing legacy fallback after the failed fetch; cold healthy path remains single-source.
Rollback: revert the task commit and redeploy through the normal frontend operator. No data migration.

## Validation

Focused unit tests exercise real query/URL construction and state transitions; focused lint/typecheck and family guards precede independent source review. In testing, reuse before.json and repeat the same real guest URLs on mobile and desktop, including initial load and five viewport scrolls. Current native code is unchanged; no redundant native runtime for this train. Production build and bundle budgets remain unchanged. Record deploy SHA and live response/byte evidence.
