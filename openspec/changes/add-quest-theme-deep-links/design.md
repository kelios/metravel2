## Context

See proposal.md and board #2403. `QuestsScreen.tsx:86` initializes All; `:162–178` asynchronously restores storage once. `:186–207` already centralizes selection and persistence, while `useQuestCatalogHandoff` applies profile selections on focus. `utils/questCatalogSelection.ts:134–138` emits a head script based only on saved selection. The dynamic `[city]/[questId]` route currently owns `/quests/theme/halloween`. No existing OpenSpec capability covers this query entry; `add-quest-locale-seo-routing` is separate locale packaging work.

## Goals / Non-Goals

Use the existing single selection state and persist URL choices through the existing path. Do not add a second theme state, duplicate the translated registry in light restoration consumers, or implement a theme SEO landing.

## Decisions

1. Resolve query presence separately from its validity: absent means normal restore, present invalid/empty/inactive means All. Normalize whitespace/case; repeated query values are ambiguous and select All. A leaf resolver accepts registry/date predicates or a compact registry-derived snapshot so `questCatalogSelection` does not gain an eager i18n import. `getQuestThemeById` and `isQuestThemeActive` remain authority.
2. Initialize explicit URL selection before storage reads. An initial restoration generation guard prevents late storage results from replacing URL or user selection. Handle subsequent changed URL inputs once per navigation/query transition, including native deep links and refocus; rerenders/data arrival must not continually reapply a theme after Reset. Keep profile handoff behavior and test ordering when a handoff and explicit link coexist; the new explicit navigation wins initial restore and stale pending handoff, while a later user profile navigation remains a new intentional action.
3. Add `app/(tabs)/quests/theme/[theme].tsx` with a fixed internal Redirect target `/quests` plus parameter, so it wins static-segment routing over `[city]/[questId]`. Unknown aliases still reach All. Reject an SEO landing alternative because it adds unrelated content/publication contracts.
4. Update the existing emitted head script to respect explicit query precedence. A query-present entry must not apply a saved-slice marker. Use the same compact validation contract, with local-date season behavior, to set the correct first-frame marker rather than importing the whole application/registry into the bootstrap. Do not hardcode a second season table. Alias pages may show a neutral redirect shell; they must not fetch quest detail.

## Risks / Trade-offs

- [Async restore/handoff overwrites URL] → generation/selection ownership guard and deferred-read tests.
- [Reset reapplies unchanged query] → track navigation application, not selected state, and assert Reset persists All.
- [Off-season URL versus saved choice] → validate the URL season; leave existing restore semantics unchanged.
- [Bootstrap bundle growth/duplicated calendar] → share a small serializable validation contract; retain leaf dependency boundaries.
- [Oct 11 acceptance cannot show Halloween naturally] → prove natural inactive fallback now; test active season with explicit fixed-date testing and use an exact Oct 15 temporal production recheck for unmodified date.

## Compatibility and Recovery

No storage migration, endpoint or auth change. Revert this task's route/resolver/selection/bootstrap diff together to restore prior catalog behavior. Never change app configuration or backend paths. Preserve existing locale prefixes/SEO package owners; this change only introduces the unprefixed alias entry already requested.

## Impact and Validation Matrix

| Surface | Evidence after review in testing |
| --- | --- |
| Desktop 1440 / mobile 390 web | Active valid query, unknown/empty/repeated query, out-of-season query, case normalization, saved choice conflict, Reset, alias, late storage/data; real catalog counts |
| Android emulator | Existing `metravel://quests?theme=...` deep link on cold/warm app, valid and invalid fallback, Reset; no store build authorization inferred |
| iPhone simulator | Same cold/warm deep-link contract; simulator is adequate for URL routing, no hardware capability asserted |
| RU/BE/UK/PL/EN web | Existing theme names and filter headers, no leaked translation keys; no i18n command required if resources unchanged |

Code-level: extend `questCatalogSelection.theme.test.ts`, `questCatalogRestoredSelection.test.ts`, add a focused screen restore/race suite and redirect route suite. Scoped lint, typecheck, routing governance and independent review precede runtime evidence. SEO preserves canonical catalog/metadata; no robots/sitemap edit. Accessibility preserves focus and selected/reset state. Security uses a fixed redirect destination and registry validation. Performance adds no data request; analytics unchanged.
