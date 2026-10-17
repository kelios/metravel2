## Context

See `proposal.md` for motivation and `specs/quest-locale-seo-routing/spec.md` for observable requirements. The owner accepted the #2208 routing and backend gateway contract on 2026-10-09; A/B implementation and the separately authorized E #2366 apply on 2026-10-11 follow it. #1332 retains site-wide/article SEO routing and the owner's 2026-08-08 decision to defer article translations. The accepted exception covers quest details in `docs/RULES.md` → Localization; coordinated production release and acceptance remain open.

Current mechanisms and reuse:

- `utils/questCityAlias.js:35` builds numeric-city detail paths; `questRouteVariants` preserves city alias copies. `app/(tabs)/quests/[city]/[questId].tsx:518` derives its canonical from the bundle's numeric city ID. Existing city landings use aliases, such as `/quests/krakow`.
- `scripts/generate-seo-pages.js` generates RU detail pages and runs `selectIndexableBuiltQuestPages`; `scripts/lib/questPageDepth.js` owns the ≥300 prose words / ≥30% own five-grams rule. `utils/questSeo.js` already accepts translation/format dependencies but its default resources are RU.
- `api/quests.ts`, `api/questContentLocale.ts`, `hooks/questBundleQuery.ts` and `queryKeys` already pass an explicit locale and isolate locale caches. The route currently follows global interface language. #2193 supplies `lang`, `content_locale`, `available_locales`, `source_locale` and canonical city names; missing language metadata means RU, never proof of a translation.
- `i18n/bootLocale.web.ts:35` resolves stored preference; `i18n/LocaleProvider.web.tsx` assumes RU SSG and commits preference after boot. Changing only `<html lang>` would retain the wrong boot/request mechanism. `app/+html.tsx` owns static shell/boot metadata; its exact path-dependent locale integration must cooperate with the existing boot gate.
- `InstantSEO`, quest head patching and quest structured-data helpers need one shared quest URL/eligibility model so hydration cannot restore RU canonical or stale alternates.
- `docs/features/quests.md:1090` is authoritative: **Django generates and serves production sitemap**. `scripts/generate-sitemap.js` is outside the release path and cannot satisfy this dependency. Production Nginx belongs to the backend; frontend `nginx/nginx.conf` is not an editable implementation path.

### Baseline, 2026-10-08

Live production sitemap classified with the existing parser: 232 quest details, 176 city landings, 408 combined quest-detail/city URLs, 842 total sitemap URLs. `/quests/scenario` is classified static, not a city. These counts measure discovery, not indexing or eligibility; existing RU sitemap includes some noindex details/countries, an established mismatch outside this contract's RU migration scope.

GSC `/quests/*`, inclusive 2026-09-08–2026-10-05: **78 clicks, 1,598 impressions, 219 URLs with search data**, CTR 4.8811%, average position 11.7747. Those 219 rows are not an indexed-page count. Sources: session evidence `.codex-temp/task-2208/baseline.json`, `sitemap-standard-count.json`, `sitemap-before.xml`.

Independent GSC URL Inspection completed at **2026-10-08T10:20:18Z**: all **408** live-sitemap quest detail/city URLs inspected, **295 indexed / 113 not indexed / 0 unchecked**. Details: **159 indexed / 73 not indexed** of 232. Cities: **136 indexed / 40 not indexed** of 176. Coverage categories: 295 indexed, 50 discovered, 62 unknown, 1 noindex. Method: existing `index-status --section quests` with a dedicated ignored checkpoint; after the first pass left 18 transient inspection failures, checkpoint resume reused 390 cached results and retried only the 18 remaining URLs. These transient GSC errors were not production HTTP defect evidence. Receipts: `.codex-temp/task-2208/index.json` and `index-checkpoint.jsonl`. URL Inspection reports Google's recorded status at inspection time, not a live indexing guarantee. No indexing submissions are part of this change.

Primary search guidance, read 2026-10-08: [Google localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions) supports reciprocal self-inclusive fully qualified alternatives. [Google multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) supports separate language URLs and explicit navigation. Our full-content eligibility and RU x-default policy are product decisions; language markup does not prove content language or guarantee indexing.

## Goals / Non-Goals

**Goals:** introduce one quest-specific route/eligibility contract reused by SSG, head generation, hydration, language links, served routing and production discovery; preserve all Russian canonical identities; make missing/withdrawn translations fail closed; make release and revocation behavior implementable across frontend and backend ownership.

**Non-Goals:** translation writing, creative titles/descriptions/stories, city/country/catalogue/scenario translations, article or site-wide routing, RU numeric-to-alias migration, offline storage or answer/progress redesign, auth changes, native routing, deep-link/store operations. Planning changes only this OpenSpec directory; app/backend/configuration edits are future work.

## Decisions

### D1. Quest-only language prefixes and stable identity

Use `/be|uk|pl|en/quests/{numericCityId}/{questSlug}`. RU stays `/quests/{numericCityId}/{questSlug}`. Slugs and city IDs do not translate. Normalize only known existing detail aliases to their established numeric-city canonical; preserve their reachability/response contract rather than inventing a new RU redirect migration. A known prefixed detail alias returns temporary HTTP 302 with no-store to that locale's numeric-city canonical only while the member is eligible; an ineligible alias returns the same 404/noindex as its canonical. This avoids four sets of duplicate static alias artifacts and cached redirects surviving withdrawal. Prefixed aliases never enter sitemap/alternates. Canonical prefixed requests must be HTTP 200 without redirect.

Proposed first-stage city boundary is RU-only. This is an explicit owner decision, not inferred permission to translate city boilerplate. A PL detail's city breadcrumb leads to the existing RU landing with its full city label; it does not claim a PL city page.

| Address and case | Response / language | Canonical | Hreflang and sitemap |
| --- | --- | --- | --- |
| `/quests/1/krakow-dragon`, eligible RU+PL | Existing RU detail / RU static | `https://metravel.by/quests/1/krakow-dragon` | Identical RU+PL+x-default cluster; existing RU sitemap policy retained |
| `/quests/krakow/krakow-dragon`, existing RU alias | Existing reachable alias / RU static | Same numeric-city RU canonical | Canonical cluster references numeric detail URLs, alias not a member |
| `/pl/quests/1/krakow-dragon`, eligible PL | 200 / PL | `https://metravel.by/pl/quests/1/krakow-dragon` | RU+PL+x-default; PL listed in Django sitemap |
| `/quests/1/krakow-dragon`, no eligible translations | Existing RU detail / RU static | Same numeric-city RU canonical | No translated alternates; existing RU sitemap behavior |
| `/pl/quests/1/krakow-dragon`, PL absent/withdrawn/thin | 404, noindex | No detail canonical claim | No alternate or sitemap membership; explicit RU link in error UI |
| `/quests/krakow`, city landing | Existing RU landing / RU static | `https://metravel.by/quests/krakow` | No locale alternatives; existing sitemap/depth policy |
| `/pl/quests/krakow`, prefixed city | 404, noindex | None | No sitemap or alternate membership |

Rejected: query-string language versions or locale-independent canonical for every translation. Those do not supply distinct self-canonical translated pages. Rejected: translating city slugs or replacing numeric RU canonicals, which would combine translation exposure with an unnecessary search migration.

### D2. One eligibility model, with explicit unavailable/error states

Candidate SSG reads published catalogue membership and each candidate bundle with exact `lang`. Eligibility requires available-locale membership **and** `content_locale === requestedLocale` **and** complete translated public fields under #2193's published-completeness contract **and** existing depth/uniqueness thresholds. The RU source must itself be indexable to form a translated cluster. Missing metadata is RU; availability flags alone cannot certify a PL page. Publication uses no user-specific progress/review fields. API fallback remains valid for existing gameplay but is ineligible as translated SEO content.

Evaluate uniqueness across sibling **detail pages in that locale**, using the existing algorithm and unchanged thresholds; do not compare PL prose to RU or silently lower a sparse locale's threshold. Pin candidate source data by revision/content digest and reject changes during build. A confirmed missing/withdrawn translation or failed quality check produces no prefixed indexable artifact. A transport failure, partial fetch or unreadable required bundle aborts the candidate release; it cannot be interpreted as mass withdrawal.

Rejected: `available_locales` alone, client-translated UI or copied Russian HTML under a prefix. Rejected: treating fetch failure as an empty catalogue and publishing a smaller release.

### D3. Static locale and initial hydration agree

Introduce a **web-only quest route locale resolver**, shared by route adapters, static shell and boot provider. An allowlisted prefix is authoritative on the prefixed detail; it supplies initial i18n resources, format locale and explicit bundle query locale before any mount/fetch. The RU detail route is factored into reusable quest detail behavior rather than duplicated into four forks. A thin `[locale]/quests/[city]/[questId]` web adapter validates the locale and delegates; platform boundaries must prevent it from changing native route preference behavior.

The prefixed HTML carries a validated route locale and release identity and boots that same locale. Stored/system preference does not mutate or redirect the URL-bound page. Do not globally set `urlPrefix` for all routes: the contract is quest-specific. RU unprefixed SSG remains RU; its existing preference-driven hydrated interface and honest fallback gameplay remain valid. Leaving a prefixed page returns to normal saved-preference behavior; direct URL access does not overwrite the preference. Explicit language selection can persist the selected preference through the existing setter but navigates to the selected canonical instead of changing the current prefixed URL's content in place.

The slow-resource path leaves translated static public HTML readable and never mounts RU as an intermediate locale. Failure shows localized retry controls without claiming RU under PL. Offline saved content retains its existing actual-content-language notice; it never grants online SEO eligibility.

Rejected: a route effect that calls `setLocale` after mount; it would create wrong-locale requests, remounts and hydration mismatch. Rejected: a global site-wide language URL rewrite, which expands #1332 and native scope.

### D4. One head model and explicit available-version links

Reuse `buildQuestSeoMetadata` with locale-specific existing `questSeo` resources and formatting, and extend the shared model with canonical, effective alternate cluster and `inLanguage`. SSG, `InstantSEO`, DOM head patching and JSON-LD consume the same model. One canonical, one identical alternate set per eligible cluster, self included; RU `x-default`; lowercase language-only codes without invented regional targets. Omit cluster entirely for RU-only pages. Never point a translated canonical to RU.

Title, description, visible public body and breadcrumbs use declared API content and existing localized UI keys. Add app-owned labels/error/accessibility keys in all five locales; no creative copy changes are authorized by this task. JSON-LD IDs/URLs use page canonical; `inLanguage` matches the page, images preserve the existing social-preview URL normalization. Print/tracking parameters do not create alternates and print remains noindex.

Show real anchor links to the **effective served cluster**, with full language names, current-language semantics and keyboard/touch access. The shared language control delegates prefixed quest navigation to this model; unsupported choices must not convert the current prefix into fallback content. Unavailable languages are absent from available-version links; an error page exposes an explicit RU source link. Other section language controls keep their current behavior.

Rejected: head-only hreflang injection, which leaves hydration and links with independent identities. Rejected: a dropdown which changes only client state on a language-specific URL.

### D5. Immutable SSG package plus a live backend-owned serving resolver

**The existing gameplay/API publish and withdraw semantics remain immediate and unchanged.** A filesystem swap cannot be atomic with arbitrary database/editor updates, and an immutable manifest by itself cannot revoke previously cached HTML. This contract therefore requires a separately accepted `area=back` serving/revocation design before language exposure; frontend-only implementation cannot pass.

Candidate package contains HTML and a schema-versioned manifest with release ID, frontend SHA, generation time, API/source snapshot revision, stable quest identity, canonical path, locale, content digest/revision, locale completeness, depth verdict, HTML checksum and cluster members. It contains no tokens, answers beyond already public spoiler-safe material, identity data or private workflow fields. A public sanitized projection can expose release ID and effective version links; internal integrity data need not be public.

The candidate manifest is produced **after** HTML quality checks. Deployment stages a complete immutable package and verifies each listed path against exact existing file, language, checksum, canonical and clusters. A backend-owned activation reads the same physical serving root as the frontend release; configure that path explicitly from actual deployment topology. Django must not read a second stale copied manifest or fetch a mutable public URL. An atomic root-pointer swap changes package/HTML/manifest together and retains the old package for rollback. Existing frontend deploy hooks must stage and activate this package coherently; do not invent a parallel deploy channel or manually mutate tracked production files.

For actual serving define effective cluster `E(quest, requestSnapshot) = built-and-depth-eligible manifest members ∩ currently complete published translations whose live content revision matches the built member`, anchored to eligible RU. New live translations await a matching SSG package; withdrawn/changed translations leave E on the next eligibility read after the writer's database commit. If the RU source revision no longer matches, E has no translated members until rebuild; existing RU canonical/alias responses keep their released body, established status and depth verdict without translated alternates or version links. This is no new RU 404 policy. Existing quest deletion/unpublication behavior remains outside this translation contract.

The consistency boundary is one response: pin the active immutable package once, then read the relevant live publication revisions from the authoritative database in one consistent snapshot. Requests whose snapshot starts after a completed writer commit observe its change; in-flight requests may finish the preceding snapshot. Separate page/sitemap requests spanning a commit may therefore differ. No global atomic DB/filesystem/cache transition, distributed request barrier or new writer-success condition is promised. Immutable package retention covers in-flight readers across activation. Backend owns revision tracking for all relevant writers; no new public #2193 field is assumed. Before B/C implementation, agree a private read-only source-revision receipt usable by the builder and activation validator; ordinary `lang` responses alone do not provide this fence.

Proposed implementation: a quest-detail static gateway in Django pins the active package and reads the current published cluster as above. Packages hold immutable base HTML with explicit bounded replacement slots for alternate tags, visible version anchors and a sanitized bootstrap projection. Their checksum verifies stored bytes, not the final response after substitution. Quest prose, canonical, locale and assets are unchanged by projection; no generic HTML rewriting/SSR engine is required. For an eligible prefixed request the gateway renders all three slots from E, so no-JS links, head and initial client metadata agree; RU responses use the same projection while retaining their existing body/status rule. Production sitemap uses the same resolver against its own pinned snapshot. Non-quest routes and RU city/country landings keep their existing serving paths. Nginx must route this constrained path family through the gateway, keep asset serving unchanged, and forbid SPA shell fallback for absent prefixed pages. Missing/withdrawn/thin translated URLs return real noindex 404, not client-only error screens. Unsupported prefixes/landing paths likewise return 404.

Cache correctness is part of the dependency: new online detail/sitemap requests must reach the eligibility resolver; Nginx/CDN/full-response caches cannot serve stale representations or stale-while-revalidate/stale-on-error. Use revalidation-required or no-store headers as appropriate; immutable base bytes may be cached by hash. Conditional 304 is decided only after eligibility/status and the final representation validator, including package/body identity plus E, are checked. A revoked prefix returns 404 even with its old ETag; an eligible RU page whose E changed returns the updated head/anchors, not stale 304. On live-resolver failure, prefixes and language sitemap fail with retryable 503/noindex rather than stale 200, false absence or an empty replacement release; RU can retain its existing static body with translated slots empty. Cache invalidation is defense in depth, not the revocation mechanism.

Browser history/offline snapshots cannot be recalled. Hydration starts from the document's sanitized E/identity and exact URL locale. #2193 gameplay reads remain live, not frozen to an entire release: published same-language content can change after response generation. A fresh serving-projection revalidation controls updated SEO/version links; it never derives eligibility from `available_locales` or offline bundle data. A changed/withdrawn prefixed member produces a localized unavailable state with noindex and an explicit RU link, retaining its URL rather than displaying RU fallback; it does not restore stale alternates. This revalidation must be exposed as a separate anonymous serving projection, with schema agreed by A/C, not a change to the accepted #2193 API.

HTML hreflang is the chosen annotation method. Django sitemap adds canonical translated `<loc>` entries from E; it does not independently synthesize hreflang from database availability or implement a second XML-alternate algorithm. Existing RU listing policy is preserved; strict eligible-only parity applies to newly introduced prefixed URLs, with existing RU noindex sitemap mismatches reported separately. Robots.txt stays unchanged; noindex 404 must be crawlable rather than disallowed.

Alternative considered: writer hooks could synchronously rebuild/remove an affected cluster and invalidate caches on every translation mutation. This is cheaper for steady-state reads but has to cover every API/admin/import writer and cannot promise atomic DB/filesystem/cache effects; failure either changes gameplay writer semantics or leaves stale served HTML. The read-time gateway is proposed because it protects all writers while leaving their existing semantics intact. It adds backend work and request cost; owner must accept that dependency/topology before apply, or explicitly choose a revised contract and re-plan it.

Rejected: changing translation publication to wait for a frontend build, which would silently change #2193 writers/gameplay semantics. Rejected: independently publishing DB-driven sitemap first or serving static HTML directly while merely filtering sitemap, which leaves dead links/stale alternates. Rejected: assuming Nginx reads an arbitrary JSON manifest without a serving mechanism. No backend implementation is authorized here.

## Technical Design

Scope: planning only now; future quest detail SEO route/metadata/SSG/serving contract.

Existing code to reuse: route detail behavior, `questCityAlias`, `questSeo`, `questPageDepth`, quest structured-data helpers, exact-locale API/query keys, web locale boot, existing language control and `InstantSEO`.

Affected frontend paths/modules (future ownership, not current edits):

- `app/(tabs)/quests/[city]/[questId].tsx`, a web `[locale]/quests/[city]/[questId]` adapter and extracted shared quest detail route behavior;
- `app/+html.tsx`, `i18n/bootLocale.web.ts`, `i18n/LocaleProvider.web.tsx`, locale shell helpers and existing shared language control;
- `utils/questSeo.js`, `utils/questCityAlias.js`, quest structured-data/route helpers, `hooks/questBundleQuery.ts` and `hooks/useQuestsApi.ts` only where explicit route-locale input is needed;
- `scripts/generate-seo-pages.js`, `scripts/verify-static-quest-seo.js`, shared manifest/eligibility helpers and targeted tests; `scripts/deploy-prod.sh` only under its separately scoped activation handoff card;
- all-locale app-owned quest SEO/control resources, `docs/features/quests.md`, narrow localization rule exception and tests. Backend-owned gateway, live revisions, production sitemap and Nginx are separate dependencies, never editable frontend paths. `app.json`, `eas.json`, `entry.js`, `.github/workflows`, frontend Nginx, `public/robots.txt` and `public/sitemap.xml` are not implementation assumptions.

Data/API impact: reuse #2193 public reads; add a separately agreed release/serving manifest and internal live-revision/cache contract. No quest translation-write, answer/progress, review or auth API change. Publication gateway is anonymous, same-origin and excludes user-specific payloads.

UI impact: eligible-version links and unavailable-page navigation; no redesigned player, new editorial content or catalogue behavior.

Platform impact: desktop web and mobile web; native locale/provider contracts are regression controls only, no Android/iOS runtime change or device/store gate.

Localization impact: all current locales RU/BE/UK/PL/EN; published content from API, app-owned labels and SEO formatting from i18n. Translation quality coverage is incremental, #2202 is not a catalogue-wide release gate.

External-link impact: none; links are allowlisted internal routes. Existing external links continue through `utils/externalLinks.ts`.

Task Contract: #2208 remains planning/owner acceptance; future drafts and full contracts are in `implementation-cards.md` and must be created only after acceptance and Problem Memory refresh.

### D6. Bounded physical release storage on the existing host — 2026-10-16

Status: architecture refinement requested by the owner after the #2363 package
preparation exposed excessive storage. Compatible private D/E implementation
has passed independent source review; production activation is still pending.
The existing server capacity and backend reserve remain unchanged. Local
filesystem experiments and source checks are not production acceptance.

Scope: private E staging/transport/inventory and D retention accounting. Reuse
the full immutable export, single active pointer, CAS activation, reader locks,
checksums and existing overlay bounds. Platform impact: desktop web/mobile web
delivery; Android/iOS none. Localization impact: RU/BE/UK/PL/EN package members,
no new UI/editorial text. Public routes, manifest schema and serving API stay v1.

#### Observed mechanism and measurements

The normal SSG writer already atomically creates hardlinked `.html`/`index.html`
pairs (`scripts/generate-seo-pages.js:3585`, #2227). Normal legacy publication
preserves those links. E's `pack()` instead uses `dereference=True`
(`scripts/quest-seo-transport.py:90`); `unpack()` writes each regular archive
member into a new inode (`:101`). Thus E loses the existing storage guarantee.
Its inventory (`:207`) and backend `cleanup_releases()` additionally sum logical
per-path sizes rather than the physical union of retained files.

Measured 2026-10-16: production free space 3,400,380 KiB; active legacy frontend
598,492 KiB; nginx cache 318,172 KiB; database 537,792 KiB. Docker reported
3.443 GB of images, only 30 MB reclaimable and zero build cache. These are
individual measurements, not an exhaustive host-accounting sum.

Prepared RU export: 8,181 regular paths, 818,031,782 logical bytes, but only
498,952,687 bytes of distinct content. Exact metadata equality reduces the
immediately shareable subset: fresh publication times must not accidentally
extend or expire old chunk generations. A local streaming prototype using
canonical whole-second timestamps and equal bytes/size/mode/time allocated
594,825,216 bytes; independent `du -sk` returned 580,884 KiB. Whole seconds
match the existing overlay selector and HTTP Last-Modified granularity.
This is a local capacity experiment, not production acceptance.

The complete translated export also passed canonical preparation: 852,365,360
logical bytes, 483 members (RU 280, BE 50, UK 51, PL 52, EN 50), with equal
R1/R2 receipts. A second local experiment materialized RU baseline, this actual
translated export and a subsequent translated generation with newer HTML/current
chunk timestamps. Their physical union was 1,294,065,664 bytes; independent
`du -sk` returned 1,263,736 KiB. This leaves 316,547,072 bytes within the existing
1,610,612,736-byte managed budget before Linux-specific directory/index/temporary
allowances. The third generation models a later build, not a third independent
production export. These local results support feasibility, not host admission.
For this corpus, a conservative 4-KiB allowance for every file/directory entry
across all three roots (125,419,520 bytes), the largest temporary member rounded
to a block (2,998,272 bytes) and an 8-MiB private index give a local-model peak
of 1,430,872,064 bytes, still 179,740,672 bytes below the managed budget. Actual
Linux filesystem allocation and any interrupted state must replace this model
in the admission check; this is not a blanket promise for future catalogue growth.
The 1,610,612,736-byte backend build reserve remains separate and unchanged.
Do not compare these physical measurements with three logical payload sizes.
Translated preparation took 320 seconds versus the existing five-minute deploy
budget; its SEO-generation cost remains a release issue to address/measure,
not permission to increase the budget.

#### Proposed storage and publication contract

1. Keep complete independently readable release directories. Identical regular
   files may share an inode inside a candidate and with verified sealed retained
   releases. Require equal SHA-256, byte size, mode and canonical whole-second
   mtime. Sharing is limited to content regular files inside `dist`; reader locks,
   operation locks, identities, journals and private indexes are never shared.
   Files with newer publication times remain separate; retain the existing
   14-day/256-MiB overlay policy. Never chmod, touch or overwrite a shared inode.
2. Keep archive symlinks, hardlink entries, traversal and special files forbidden.
   Build a bounded private per-file index after all postprocessing, containing
   relative path, size, SHA-256, mode and canonical mtime. Match archive members
   against this index and verify incoming bytes before linking. Stream one
   bounded temporary member, then link/rename; post-extraction deduplication
   does not solve peak-space allocation. No private index enters public dist.
3. Before transfer, compute a private storage plan against the actual current
   release and sealed retained roots. Include index digest, expected current ID,
   existing physical union, incremental allocation, directory allowance, largest
   temporary member and free-space reserve. Bound a candidate index to 8 MiB and
   50,000 entries, aggregate retained-source lookup to 100,000 entries, and hash
   through bounded buffers rather than loading complete files/archives. Measure
   resident memory against the existing container limit before release.
   Stage rechecks the plan/CAS under the operation lock and pins reused sources
   until materialization completes. An index is advisory: securely re-open and
   verify source inode, bytes and metadata without symlink traversal before
   linking, then fsync the new entry and parents.
   A changed plan, unreadable source or hardlink failure refuses; there is no
   unbudgeted full-copy fallback.
4. Keep logical per-tree byte/path/count limits and checksum identity unchanged.
   Add explicit physical counters based on unique `(device,inode)` and allocated
   blocks. Do not silently redefine existing `total_bytes`/`remaining_bytes`:
   version the private storage handshake and document both measurements.
   Count every retained generation, protected reader, candidate, directory and
   temporary allocation. Include retained partials and orphan temporary files in
   the peak, not just this attempt's temporary member; an unresolved interrupted
   candidate blocks new attempts until hash-bound provenance permits recovery.
   Recheck actual free space while staging and stop before
   consuming the backend reserve.
5. Bound normal lifecycle to active, rollback and one candidate. Before staging,
   a separate explicit retention step may remove only verified unprotected
   managed generations; activation itself still does no cleanup. A reader-pinned
   extra root refuses a new candidate until it can be retained within budget.
   Unsealed/unknown candidates require provenance-based recovery, never a sweep.
   Removing links is not assumed to free their logical size: recalculate usage.
6. The first RU baseline is independently stored beside the unchanged whole
   legacy recovery backup. Never share inodes with mutable legacy, temporary or
   external trees. The measured compact baseline fits this initial stage without
   reducing the backend reserve. This design grants no deletion of that backup.

The implemented interruption path is explicit `abort-stage`, never automatic
garbage collection. It requires the saved index/plan hashes, locked current CAS,
an exclusive candidate reader lock, an unsealed/nonactive/nonrollback ID and a
verified indexed subset. The sole temporary member has a fixed private path
outside public dist. Unknown entries or incomplete provenance refuse removal.
An interruption before durable provenance still requires owner inspection.

Normal translated publication also verifies the live Nginx gateway before
retention or staging: its configuration digest must match canonical backend
source, and a bounded HEAD of a translated canonical path must show the gateway
cache policy. The path and RU-only mode are derived from the same validated
manifest bytes as the prepared identity. This prevents a legacy `try_files`
configuration from serving translated files directly while application exposure
is false. Initial translated activation and canonical Nginx replacement therefore
share one closed D maintenance window; recovery to old Nginx first restores the
RU root. Subsequent releases use the normal publisher and its gateway gate.

The final complete-export Linux experiment captured unchanged source hashes,
admitted a three-generation peak of 1,367,846,912 bytes and actually allocated
1,324,306,432 bytes; independent `du -s -B1` matched exactly. Retaining two
generations preserved their content. Process peak RSS was 181,616,640 bytes
under a 900-MiB/no-swap container with zero OOM events. Actual temporary
allocation was 2,998,272 bytes, matching the plan. Reader-pinned retention
refusal, interrupted-stage blocking, wrong-provenance refusal and exact abort
recovery passed. This does not prove production Gunicorn/transport combined
memory or actual host free space.

Focused source evidence: 34 Jest tests, 31 canonical backend Make tests,
scoped ESLint/Node/Python checks and independent complete source review pass.
Streaming gzip level1 preserves identical expanded tar bytes and reduced
compression from 29.806s to 9.927s on the full translated corpus; its archive
grew from 216,398,673 to 260,516,274 bytes. Fresh whole-build/deploy timing must
still satisfy the existing 300-second budget.

Affected implementation paths: E `scripts/quest-seo-transport.py`,
`scripts/quest-seo-operation.js` and focused transport tests; D storage accounting
in `quests/services/seo_activation.py` and focused backend tests; the shared
private interface/runbooks. Agree the precise private handshake before code.

Rejected: raising server capacity or borrowing backend reserve (owner constraint);
removing rollback/reader protection; only compressing the uploaded tar (it is
already 208,209,165 bytes but expands on disk); post-copy deduplication; blanket
`--link-dest` or linking from mutable legacy; a quest-only second active root
(breaks accepted full-export atomicity); a separate blob store and new GC.

Validation: exact current translated-package measurement; actual inode/allocated
block evidence and independent `du`; same bytes/time share while changed bytes
or publication times remain independent; traversal/link/partial archive rejection;
bounded memory and temporary allocation; stale plan/CAS and concurrent cleanup;
reader survival, unlinking one generation without changing another, interrupted
stage recovery and unchanged reserve; independent review and existing D/E gates;
then fresh production peak-space, activation/rollback and sitemap acceptance.
Prototype data alone cannot authorize conversion or close #2363/#2366.

Risk/rollback: accidental in-place mutation could corrupt several logical roots.
All writers must preserve replace-on-write, and no mutable source is reusable.
Old full-copy readers can still read regular hardlinked roots, but old byte-sum
gates can refuse publication; revert to fail-closed publication until the storage
plan is repaired, without deleting retained roots or lowering reserve.

## Risks / Trade-offs

- [Serving topology and live revocation are new backend dependencies] → owner accepts D5, backend owner confirms real serving root/cache chain before apply; no prefixed exposure until its gate passes. An API-unchanged gameplay contract does not mean zero backend work.
- [Build snapshot races with translation updates] → revision matching and candidate validation; mismatches reject activation, live resolver excludes stale member until rebuilt.
- [Gateway affects latency] → one batched cluster read per request, cache immutable body by hash, measure cold/warm TTFB against existing details before rollout; never cache eligibility indefinitely.
- [Locale-multiplied build time] → bounded existing request pacing, fetch only published candidates, no per-component duplicate reads; measure candidate count, duration/requests/bytes. Baseline is a production build acquired under operation lock in implementation; planning does not claim CWV/build measurements.
- [Hydration preference overrides URL] → pre-mount route locale and no saved-preference overwrite, verify direct load/refresh/SPA entry and failure recovery in all locales.
- [Five-gram threshold unsuitable for a language or sparse cohort] → record actual pass/fail metrics and keep existing threshold; a threshold change needs a distinct accepted quality contract, never an implicit lowering.
- [Previously published translation loses eligibility] → immediate effective exclusion/404 plus sibling head/sitemap/version-link update; original RU source remains explicit navigation.
- [SSG body leaks quiz answers] → reuse current quest spoiler-free public body and existing answer/title guards; manifest never stores private answer material.
- [Existing RU city/sitemap behavior drifts] → preserve numeric detail canonical, alias fixture and unprefixed catalogue/city/country/scenario regression tests.

Accessibility: real anchors with full names/current-language indication, one existing page H1, localized error/retry labels, visible focus and existing contrast/touch-target tokens. Preserve image alt and media geometry; language change navigates normally and restores existing route focus policy.

Performance: no new media URL variants; existing one-slot-one-URL/social preview and fixed geometry remain. Compare production before/after LCP, CLS and TTFB on the same RU control and translated representative pages; require no material RU regression (LCP/TTFB >10% under matched conditions requires diagnosis; CLS stays ≤0.1). Locale resources use existing split loading; no five-locale eager bundle. Slider-specific checks are inapplicable because travel slider/hero paths are untouched.

Security: locale allowlist, positive numeric city IDs, existing validated quest slug/identity mapping; canonical origin fixed to `https://metravel.by`. Reject traversal/unknown prefixes and never use raw path as an arbitrary disk filename or redirect target. Escape API text/attributes and preserve existing sanitization. Gateway anonymous content only, bounded lookup/body sizes; no credential-bearing manifest. Auth and WebView/deep-link changes are inapplicable.

Analytics: preserve quest ID/view/completion semantics and consent; prefixed paths are new page paths, not new quest IDs. Answer attempts keep actual step content locale. No event removals or user data in SEO artifacts; check one quest view per direct/SPA entry.

### D7. Bounded release work on the existing host

The first fresh storage-v2 RU preparation passed integrity but took320s against
the unchanged300s release budget. Its final stage took81s. A separate read-only
profile measured32.812s for preflight, immutable old-asset capture/download,
unpack and overlay. The server root and database were unchanged by this probe.

Capture the existing bounded Expo assets while cold Metro exports locally;
apply them only after the finished HTML writers. The private captured state
binds archive hash/size and the inspected base. Application rechecks that base
before merging. The build owns the capture process group, propagates failure,
cancels and waits on its own descendants on exit, and never publishes a partial
capture. Keep the normal build lock, cold Metro, request pacing and capacity
bounds. This is a private transient state, not a public v1 schema change.

For v1, run the complete live-catalog quest guard once, after all HTML writers
and overlay; the prior identical pre-postprocessing pass had no consumer other
than early failure. Legacy keeps its existing guard placement. Retain separate
R1/R2, finalizer preseal verification, independent postseal disk verification,
index/archive checks and backend validation/CAS. Process each hardlinked HTML
inode once while retaining every route and byte result. The charset guard reads
exactly its1024-byte prescan window. Neither quality floors nor guards are
disabled to reach the budget. Measure the next full preparation and publication;
source work and isolated I/O tests do not establish production timing.

### D8. Collect once and transfer only missing immutable content

The D7 translated preparation passed integrity but took309.693s against the
unchanged300s budget. Production serves the certified RU release; exposure is
false. The owned QA fixture was removed after the refusal.

Split SEO collection from rendering. A build-owned worker takes complete R1
before API content reads, then collects existing RU, exact-language, travel and
article inputs while cold Metro runs. Its bounded private atomically completed
input binds nonce, frontend SHA, API origin, mode and R1. Render without HTTP or
network pacing for in-memory data. Preserve quality, coverage, spoiler checks
and original R1/R2. Normal exit and trapped signals cancel and reap owned
descendants before env restoration or unlock. Uncatchable Bash death triggers
bounded owned-group cancellation without claiming env restoration or unlock
ordering. Media audits retain independent catalogues and mandatory anchors;
serialize network producers under the existing request cap.
The existing media tail is approximately75s. Reuse only captured successful raw
same-origin numeric travel-detail responses before SEO normalization; each
audit still reads its own catalogue, mandatory anchors and media URLs. Missing
IDs use original paced live requests. Captured hits incur no network pacing.
Reuse is confined to the same validated private build input, never a persistent
cache or a substitute for an audit's independent coverage.

A private transfer-v3 wrapper derives exact missing content keys from unchanged
storage-v2 accounting and verified sealed sources. Send one regular body per
missing key, reject missing/extra/duplicate/unsafe entries, and reconstruct the
full index through verified hardlinks. Recompute exact plan and CAS under the
existing lock before candidate creation. Keep v2 on-disk metadata/abort
provenance, public manifest v1, logical limits, physical peak equation, readers,
retention,1536MiB reserve and validation. Full prepared archive/index remain
integrity evidence. V2 remains supported.

Backend canonical Nginx denies HTTP aliases of active/candidate/retained roots,
owned legacy backup and private journals under /static/. Exact and ^~ siblings
precede the broad alias and use the existing blank404/noindex/no-store handler.
Do not edit the foreign old pin or stage translations before old ingress stops.
Only local plan/frame work may precede the closed window; stage revalidates it.

Rejected alternatives: larger limits, uncoordinated network prefetchers, and
optimizing temporary writes while uploading every byte. Risk: capture/source
races or insufficient reuse; fail closed and keep certified RU. Rollback uses
existing CAS. Require failure/lifecycle/byte-parity tests, independent review,
real Nginx compilation, fresh complete prepare/publication≤300s and initial
closed window≤180s. Estimates do not establish live timing.

## Migration Plan

E #2366 release implementation (owner authorized 2026-10-11): retain the normal
`scripts/deploy-prod.sh` entrypoint. Explicit `QUEST_SEO_MODE=ru-only|translations`
builds full v1 exports, keeping complete private R1/R2 receipts. Download old
assets under a release reader pin, apply the existing bounded overlay locally,
run the full RU verifier, then finalize; no write follows sealing. Stage a new
app-owned generation and use the backend command for validate/CAS activation and
rollback. Activation owns its lock; do not wrap it in another flock. Legacy
publication and recovery perform each critical mutation inside the same Python
process that owns the operation lock, recheck legacy directory identity, refuse
a managed pointer, and never perform initial conversion.
Persist private release state outside the disposable deployment worktree; after
an ambiguous failure inspect the actual pointer and retain all generations.
Initial legacy conversion, gateway release, retention budgets and exposure are
the separately owned D operational gate. E never edits backend/Nginx configuration.

1. Record owner acceptance of D1 city boundary and D5 backend handoff/topology; refresh Problem Memory, create linked implementation cards, then wait for explicit apply request. This planning session does not ship anything.
2. Backend owner establishes serving/revision/cache contract with prefix exposure disabled; frontend implements shared model/adapter/SSG package and read-only verifier. Independently review full diffs and satisfy static/unit/i18n checks.
3. Stage candidate matching an accepted source snapshot, verify exact static files and checksums, current eligibility, original RU canonicals and old aliases. Backend gateway/sitemap must point at the same staged serving root for preactivation checks. Never activate translated sitemap URLs ahead of gateway/pages.
4. Under existing operation locks and release operators, activate one immutable package and compatible gateway/routing; use actual current deployment root and normal deploy protocol. An explicit backend release is a separate backend owner operation. Frontend deployment remains its normal reviewed pipeline step.
5. In `testing`, probe production `.build-source.json`, release identity, canonical/status/language/alternates/sitemap parity, JS-disabled content and hydrated desktop/mobile behavior; then withdraw/re-publish a dedicated test translation under authorized test-content operations and observe fresh and conditional/cached responses. Use a fresh test quest rather than changing creative production copy.
6. Rollback swaps to the retained package; live withdrawal filtering stays enforced, so rollback cannot resurrect removed translations. If routing/gateway is rolled back, first remove all prefixed exposure/links/alternates/sitemap together and retain real prefixed 404 responses; RU canonicals remain untouched. A frontend-only revert is insufficient after backend activation.

## D9: Single-copy bounded private input capture

The first complete D8 translated preparation on17October2026 stopped before
publication:429travel details were fetched, but the private input payload exceeded
the unchanged128MiB bound. Whole preparation165.449s is a failed operation, not a
timing or package pass. The encoded size of individual sections was not recorded.
Both normalized `travelDetails` and full `rawTravelDetails` were serialized; the
same large body/media fields therefore occupied the capture twice.

Keep the legacy in-memory eight-key collection and all source coverage. Move the
three pure travel-detail normalization/extraction functions to one shared module.
Record raw numeric responses only after normalization accepts them; an accepted
callback executes outside network/fallback catches, so storage failure cannot
masquerade as a reason to try another endpoint.

Private capture envelope v2 keeps the same identity/R1/hash fields and eight
payload keys. Its `travelDetails` values are exact one-key descriptors: `raw_url`
references the matching canonical same-origin numeric response, or `inline`
contains the successful normalized fallback when no accepted numeric raw exists.
Encoding a reference requires equality with the shared normalizer's result;
mismatch refuses rather than duplicating inline data. Missing, extra, foreign,
queried, duplicate or mismatched-id references refuse before rendering. The full
travel list and every quest/article/locale input stay unchanged.

The capture reader validates v2 and the encoded payload hash, but returns the
encoded view. Only the generator materializes normalized details through the
same pure normalizer, with zero HTTP. Independent media processes consume raw
details directly and retain their own catalogues, anchors, probes and paced
fallback requests. Direct collection/rendering keeps its legacy normalized form.

Before full-payload serialization, emit numeric per-section UTF-8 byte counts,
payload/capture/limit bytes and raw-reference/inline counts, including exact JSON
framing. Do not log content. Keep the existing payload headroom,128MiB physical
capture ceiling, atomic0700/0600 publication, no-follow bounded reads, complete
R1/R2 and late/preseal/postseal guards. Generic compression/string tables,
partitioning, larger limits, dropped fields and render-time refetch are rejected.
Rollback leaves the certified RU root/exposure false; no failed captured-only
state can be activated. Fresh full-size/timing proof and the original D/E live
acceptance remain required.

### D10 — canonical gateway before online translation publication

The17October D9 full prepare passed213.918s at89,388,285capture bytes. The
combined initial window failed: stage/validate/activate consumed most of180s
before configuration/readiness; bounded recovery restored certified RU/old
Nginx after370.950s whole. This is failed operational evidence, not acceptance.
Measured stage allocated919,130,112B and peakRSS141,987,840B; capacity/reserve
were not the cause. A sealed retained translated candidate also requires the
canonical private aliases to be denied even while the RU pointer is restored.

Select a configuration-only window over the exact certified RU root/exposure
false: verify the clean source, known current/rollback pair, frozen private
OLD/NEXT models, app/infra and canonical compile, acquire the same EX lease,
then change only the Nginx config bind. Keep root bytes/pointer unchanged.
Require canonical hash, RU readiness, false-prefix404 and direct-private-path
404 before success. Full preflight stays outside ingress interruption; refuse
before stop without sufficient remaining budget. Recovery certifies the exact
RU/retained pair and starts canonical Nginx; an old broad alias cannot be
reopened while a translated package remains retained. Keep whole300s/closed180s
unchanged.

Next use normal online v3 publication with a fresh full build and owned canary;
no old-pin translated publisher or reuse of failed acceptance is permitted.
Reject increasing time/resource bounds or omitting integrity checks. Validate
the pure phase/recovery cases and independently review the frozen operator
before execution; remeasure normal whole publication and original live gates.

## Validation Plan

Planning: `openspec validate add-quest-locale-seo-routing --type change --strict`, `npm run audit:prompts`, evidence-backed baseline, independent architecture review. Owner acceptance is not inferred from green validators.

| Stage / surface | Cases and evidence |
| --- | --- |
| Before review, code-level | Shared route/eligibility fixtures RU/BE/UK/PL/EN; missing metadata, mismatch, partial publication, depth failure, fetch timeout, stale revision; identical self-inclusive clusters, alias preservation, unsupported prefix/landing and path traversal |
| Before review, SSG/head | Exact-locale public HTML/title/description/lang/JSON-LD, single canonical, cluster parity and no spoiler exposure; immutable manifest/checksum validation, source update during build rejects activation; existing static quest verifier extended |
| Before review, boot/i18n | `npm run test:i18n`; targeted boot/route tests with stored/system conflicts, slow/failed locale resources and one query locale; preserve non-quest preference lifecycle |
| Review | Mandatory `metravel-code-reviewer` independent review-and-fix, appropriate code-review gate; static/unit/guards only, no browser/API runtime |
| Testing, backend source/config/API | Backend-owner tests gateway eligibility against active manifest/live DB, sitemap parity, 404/noindex and aliases, cache/304 safety, concurrent activation/withdrawal and unchanged #2193 reads |
| Testing, production no-JS | GET every published prefixed URL; 200/exact language/self-canonical/reciprocal cluster; sitemap prefixed set equals effective set; missing/withdrawn routes real 404, no shell; RU numeric canonicals/city aliases/country/catalogue/scenario/travel unchanged |
| Testing, desktop web | RU plus each actually published BE/UK/PL/EN version; direct load, refresh, SPA entry/exit, conflicting stored preference, explicit version links, keyboard/focus, slow/failing/offline cases; screenshots, console, network, before/after metadata |
| Testing, mobile web | Same route/locale/state matrix at narrow width; touch targets, version links, no wrong-locale flash, one quest-view event, screenshots and console |
| Testing, release/cache recovery | Matched release ID across serving root/sitemap/HTML; withdrawal/re-publish controlled test and warm/conditional responses; rollback does not resurrect withdrawn version; measured build/request/TTFB/CWV evidence |
| Native boundaries | Targeted static/unit checks prove no Android/iOS preference/provider/deep-link change; device/store gates are inapplicable |

GSC follow-up compares the same 28-day `/quests/*` segment, separating original RU paths and new prefixes (which require an added prefix filter). A monitoring observation window is not a prerequisite for functional release acceptance and indexing growth is not guaranteed. URL Inspection follow-up samples actual new canonicals with inspection timestamps, not search-analytics rows.

## Owner Decisions Before Apply

The proposed default is D1 (quest-only language prefixes, RU numeric canonicals, RU-only city landings) and D5 (backend-owned live static gateway/eligibility plus shared immutable SSG package). Both materially change the contract and require owner acceptance. Backend owner must confirm topology/cache feasibility before implementation cards are runnable. Accepted #2193/#2201 remove translation-source blockers but do not authorize backend topology work or applying this change. No other unresolved choice is silently delegated to implementation.

**Owner decision, 2026-10-09:** D1 (quest-only language prefixes, unchanged RU numeric canonicals, RU-only city landings) and D5 (backend-owned live static gateway/eligibility plus shared immutable SSG package) are accepted as proposed. Backend topology/cache feasibility (task 1.2) remains the first step of card C (#2362); source work on A–E still needs its own apply request.
