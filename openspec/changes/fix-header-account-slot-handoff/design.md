## Context

See `proposal.md` for the observed failure and scope. `CustomHeader.tsx:196–202` already owns the web account slot and renders the real More link before the deferred account section. On native, the parent delegates container ownership to that section. `CustomHeaderAccountSection.tsx:36` currently adds the flexible mobile container on both platforms. While its inner lazy component is suspended, the empty nested flex container consumes space beside More. The recorded 1024px run shows More moving 814px left with the outer header fixed at 110px high.

`customHeaderStyles.ts` supplies `rightSectionMobile` with `flex: 1` and end alignment; critical CSS already reserves the parent web account slot below 1280px and switches fallback visibility only when the real menu mounts. These established contracts do not need adjustment. The existing problem-memory family is `HEADER-HYDRATION-CLS-001`, with a separate historical breakpoint/height cause.

## Goals / Non-Goals

**Goals:** remove competing account-layout ownership during nested lazy loading, retain usable fallback navigation, and prove native container preservation.

**Non-Goals:** change responsive thresholds, preload auth/account code, adjust CSS or heights, weaken CLS checks, or address other reported shifts. No API/data, SEO, locale, security, or analytics contract changes.

## Decisions

1. On web, return the existing account content as a fragment; `CustomHeader` remains the single account-layout owner. On native compact headers, retain the existing `View` and its `rightSectionMobile` style because the parent supplies no equivalent container. Desktop content and its existing reserved-width Suspense fallback remain intact. Reuse the current `Platform` boundary rather than adding a layout abstraction.
2. Reject absolute positioning, hiding the fallback, or a width/threshold patch: those add another geometry rule or remove useful navigation while leaving competing ownership in place. Do not alter critical CSS.
3. Add a real RNW DOM regression in `__tests__/components/CustomHeaderAccountSection.dom.web.test.tsx`. Suspend the inner account component deterministically; render the existing parent slot shape and visible fallback. Before resolution, assert there is no additional empty flex child on web; after resolution, assert the real menu is directly in the slot. Include native Android/iOS controls that retain their container, plus a wide web fallback-width control. This structural unit proves the mechanism; actual pixels remain a browser gate.

Affected implementation: `components/layout/CustomHeaderAccountSection.tsx`; the new focused test. Planning artifacts live only in this change folder. Existing header models, styles, lazy adapters, and CSS remain dependencies, not edit targets.

## Risks / Trade-offs

- Removing a native wrapper would change alignment → retain it explicitly and test both native platform values.
- A test that eagerly resolves lazy imports misses the failure → explicitly suspend the inner module using a controlled promise and real RNW nodes.
- JSDOM does not calculate flex geometry → treat DOM ownership as causal regression evidence and retain the existing browser source/rectangle/CLS gate for pixels.
- The runtime menu may expose another shift after this repair → preserve all existing CLS and console assertions and report any distinct source separately.

## Validation and rollout

After the parent releases the exclusive quality window, run the new regression against current source to record semantic RED; apply the bounded platform condition and rerun GREEN with relevant account-slot/hydration tests through the repository quality wrapper. Run scoped lint/type validation and independent review before runtime. Keep C-owned source frozen and preserve all other task changes.

After review, reuse the existing header late-context CLS test at 1024px: zero header-source CLS, stable header height, real More/menu behavior. Retain 1280px and 1440px wide controls with their original budgets and assertions; inspect screenshots and console. Responsive compact ownership is shared with mobile web; the focused DOM test covers that branch without inventing native device requirements. No locale tests are needed because no text or formatting changes.

No data migration or dependency installation. Rollback is the single component condition and focused regression; no CSS, API, or auth rollback is necessary. Open questions: none affecting this design. Commit, publish, deploy, and task-board operations remain outside this child task.
