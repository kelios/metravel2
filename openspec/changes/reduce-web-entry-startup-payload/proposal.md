## Why

#3374 records 233,211 B Brotli in the always-loaded web entry and 481,252 B in the home document's initial script set on 2026-11-12. A fresh source map of clean `b8becc9ad` confirms that locale boot imports the quest URL facade including serving projection functions unused by home/article startup. Existing 0.1 KiB rounded budgets (and 5% named-chunk tolerance) cannot enforce the requested exact measured-byte ceilings.

## What Changes

- Produce a current source-map module/byte table with home/article startup ownership decisions; distinguish diagnostic map annotations from normal production bytes.
- Separate the confirmed parser leaf from shell path/script helpers and the route-owned serving facade; retain the public URL/locale contracts and unchanged first render.
- Add optional exact full-chunk and initial-route Brotli byte ceilings. Existing KB/default tolerance behavior remains compatible; exact ceilings have no tolerance and count loader metadata.
- Pin entry and home ceilings to the final normal production measurement, strictly below the recorded baseline, with a +1 B regression test.
- Use the existing fixed isolated production wrapper as the reference measurement contract. Preserve private build provenance and a whitelisted public client archive before cleanup, including failed budget checks; a custom local-root export is diagnostic only.

## Capabilities

### New Capabilities

- `web-startup-payload-budget`: measured initial JavaScript delivery, startup ownership evidence, and exact no-headroom byte ratchets.

### Modified Capabilities

None. Existing locale, URL, API and navigation behavior is preserved.

## Impact

- User-visible result: fewer initial scripts bytes on home/article without changing rendering or interactions.
- Platform impact: desktop web | mobile web. No Android/iOS platform configuration or lifecycle change; shared helper exports remain compatible.
- Localization impact: none. No copy, translation keys, grammar, locale preference or registry change; RU/BE/UK/PL/EN chunk sizes must not grow.
- Paths: `scripts/guard-bundle-budget.js`, its diagnostic report validator, `config/bundle-budget.json`, `__tests__/scripts`; URL helper modules, parser-only i18n/layout/breadcrumb/version-navigation imports and the standalone SSR helper copy list. Exact paths and map evidence are in design.md.
- Dependencies: bounded local production-export window coordinated with the active #3387 release; no backend API dependency.
- Fallback/mock policy: real production exports establish sizes; no mocked byte evidence or runtime fallback is introduced.
- API/data: unchanged. SEO: URL/canonical/metadata behavior unchanged. Accessibility: unchanged UI/focus/semantics. Security: parser validation unchanged; new optional budget values fail closed when invalid or missing from the build. Analytics: unchanged events. Performance: exact full entry and home-script Brotli reductions; normal build is authoritative.
- Non-goals: chunk merge plan, caching, screen content, dependency/framework rewrites, native/store releases, unrelated byte pins, protected files and neighboring optimizations.
- Reactivation evidence: the F3 canonical export remained below both original goals but exceeded the invalid local-root entry pin. The custom runner omitted the production HUBS default, and absolute path ordering changed module IDs/shared metadata. Keep application and Metro behavior unchanged; correct the measurement/provenance mechanism and calibrate exact caps from the actual canonical report.
- Open questions: none for implementation. The next ordinary canonical publication validates retained provenance and both byte gates; no redundant diagnostic export is required.
