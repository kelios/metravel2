## Context

See `proposal.md` for motivation and `specs/search-catalog-render-state/spec.md` for the response contract. `fetchSearchCatalogLinks` catches failures on page 1 and returns `null`; later pages propagate their existing 503/404 errors. Both route `loader` and `generateMetadata` dynamically import this server loader and share request-signal memoization. `SearchCatalogLinks.web` imports only its payload type, so no runtime client import is needed.

The existing `expo-server.setResponseHeaders` transport, already used by `travelLinkGraphLoader`, queues updates inside Expo's request scope and applies them to the final `Response`. The Node SSR adapter uses that scope. No custom runner bridge is needed. Backend #3279's historical design defines consumption of the exact marker and hides it from public responses; backend/nginx remain read-only dependencies.

## Goals / Non-Goals

**Goals:** Emit the marker exactly where the loader chooses the incomplete first-page result; verify the real response-header transport with isolated requests.

**Non-Goals:** Change HTTP status, loader DTOs, query eligibility, route exports, browser imports, caching policy, gateway behavior or public UI.

## Decisions

- Reuse `setResponseHeaders` immediately before returning `null` from the page-1 failure branch in `components/listTravel/searchCatalogLinksLoader.ts`. This covers transport errors, HTTP failures and rejected payloads without adding another completeness model. Successful and skipped requests never call it. Reject HTML parsing, a process-global state flag and a new adapter: they duplicate the loader's decision and complicate request isolation.
- Extend `__tests__/components/listTravel/searchCatalogLinksLoader.test.ts` with producer assertions and add `__tests__/components/listTravel/searchCatalogLinksResponse.test.ts` using the actual Expo Node request scope and real `Response` headers. Only API responses are mocked; no sockets or app runtime are started. Check first-page failure/invalid JSON, success, later-page refusal, eligibility, memoization and interleaved/sequential isolation.
- Keep changes in the loader, those focused tests and this OpenSpec change. No source change to `scripts/serve-web-ssr.js`, locale bridges or client routes is required; existing entry/home bundle pins remain unchanged.

## Risks / Trade-offs

- [Request-header leakage] → Use the existing request-local transport and assert overlapping plus subsequent successful responses carry no marker.
- [Marker outside its intended branch] → Assert healthy, later-page, filtered and SSR-disabled cases independently.
- [Public header absence mistaken for producer proof] → Unit-test the actual loader-to-Response integration; production acceptance checks normal HTML and source identity because nginx hides the marker.
- [Backend contract drift] → Do not claim new backend behavior from historical files; delivery-owner production acceptance is limited to the requested normal `/search` contract.

## Migration Plan

No data migration. The delivery owner runs the mandatory independent review and code gate before normal publication. After publication, verify the deployed SHA and normal `GET /search`: no public marker and raw HTML contains `nav[data-search-catalog-links]`. Do not archive before that Done gate.

Rollback removes the failure-branch header emission and restores the prior behavior; all existing loader fallback/status semantics are unchanged.

Validation selection: server HTTP contract → focused loader/real-request-scope Jest plus scoped lint before review; normal production SSR probe after publication. No visible layout, locale, Android or iOS boundary changes justify additional viewport/device runs. Relevant source, Expo transport version, endpoint contract or runtime-flag changes invalidate the matching evidence.
