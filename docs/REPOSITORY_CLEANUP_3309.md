# Repository cleanup wave two — #3309

Decision audit for the 11 November 2026 inventory. Source references were
rechecked on 13 November 2026; an inventory finding alone does not prove that a
file is unused. Application rendering, API/data and localization contracts are
unchanged. The implementation is prepared in an isolated clone so the canonical
checkout's concurrent Metro work can be preserved during integration.

The task's OpenSpec change is
`openspec/changes/repository-cleanup-wave-two/`. Validation and acceptance are
recorded by the delivery owner after the complete task diff is ready.

## 2. Orphan Metro stubs

| Removed file | Evidence |
| --- | --- |
| `metro-stubs/Map.ios.js` | No resolver or import references. The active map renderers are `components/MapPage/Map.web.tsx`, `.ios.tsx` and `.android.tsx`. |
| `metro-stubs/MaterialCommunityIcons.js` | No resolver or import references. Its Feather substitution was unrelated to active icon resolution; the stale RULES example was corrected. |
| `metro-stubs/html2canvas.js` | No resolver or import references. Map snapshots use the real package, so its dependency remains. |
| `metro-stubs/react-native-webview.js` | No resolver or import references. Native article/map/quest adapters retain the real WebView package. |

Only these four orphan rows were removed from ADR 0003. Active stubs and
`metro.config.js` are unchanged. The canonical checkout's unrelated
`@expo/metro-config` numeric-ID patch row belongs to its existing session and
must survive the final hunk-level integration.

## 3. Obsolete root build script

Removed `build.sh` and its entry in
`scripts/guard-root-scratch-artifacts.js`. Tracked source, command and operational
documentation scans found no caller of that exact root script. Current npm web
builds use `scripts/build-web-safe.js` / `scripts/build-web-prod.js`; environment
build/deploy entry points remain `build-dev.sh` and `build-prod.sh`.

The removed script erased both dependency lockfiles and performed dev/prod
exports in one invocation. It was inspected as text and never executed for this
task. The root allowlist must lose its row together with the file: its governance
test checks both allowed tracked names and tracked allowed names.

## 6. Platform base files

The current tree contained 21 non-route base files with complete platform
siblings, plus one article route fallback. Nineteen non-route bases were removed;
two non-route bases and the route fallback remain for concrete consumers.

The audit covered explicit `.ts`/`.tsx` imports, `require` / `jest.requireActual`,
source-read test literals, normal imports and dynamic imports. TypeScript
`resolveModuleName` with the repository's `moduleSuffixes` selected `.web` for
every actual application consumer. The current Jest Expo/RN preset selects
`.ios` or `.native` for extensionless module paths. Every removed family retains
web and Android/iOS implementations, so normal application imports remain
extensionless.

| Removed base | Retained platform files | Representative consumer |
| --- | --- | --- |
| `components/MapPage/Map.tsx` | `.web.tsx`, `.ios.tsx`, `.android.tsx` | `components/MapPage/MapPanel.tsx` |
| `components/article/ArticleEditor.tsx` | `.web.tsx`, `.ios.tsx`, `.android.tsx` | `components/travel/ContentUpsertSection.tsx` |
| `components/auth/AppleSignInButton.tsx` | `.web.tsx`, `.native.tsx` | `components/auth/LoginForm.tsx` |
| `components/auth/FacebookAuthFlow.tsx` | `.web.tsx`, `.native.tsx` | `components/auth/LoginForm.tsx` |
| `components/auth/FacebookSignInButton.tsx` | `.web.tsx`, `.native.tsx` | `components/auth/FacebookAuthFlow.shared.tsx` |
| `components/auth/GoogleSignInButton.tsx` | `.web.tsx`, `.native.tsx` | `components/auth/LoginForm.tsx` |
| `components/settings/NotificationSettingsSection.tsx` | `.web.tsx`, `.native.tsx` | `components/screens/settings/SettingsScreen.tsx` |
| `components/travel/ImageGalleryComponent.tsx` | `.web.tsx`, `.ios.tsx`, `.android.tsx` | `components/travel/GallerySection.tsx` |
| `components/travel/details/sections/LazyYouTubeSection.tsx` | `.web.tsx`, `.native.tsx` | `components/travel/details/sections/YouTubeSectionSlot.web.tsx` |
| `components/travel/details/travelDetailsDeferredLoader.ts` | `.web.ts`, `.native.ts` | `components/travel/details/TravelDetailsPostLcpRuntime.tsx` |
| `hooks/usePushNotifications.ts` | `.web.ts`, `.native.ts` | `components/layout/NativeAppRuntime.native.tsx` |
| `services/book/bookPrintChrome.ts` | `.web.ts`, `.native.ts` | `services/book/BookHtmlExportService.ts` |
| `services/offline/offlineAssets.ts` | `.web.ts`, `.native.ts` | `services/offline/offlineCatalog.ts` |
| `services/pushRegistration.ts` | `.web.ts`, `.native.ts` | `stores/authStore.ts` |
| `services/questReturnReminder.ts` | `.web.ts`, `.native.ts` | `hooks/useQuestReturnVisit.ts` |
| `utils/printAvailability.ts` | `.web.ts`, `.native.ts` | `constants/platformNavRoutes.ts` |
| `utils/printHtml.ts` | `.web.ts`, `.native.ts` | `components/quests/QuestPrintable.tsx` |
| `utils/toast.ts` | `.web.ts`, `.native.ts` | `hooks/useActionFeedback.ts` |
| `utils/webImageUpload.ts` | `.web.ts`, `.native.ts` | `hooks/usePhotoUpload.ts` |

No removed base had a direct extension import, a live file-presence/text-read
assertion or a current Node worker consumer. The custom Node worker resolver is
different from Metro/Jest: `scripts/build-book-renderer.js` resolves base files
without platform suffixes. A read-only traversal of its type-erased runtime graph
visited 403 files with no unresolved local imports and reached only the retained
`htmlTree.ts` among these candidates.

| Retained base | Concrete reason |
| --- | --- |
| `services/offline/packageStore.ts` | `__tests__/services/offlineContentSnapshots.test.ts:26` and `__tests__/hooks/travelOfflineRouteOwnership.test.tsx:35` explicitly call `jest.requireActual('@/services/offline/packageStore.ts')`. They exercise real JSON persistence through AsyncStorage; native filesystem and web IndexedDB adapters do not replace this test seam. |
| `services/pdf-export/parsers/contentParser/htmlTree.ts` | `ContentParser.ts:37` is reached by the Node worker's base-only resolver (`scripts/build-book-renderer.js:83`). PDF boundary/DOM governance also reads the base as a foundational entrypoint; the artifact test exports through this path. |
| `app/(tabs)/article/[id].tsx` | Expo Router requires a sibling without a platform extension. `getRoutesCore.js` rejects a platform-only route without that fallback; the existing file documents the invariant and avoids pulling native rich-text dependencies into the web graph. |

The feature docs now name actual platform owners. Type-debt bookkeeping removes
only the deleted `Map.tsx` and `LazyYouTubeSection.tsx` rows and subtracts their
four existing `logicCast` counts from component/domain totals. No baseline was
regenerated and no guard exception was added.

The detailed per-file references and resolution evidence live in the ignored
audit artifact `.codex-temp/task3309-files-audit.json` in the isolated task clone.
This document preserves the durable decisions; generated audit evidence is not
committed. Recheck removability if a new Node tool, explicit file-extension
consumer or resolver configuration is introduced.

## 1. Dependencies

Removed six unused direct development declarations: `@jest/test-sequencer`, `@babel/preset-env`, `@babel/helper-compilation-targets`, `babel-plugin-transform-import-meta`, `chalk`, `source-map-explorer`. Removed the obsolete direct `metro-react-native-babel-transformer`; the config regression now checks the actual Expo transformer. `jszip` moves to development dependencies because its only application-repository import is in the e2e import fixture.

Also removed `expo-auth-session` and `react-native-image-picker` after capturing complete Expo and React Native iOS autolinking graphs before and after installation. The Expo graph is byte-equivalent; the React Native graph differs only by removal of image-picker. CocoaPods installation succeeded (151 dependencies, 170 pods). Its generated unrelated changes to the already-stale ExpoLogBox version/checksum and ExpoModulesCore checksum were excluded; final tracked Podfile.lock/project changes only remove image-picker and its privacy resource entries. Unused test-only mocks of these packages were removed. No other native module was lost.

The regenerated Yarn lock removes 181 selectors (1866 → 1685). Every surviving existing selector retains its exact version: zero unrelated dependency upgrades. Raw comparison and installation/autolinking logs stay in the isolated clone's ignored task artifacts. Native device/store builds are outside this tooling task.

## 4. Legacy specification tooling

The owner explicitly approved removing Spec Kit on 13 November 2026. Removed
all 19 tracked files in `.specify/`, the ten generated Speckit Copilot skills,
the obsolete global Copilot SDD instruction and the sole legacy draft directory.
Copilot now points at the canonical OpenSpec workflow. Removed Speckit-only
sync/catalog exceptions; unrelated Copilot-native skills remain outside the
project mirror, and supported OpenSpec vendor adapters retain their own metadata
handling.

Verified provenance:

- Spec Kit 0.16.0 was installed on 6 August 2026 at 11:02:57 UTC for Copilot
  (`ai_skills=true`, shell scripts). First tracked in
  `7940944448e401cebe2731b366b923c602924b15`, authored by `kelios_` at
  13:49:41 +02:00. The commit subject describes viewport work and does not
  identify who invoked the installer or explain its motivation.
- `199c647c924a65754c87d7d0accd8ca7d82cecd5` (8 August 2026,
  10:56:35 +02:00, same author) introduced OpenSpec config and changed the
  canonical SDD document to OpenSpec 1.8.0/Codex, retaining Spec Kit for history.
- The only draft was created during SDD setup on 6 August and explicitly marked
  unapproved, unimplemented, without plan/tasks. Its full requirements and the
  old constitution remain retrievable from the first commit in Git history.
  This cleanup does not approve, reimplement or silently migrate them into a
  new OpenSpec requirement/backlog item.

The existing OpenSpec search-card change keeps a pinned commit reference for
that provenance. No OpenSpec draft or living specification was removed.

## 5. Local task history

Nine task files were removed after their content was preserved on the board. The numbered 1137 fallback was restored during review, correctly migrated in full, then removed. `tasks/000-template.md` remains the fallback form; `tasks/README.md` documents that fallback and is not a backlog record.

| Removed task file | Preserved record / decision |
| --- | --- |
| `1012-map-search-name-relevance.md` | #1012, already done |
| `1137-quest-seo-build-catalog-guard.md` | #3391, backlog; all 231 historical source lines and pending gates preserved verbatim; the filename number was not board id #1137 |
| `draft-20260729-places-unsized-media.md` | #1230, exact historical finding already accepted |
| `draft-20260729-quests-catalog-api-fanout.md` | #1238 + #1241, historical 12 → 2 API calls |
| `draft-20260729-reopen-1053-quest-covers.md` | #1053 + #1137; historical recurrence preserved, no new defect inferred |
| `draft-20260803-family-route-404-conversion-keys.md` | #1204 and related family history; exact historical contract preserved in #3309 |
| `draft-20261007-quest-translate-sweep.md` | #2199; implementation commit `4748ddc5a` and scope provenance appended |
| `draft-20260803-mytravels-silent-fetch-failure.md` | #3389, backlog; implementation commit `3c7c673f9` recorded, fresh acceptance not claimed |
| `draft-20260729-production-request-budget-audit.md` | #3390, backlog; partial audit and remaining unaccepted scope preserved |

Five existing draft histories and the completed #1012 task were reused; three unrepresented scopes were migrated to backlog, including the corrected numbered fallback #3391. Source cleanup does not reimplement these features or turn old snapshots into current production findings. The complete nine-file provenance is preserved in #3309, and new records were re-fetched after creation. BUILD-CATALOG-001 in docs/PROBLEM_MEMORY.md now points to #3391 and explicitly marks the static pipeline as retired by #2766; no old SSG restoration or fresh defect is inferred.

## 7. npm command aliases

A tracked-source scan covered package script bodies, workflows, docs, scripts, tests, e2e and Claude/Codex/Grok adapters. It found 75 aliases without a literal consumer. Lifecycle commands are exempt; dynamically/documentedly consumed commands are retained. On base `60600bb43` the npm surface changes from 316 commands to 242, including the new `clean:temp`. The underlying tool scripts remain available through retained commands or direct CLI invocation.

Removed aliases: `check:node`, `test:cors`, `web:prod`, `e2e:headed`, `e2e:ui`, `guard:e2e-fake-web-session:json`, `test:run:mem`, `pr:ci-exception:validate:json`, `quality:summary:validate`, `test:watch`, `config:diagnostics`, `test:coverage:travel-details`, `serve:prod`, `stats:health`, `stats:health:json`, `seo:404:json`, `fetch:lasy-data`, `guard:bundle-budget:update`, `lighthouse:travel`, `lighthouse:produrl:lcp`, `test:pages:performance`, `e2e:perf-budget:headed`, `prod:web`, `ios:build`, `android:build`, `guard:no-direct-linking-openurl:json`, `guard:no-direct-window-open:json`, `guard:no-inline-page-fetch-loop:json`, `guard:no-inline-back-navigation:json`, `guard:container-names`, `guard:container-names:json`, `guard:no-direct-osm-tiles:json`, `quest:scan-hint-leak:json`, `quest:scan-answer-reachability:json`, `quest:scan-compound-spelling-gap:json`, `quest:scan-count-steps:json`, `quest:scan-anytext-minlen:json`, `quest:scan-skip-promise:json`, `quest:scan-button-labels:json`, `quest:scan-mixed-script-text:json`, `quest:scan-surface-answer:json`, `quest:scan-step-numbering:json`, `quest:scan-media-gaps:json`, `quest:scan-point-roles:json`, `quest:scan-city-walk:json`, `quest:scan-story-thread`, `quest:scan-story-thread:json`, `quest:scan-prod-drift:json`, `quest:sync-from-prod`, `guard:quest-data-sources:json`, `guard:prod-write-mode:json`, `guard:quest-answer-eval:json`, `guard:quest-review-snapshots:json`, `guard:cli-contract:json`, `guard:social-auth-infra`, `guard:travel-autosave-owner`, `guard:travel-links:json`, `guard:rich-text-sinks:json`, `guard:web-deferred-loading:json`, `guard:file-complexity:fail`, `guard:query-keys:json`, `guard:root-scratch-artifacts:json`, `guard:touch-targets:json`, `guard:touch-targets:update`, `guard:text-row-sizing:json`, `guard:themed-colors:json`, `guard:locale-number-format:json`, `perf:check`, `perf:lighthouse`, `design:migrate`, `design:migrate:dry`, `test:seo:prod:verbose`, `test:media:body:full`, `stats:index:all:json`, `indexnow:dry`.

The ignored `.codex-temp/task3309-npm-script-audit.json` preserves per-command references from the initial tree; this decision journal is not counted as a command consumer.

## 8. Temporary storage retention

`npm run clean:temp` inventories by default; `--apply` is explicit. The canonical retention contract is in `docs/WORKFLOW_OPERATIONS.md`. Fixture tests cover stale/active entries, protected stores, symlink targets, archive retention, concurrent changes and clean/dirty/unmerged worktrees, including Git 2.33's conservative porcelain fallback. No real temporary data is deleted by this task; final real-root acceptance is a dry-run.

Independent review found and repaired protection of named ops stores (`ops-3309`, `ops.snapshot`). The two regressions failed before the fix; the cleanup suite then passed 43 tests; the final code review added ignored-file protection for whole-worktree removal (44 tests). The code-review gate on 2026-11-15 then found that store names were matched inside caches and tracked worktree files, so no real project `node_modules` (it ships `onnxruntime-web/**/ops`) and no project worktree (it tracks `.claude/agents/instagram-*.md`) could ever become a candidate; names are now matched only outside caches and registered worktrees, virtual environments stay protected at every depth (59 tests). Four focused suites pass 145 tests, targeted ESLint and Node syntax checks pass, and independent platform resolution confirms all 19 deleted bases resolve to retained implementations. The complete owned diff passed review-auditor; whole-task lint/Jest/build and the final code-review gate remain pending.

The first full Jest attempt exposed an obsolete privacy inventory expectation for the removed RN image-picker SDK. Its single bundle entry was removed from ios-release-guard-lib; all active SDK resource checks remain. The existing iOS release baseline and missing-active-resource mutation suite now pass 102 tests. That early red full run was stopped and preserved separately before restarting the complete suite.
