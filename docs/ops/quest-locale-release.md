# Quest locale release — E #2366 (retired in #2766)

From 17 to 27 October 2026 the production entrypoint published quest detail
pages in all five locales as a static v1 package: private R1/R2 revision
receipts, an owner-selected physical byte budget, immutable generations under
`static/quest-seo-releases/`, CAS activation of the `static/dist` pointer,
explicit retention (`keep_releases=2`), and owner-authorized
`baseline`/`recover`/`rollback`/`abort-stage` operations. That pipeline — the
static SSG generator, input capture, static verifiers, the v1 operation script
and its `ru-only`/`translations` release modes — was removed in #2766.

## Current model

Since 27 October 2026 the Expo Router server renders quest details (every
published and complete locale), city and country landings, `/`, `/quests` and
`/quests/scenario` per request (SSR loaders). The projection that feeds them is
`scripts/lib/questWebProjection.js`, packaged for the backend by
`scripts/package-quest-web-builder.js`.

- Deploy: `DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha>` →
  `build-prod.sh prod` → `scripts/web-ssr-publication.sh stage` →
  `publish-code` → live checks (`scripts/verify-live-web-ssr.js`,
  `scripts/verify-live-quest-ssr.js`) → `finalize-code`; a failed live check
  runs `rollback-code`, which restores the previous SSR pair, never a static
  build.
- `scripts/deploy-prod.sh` refuses a deploy when the backend capability lacks
  the quest SSR runtime (`scripts/lib/webOutput.js`), and `build-prod.sh`
  refuses `DEPLOY=1` without the SSR release.
- The build-only preview stays `DEPLOY=0 ./build-prod.sh prod`.

## What remains from the static era

- Emergency recovery `scripts/fix-prod.sh` and `scripts/fix-missing-chunk.sh`
  still mutate the static root only through the CAS legacy operations of
  `scripts/quest-seo-transport.py` (`scripts/quest-seo-legacy-operation.sh`).
- Retained v1 generations on the production disk and their manual cleanup are
  described in [prod-disk-growth.md](prod-disk-growth.md) → «Поколения
  v1-публикации».
- The full runbook of the retired release is in Git history of this file
  (before #2766).
