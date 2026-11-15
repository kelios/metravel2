## Context

Production `/travels/kuda-poekhat-v-belarusi-na-vykhodnye-4-marshruta`, desktop 1440 DPR1, guest: `.codex-temp/s35-media/before-layout.json` shows three loaded floated photos at 324px with naturalWidth 883. The API retains `p class=img-float-left/right`; the full renderer associates each with a 720px inline narrative, whose float is 45% (324px). Mobile390 DPR3 is healthy. The island resolver currently sees only src and cannot distinguish the slot.

## Goals / Non-Goals

Goals: one float slot policy in the imports-free body-slot module; parser-derived classes shared by island/full construction; no changes to wide/mobile delivery.
Non-goals: generated groups, media ladders or formats, new dependencies, content or backend edits.

## Decisions

- Extend the existing HTML token walk with optional parsed image ancestor classes. The context never controls executable content; existing sanitization remains authoritative.
- Add a narrow sizes constant using mobile100vw and desktop324px. Select it only for authored float ancestors in both source paths.
- Keep the complete responsive candidate ladder. Browsers choose the supported rung, preserving DPR and family caps.
- Reject global sizes=auto: it changes wide-photo choices and needs a different compatibility and viewport analysis. Reject importing the full grouping pipeline into the eager island: it duplicates work and threatens the 558KB ceiling.
- Generated grids are a known adjacent coverage boundary, not a confirmed issue or a claimed fix.

Affected paths: articleBodySlots, articleBodyImageUrls, htmlTransform, htmlTokens, inertHtml/DeferredImages and focused tests. API/data/auth unchanged. Native rendering does not consume browser sizes. SEO, accessibility, sanitization and analytics contracts remain unchanged.

## Risks / Trade-offs

The parsed parent context must not leak across closing siblings or void elements. Reuse the canonical void-tag set and cover nested/closing cases. The existing image-only-paragraph predicate is shared with the grouping utility. A bounded adjacent-token check records consecutive image paragraphs so their authored float class does not narrow a group created by the existing renderer; it does not import or duplicate the orientation/layout generator. The server and full renderer must agree even without a manifest. No new package or heavy eager import is allowed; root will verify the unchanged558KB cap in the release build. Rollback is the task-owned source diff; no migration or stored data changes.

## Validation

Focused tests cover left/right authored floats, nested ancestors, sibling full-width controls, mobile/no-ladder states and server/full equality through real source builders. Source review precedes runtime. After publication, root repeats desktop1440 and mobile390 DPR3 live probes, checks oversized>2x=0, full-width URLs unchanged, and bundle guard <=558KB. Android/iOS runtime omitted: their rendering branches are unchanged.
