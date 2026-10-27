## Context

See proposal.md for scope. #2700 is the renderer dependency of metadata-only card #2658. The field exists in the public API, but `scripts/lib/travelDetail.js` drops it and both the former static SSG generator (removed in #2766) and the travel head viewmodel choose body descriptions. Captured raw inputs replay through the same detail normalizer. The existing `utils/seoText.js` CommonJS module is already shared by SSG and TypeScript consumers.

## Goals / Non-Goals

**Goals:** one deterministic plain-text explicit-meta policy; preservation through SSG capture/replay; matching selected head values during hydration; unchanged fallback output when no usable meta exists.

**Non-Goals:** no API writes, new endpoints, new head owner, article-specific allowlist, prose/title/URL changes, client translation, body fallback redesign, FAQ/client structured-data rewrite or analytics changes.

## Decisions

1. Add `getStoredTravelSeoDescription(unknown): string | null` in `utils/seoText.js` and its declaration. Reuse `htmlToPlainText` and neutral spacer cleanup, not `normalizeSeoLead`: removing route lines, greetings or epigraphs from explicit editorial text could change its meaning. Move the existing travel encoded-budget clamp and its truncation finisher into this shared module, preserving body-path semantics instead of duplicating a client implementation or importing quest locale resources.
2. Usable explicit metadata is normalized text of at least 80 characters after safe clipping. Maximum escaped attribute length is 160; prepared canonical values under that budget remain unchanged. Measure the existing `&`, double quote, `<`, `>` escaping cost, not UTF-8 bytes. Clip on Unicode boundaries, then use the existing word/truncation policy.
3. Retain the optional string/null field in the SSG normalizer. Pass authoritative detail metadata as a third optional argument to the existing `buildTravelSeoDescription(travel, body, meta)` wrapper. Do not resurrect list metadata over a cleared detail. Missing historical fields retain the fallback and strict capture equality/replay still use the one normalizer. The existing list/detail bootstrap merge also explicitly takes the detail metadata, including `undefined` for omitted/invalid normalized fields, so hydration cannot revive an older summary value after SSG chose the fallback.
4. The client viewmodel calls the same explicit-meta helper before its current body/title fallback. Undefined detail yields null description as before. No second head owner or loading deferral is introduced.
5. Update `Travel` with the optional field, travel documentation, the dated `SEO-SNIPPET-001` history, stale `seo-audit.js` comments, canonical `.claude/skills/metravel-seo-audit/SKILL.md` and the narrow stale paragraph in `.claude/agents/metravel-seo-expert.md`. Generate the `.agents/skills` copy through official sync after inspecting its plan. Role adapters delegate to the canonical file; unchanged frontmatter does not require copying the role body into them.
6. Preserve the static descriptions before application data arrives, including during HTML parsing. The existing `injectMeta` hoists only the three description tags before head scripts and marks their SSG provenance; existing charset and main-description postprocessors retain that provenance and charset first. The existing critical-head script in `app/+html.tsx` preserves nonblank marked values even when their text matches a generic-prefix heuristic, and applies its unchanged absent/generic policy to unmarked main/OG/Twitter descriptions. A blank marker never freezes an empty value. The prior generator placed descriptions after that script, so a guard alone could not prevent early generic duplicates. All six existing injection callers write concrete static or resolved content pages; generic dynamic fallback templates use the separate unmarked patcher. No new head owner, timer, observer or route whitelist is added, and title/canonical and unrelated metadata policies remain unchanged.

### Ownership / API and security

Source paths: `utils/seoText.{js,d.ts}`, `scripts/lib/travelDetail.js`, the former static SSG generator (removed in #2766), `components/travel/details/hooks/travelDetailsContainerViewModel.ts`, `types/types.ts`, `app/+html.tsx`; five existing focused test files cover utility, generator, capture, viewmodel and parser-time head behavior. No backend path is editable. Existing static attribute escaping, bootstrap serialization and DOM head setters remain the only output sinks. No token, URL navigation or media operation is added. SSG Article JSON-LD already consumes the selected description and naturally inherits it; body/FAQ owners remain otherwise unchanged.

### Other impacts

SEO: descriptions only; title/canonical/redirect/sitemap/robots unchanged. Accessibility: no controls, focus, headings or visible semantics change. Performance: pure shared text processing and three short provenance attributes, with no extra requests or media work and the existing loading lifecycle. Analytics: none. Localization: editorial text remains authored text, existing localized fallback owners unchanged, no new keys.

## Risks / Trade-offs

- Existing syntactically valid but stale metadata outside author 1 gains precedence → inspect a full published-cohort old/new metadata report before deployment; this does not permit editing other authors' content.
- Shared clamp extraction changes an old fallback boundary → preserve existing exported wrapper/truncation semantics and assert representative fallback output unchanged.
- Raw versus decoded attributes look different for `&` and quotes → compare decoded text with stored canonical text, or encoded text with its single-escaped expected value.
- Public API omits the field in a later environment → preserve fallback, diagnose the contract as a backend prerequisite rather than fabricating data.
- Google may choose different snippets → renderer acceptance proves submitted metadata only; #2658 owns the later CTR observation.

## Migration Plan

No data migration. Implement only after the shared checkout's tracked-write freeze is released; run code checks after its separate quality release. #2700 and #2658 use one current train and rollout:

1. After runtime/quality release, verify the existing metadata editor on an owned LOCAL fixture, with no new head-feature runtime QA. Before any real write, compare the complete payload with a fresh snapshot and reject invented defaults or non-meta changes.
2. Parent #2658 can stage meta-only values for its seven currently eligible author-1 articles, verifying independent after-GET projections and backup/rollback. If that existing editor needs source fixes, stop real writes and route/repair its separate mechanism before continuing. Four locked articles retain their exact future dates.
3. Independently review the complete source train plus metadata proposals/invariants, then use the authorized main push/testing transition and one canonical production deploy. #2700 is a parent acceptance/Done gate via `related_to`, not a hard dependency that blocks this existing-API implementation.
4. Only after testing/deploy verify real production raw/hydrated/SPA heads for both tickets. The first eligible parent article supplies a positive stored-meta sample; do not create a published orphan/SSG fixture to bypass that evidence. Later dated article updates have their own authorized refresh gate and the parent retains its 28-day measurement.

Roll back the explicit task-owned commit and redeploy the prior known SHA if the head contract regresses; stored content requires no migration rollback.

## Validation Matrix

| Surface | Evidence |
| --- | --- |
| Pure/shared code | Stored-vs-body precedence, invalid/short/null, markup/entities/spacers, exact canonical values, escaped budget and Unicode boundaries; existing fallback assertions |
| SSG/capture | Real normalizer → capture → offline replay → renderer; main/OG/Twitter escaped output, title/canonical/body unchanged |
| Client head | Viewmodel with normalized API detail, same explicit value as SSG, initial undefined data untouched, existing canonical assertions |
| Parser-time head | Real critical-head source getter and SSG generator, descriptions before script, charset first, one preserved description per owner before app load, unchanged generic route fallbacks; actual bootstrap serializer escapes raw metadata |
| Production desktop/mobile web | Reviewed SHA, direct raw HTML and hydrated/SPA descriptions once, valid and fallback samples, unchanged visible page with console/screenshots |
| Details directory regression | Both `yarn verify:slider` and `yarn verify:slider-perf` at the operation-gated testing stage against production |
| Editorial locales | Preserve the article's authored language; no i18n keys or locale-formatting changes |
| Android/iOS | No device-specific observable behavior/configuration, so no device gate |
| Instructions/specs | Official skill mirror check, changed-skill validator, `npm run audit:prompts`, strict change validation and final `openspec validate --all` |

The shared SSG/critical-head preservation repair affects multiple route families; in addition to the focused regressions, run full `npm run lint` and `npm run test:run` after the coordinated quality release.

New head-feature runtime/browser/API QA belongs to testing after code review. Parent-authorized existing-editor API diagnostics and meta-only implementation follow their separate local safety and exact invariant gates; they do not assert head QA. Root coordinates that content work, the whole-cohort effect capture and production acceptance; the renderer implementation role does not mutate content or claim those passes.
