## Context

Article list/detail endpoints omit their trailing slash. The detail screen and breadcrumbs fetch the same article independently: production baseline has two 301 and two 200 responses for article 1. Source and response evidence are stored in `.codex-temp/s35-media/before.json`.

## Goals / Non-Goals

Goals: Opening the article catalog or an article produces zero article API redirects; a healthy numeric detail has exactly one detail request shared with breadcrumbs; first-party covers use their proxy URL.
Non-Goals: backend/schema changes, authored content, native redesign, new dependency, budget relaxation.

## Decisions

Use one shared React Query option factory for detail and breadcrumbs, preserving numeric/slug and offline fallback. Canonicalize all article endpoint slashes. Pass article cover media through the existing first-party image optimizer.

Paths and ownership: api/articles.ts, api/articleQueries.ts, hooks/useBreadcrumbModel.ts, app/(tabs)/article/[id].web.tsx, components/article/SafeHtml.tsx. Existing media primitives, query keys and session-aware transports are reused. API response fields and public route identities remain unchanged. All five locale strings remain unchanged. Rendering, heading, alt, keyboard, history, SEO and analytics contracts are preserved.

## Risks / Trade-offs

Preserve SEO, history, session filtering and offline reads. Reject a second ad-hoc cache because query keys already exist; API payload and public article routes do not change.
Rollback: revert the task commit and redeploy through the normal frontend operator. No data migration.

## Validation

Focused unit tests exercise real query/URL construction and state transitions; focused lint/typecheck and family guards precede independent source review. In testing, reuse before.json and repeat the same real guest URLs on mobile and desktop, including initial load and five viewport scrolls. Current native code is unchanged; no redundant native runtime for this train. Production build and bundle budgets remain unchanged. Record deploy SHA and live response/byte evidence.

Cache identity keeps legacy numeric-suffix slugs separate from numeric routes, because a slug fallback may return a different article. Both screen and breadcrumb use the same normalized route parameter.
