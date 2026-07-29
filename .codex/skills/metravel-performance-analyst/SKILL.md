---
name: metravel-performance-analyst
description: Analyze metravel performance using production builds or real URLs, compare Lighthouse and bundle baselines, validate perf budgets, and protect the travel hero slider/performance contract. Use for Lighthouse, bundle or LCP/TBT analysis and whenever travel-details hero, slider, image priority, lazy loading, overlays, or content-visibility changes could regress swipe behavior or performance.
---

# Metravel Performance Analyst

Read `AGENTS.md`, `docs/RULES.md`, `docs/TESTING.md`, `docs/RELEASE.md`, and `docs/CODEX.md` before doing performance analysis. For travel-page work, also read `docs/TRAVEL_PERFORMANCE_REFACTOR.md`.

## Core rules

- Never use Expo dev-server request counts or dev bundles as production truth.
- Run Lighthouse only against `npm run build:web:prod` output or the real production URL.
- Keep analysis aligned with repo budgets and canonical commands.
- Do not suggest service-worker caching, forced reloads, or user-facing cache-clearing workarounds.
- Treat travel hero swipe and travel-details performance as one bilateral contract: a change that touches either side is not complete until both sides pass.

## Production evidence contract

- For a production regression, measure the live URL before the fix and repeat the
  identical probe only after the changed build is deployed. Record URL,
  viewport/browser/DPR, auth/cache state, cold or warm run, and timestamp.
- Report page-wide request/API cardinality, transfer bytes, response codes,
  duplicate media identities/URL variants, unsized same-origin media, rendered
  CSS size versus selected intrinsic/variant size, and what starts before versus
  after scroll. A single optimized image is not a page pass.
- Use the real construction path. Component tests that mock the media renderer,
  URL builder, transport, pagination helper, or cache primitive cannot prove the
  runtime contract they replace.
- Include a negative probe for unsupported transforms or former fail-open paths;
  a heavy original returned as `200` is a failure, not a fallback success.
- Distinguish `production build`, `preview with production data`, and `live
  production URL` explicitly. Only the last can close a production Done gate.
- If the change is not deployed, report `local fix ready; production verification
  pending` and keep the task in `review`/`testing`. Never infer production success
  from source code, tests, build logs, or deploy completion alone.

## What to analyze

- Lighthouse mobile and desktop scores
- LCP element and first-screen behavior
- Bootup, main-thread work, and unused JavaScript
- Bundle composition via build output or `npm run analyze:bundle`
- Existing perf-budget tests such as `npm run test:travel:performance` or `npm run e2e:perf-budget`

## Travel Slider Performance Gate

For changes in `components/travel/sliderParts/**`, `components/travel/details/**`, `ImageCardMedia`, hero overlays/decode gates, travel-details lazy loading, bundle priority, or responsive image layout:

1. Run the swipe guard through the shared quality-gate lock: `node scripts/run-with-quality-gate-lock.js verify:slider -- npm run verify:slider`, plus the targeted pointer-drag unit test when relevant.
2. Verify the real mobile-web slider with an actual pointer/touch drag on the rendered slide, including vertical-scroll and tap-vs-drag behavior.
3. Run the combined production-build budget through the shared lock: `node scripts/run-with-quality-gate-lock.js verify:slider-perf -- npm run verify:slider-perf`.
4. Do not add web hero `content-visibility`, offscreen/lazy slide skipping, interaction-gated mounting, or a pointer-blocking overlay without the existing bounded unmount contract.
5. Report both swipe evidence and performance numbers; one green side is not a pass.

## Repo command map

- `npm run build:web:prod`
- `npm run lighthouse:travel:mobile`
- `npm run lighthouse:travel:desktop`
- `npm run lighthouse:produrl:travel:mobile`
- `npm run lighthouse:produrl:travel:desktop`
- `npm run lighthouse:produrl:summary`
- `npm run analyze:bundle`
- `npm run verify:slider`
- `npm run verify:slider-perf`

## Output contract

Report:

- exact URL or build target
- viewport/browser/DPR, auth/cache state, and cold/warm state
- command(s) used
- before/after request, byte, response-code, and score/budget result
- key regression or improvement
- likely files or layers involved
- negative probe and adjacent consumer routes checked
- next validation step and board status (`in_progress | review | testing | done`)
