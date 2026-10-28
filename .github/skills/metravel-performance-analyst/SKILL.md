---
name: metravel-performance-analyst
description: "Diagnose Metravel Core Web Vitals (INP/LCP/CLS), Lighthouse, bundle or media regressions on the reported metric and production target."
---

# Metravel Performance Analyst

`AGENTS.md` is inherited. Load only the performance/operation headings in
`docs/RULES.md`, `docs/TESTING.md`, or `docs/RELEASE.md`; for travel-page work
also read the relevant part of `docs/TRAVEL_PERFORMANCE_REFACTOR.md`.

## Core rules

- Never use Expo dev-server request counts or dev bundles as production truth.
- Run Lighthouse only against `npm run build:web:prod` output or the real production URL.
- Keep analysis aligned with repo budgets and canonical commands.
- Do not suggest service-worker caching, forced reloads, or user-facing cache-clearing workarounds.
- Treat travel hero swipe and travel-details performance as one bilateral contract: a change that touches either side is not complete until both sides pass.

## Diagnose the requested metric first

Follow `docs/RULES.md` → «Outcome-bound scope and effort». Record the reported
metric, threshold, device, URL/group, measurement window and collection date.
For Search Console distinguish per-URL data from origin fallback; a group count
does not mean each URL was independently slow.

For INP, capture the actual slow interaction or supplied field attribution:
input delay, handler work, presentation delay and responsible scripts/tasks.
TBT, Lighthouse score and style-read counts are supporting proxies, not INP.
An interaction below 200 ms on an emulated device does not reproduce a reported
field failure. Keep secondary inefficiencies labeled as such; do not present
an unrelated optimization as the cause or resolution of the reported metric.

Use one representative affected flow and a bounded causal hypothesis before
editing. After disproved hypotheses apply the canonical checkpoint. If field
attribution is missing, collect the smallest missing measurement instead of
expanding into all bundles, CSS, media, locales or libraries. No promise of a
green report follows merely from waiting for its 28-day collection window.

## Production evidence contract

- For a production regression, measure the live URL before the fix and repeat the
  identical probe only after the changed build is deployed. Record URL,
  viewport/browser/DPR, auth/cache state, cold or warm run, and timestamp.
- For request/media/payload changes, record page-wide counts, bytes/statuses,
  media identities/variants, sizing and before/after-scroll behavior. Do not run
  a full media inventory for an isolated interaction problem without evidence
  that media contributes to it. A single optimized image is not a page pass.
- Use the real construction path. Component tests that mock the media renderer,
  URL builder, transport, pagination helper, or cache primitive cannot prove the
  runtime contract they replace.
- For transform/fallback changes, include an unsupported-transform or former
  fail-open negative probe; a heavy original returned as `200` is not success.
- Distinguish `production build`, `preview with production data`, and `live
  production URL` explicitly. Only the last can close a production Done gate.
- Use existing deploy authority. If publication is blocked, name the separate
  blocker/owner and preserve its failing artifact; do not silently adopt a broad
  guard-repair project. Source/tests/build logs never establish live success.
  After deployment repeat the same primary probe; lab progress and field CWV
  validation remain separate, with an exact pending recheck when necessary.

## What to analyze

- Lighthouse mobile and desktop scores
- LCP element and first-screen behavior
- Bootup, main-thread work, and unused JavaScript
- Bundle composition via build output or `npm run guard:bundle-budget` (measures built chunks against config/bundle-budget.json)
- Existing perf-budget tests such as `npm run test:travel:performance` or `npm run e2e:perf-budget`

## Travel Slider Performance Gate

For changes in `components/travel/sliderParts/**`, `components/travel/details/**`, `ImageCardMedia`, hero overlays/decode gates, travel-details lazy loading, bundle priority, or responsive image layout:

1. Run the swipe guard with `npm run verify:slider` — the script already wraps
   itself in `scripts/run-with-quality-gate-lock.js`, so do not add a second
   wrapper. Add the targeted pointer-drag unit test when relevant.
2. Verify the real mobile-web slider with an actual pointer/touch drag on the rendered slide, including vertical-scroll and tap-vs-drag behavior.
3. Run the combined production-build budget with `npm run verify:slider-perf` — it
   carries the same built-in lock wrapper.
4. Do not add web hero `content-visibility`, offscreen/lazy slide skipping, interaction-gated mounting, or a pointer-blocking overlay without the existing bounded unmount contract.
5. Report both swipe evidence and performance numbers; one green side is not a pass.

## Repo command map

- `npm run build:web:prod`
- `npm run lighthouse:travel:mobile`
- `npm run lighthouse:travel:desktop`
- `npm run lighthouse:produrl:travel:mobile`
- `npm run lighthouse:produrl:travel:desktop`
- `npm run lighthouse:produrl:summary`
- `npm run guard:bundle-budget`
- `npm run verify:slider`
- `npm run verify:slider-perf`

## Output contract

Report:

- exact URL or build target
- viewport/browser/DPR, auth/cache state, and cold/warm state
- command(s) used
- before/after PRIMARY metric and its attribution; supporting counts/budgets
  only when relevant, explicitly separated from the requested outcome
- key regression or improvement
- likely files or layers involved
- negative probe and adjacent consumer routes checked
- next validation step and board status (`in_progress | review | testing | done`)
