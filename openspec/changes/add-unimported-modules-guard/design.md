## Context

See proposal.md for intent and `specs/module-reachability-control/spec.md` for behavior. This is a new cross-cutting developer control, with resolution, migration and performance risk; design is required.

Existing source evidence: `scripts/guard-type-debt.js:3–5,131–160` already uses installed TypeScript and a deterministic source inventory; `scripts/guard-public-files.js:54–89` checks both undeclared and stale exact paths. `scripts/lib/scanBaseline.js` supplies versioned loading but its writable, growth-permitting scan ledger is not the required monotonic contract. `scripts/guard-touch-targets.js:984–1000` has a private alias/index resolver limited to TS/TSX and one winner; no common full platform resolver exists to reuse unchanged. `tsconfig.json` defines `@/*`, bundler resolution, web/native suffixes and typeRoots. Avoid importing executable guard mains or migrating unrelated guards for reuse.

Read-only bootstrap evidence, 08.10.2026: main HEAD `d98f68e63b175b270f802b02382397772372ea59`, full non-shallow repository, Git2.33.0; neither guard nor ledger exists in HEAD. The five planning paths remain untracked. Committed-baseline lookup therefore genuinely has no authority yet; a default check requiring HEAD's ledger cannot be enabled before the authority commit. No Git mutation or quality command was used to establish this fact.

## Goals / Non-Goals

**Goals:** path identity rather than symbol/name searches; explainable entry/runtime/type provenance; a finite platform-resolution closure; immutable initial debt boundary and stale-ledger enforcement; one read-only lint invocation within a measured 10-second warm budget.

**Non-Goals:** prove branch execution, find unused exports inside a used module, traverse package source, execute app/config modules, infer arbitrary computed loaders, treat tests as entries, delete legacy modules, add dependencies or modify Expo/Metro configuration.

## Decisions

### 1. Inventory paths once; parse with installed TypeScript

Future owned paths: guard, exact baseline, guard fixture test, package lint wiring and DEAD-MODULE-NO-IMPORTER-001 documentation. Use an ordinary Node script and TypeScript AST, not a compiler program/typecheck. Inventory `.js/.jsx/.ts/.tsx/.mjs/.cjs` and declaration contracts in `api`, `components`, `context`, `hooks`, `screens`, `services`, `stores`, `utils`, `constants`, `types`, `styles`, source helpers under `app`, plus repository-root source modules such as `queryClient.ts`. Track imported project modules outside candidate folders as graph nodes. Exclude dependencies, generated/build/test/coverage/scratch trees; never follow a symlink outside the repository. Untracked candidate source files are scanned so the new-module failure occurs before commit.

AST collection recognizes import declarations, side-effect imports, import-equals, export-from, literal import(), literal require(), import-type nodes and reference directives; constant no-substitution template literals are finite literals too. Comments and unrelated strings do not create edges. Package/builtin imports terminate traversal. Memoize parsed AST/edges and resolution; build adjacency once and run bounded graph traversal, not per-module subprocess/import searches. Reject a local unresolved literal with importer/specifier context. Computed package/vendor loaders are outside local reachability; a computed production local loader needs a finite source-backed mapping and regression before its current targets can be accepted, never a directory-wide implicit root.

Implementation architecture clarification (08.10.2026): six existing quest authoring tools accept operator-selected data files, rather than declaring application dependencies (`audit-quest-coordinates.js`, `lib/questBundles.js`, `migrate-quest-from-file.js`, `quest-poi-suggest.js`, `sync-quest-data-from-prod.js`, `sync-quest-to-prod.js`). Their unrestricted CLI targets cannot be truthfully enumerated. Recognize this structural contract only in tooling-only `scripts/**` provenance: `require(path.resolve(process.cwd(), INPUT))`, directly or through an immutable same-scope const alias, with a verified node:path/path binding and an unmodified function parameter or a member of a verified CLI parse result as INPUT. This is an operator-tool-input diagnostic, not a source dependency: record the importer, line, expression and reason; add zero reachability edges. Do not load its argument, infer a naming-pattern target set, or promote any application module. Concatenations, templates, arbitrary calls, source-controlled local prefixes, and loaders reached with application provenance still fail explicitly. Fixed source-backed copied app.config.js and eslint.config.js config loads retain exact dependency edges. Fixtures must show that an operator-input target under components remains dead and that a computed app dependency fails. This refines the tooling-input boundary without changing any loader behavior or adding per-file exemptions.

Rejected alternative: name grep or counting incoming edges misses aliases and accepts isolated dead cycles. Knip/madge/new dependencies add configuration and package cost without a source-backed advantage for this bounded contract.

### 2. Entries are route/config/tooling contracts, not a broad directory exemption

Root `entry.js`; existing root Metro/Babel/app configuration modules and executable root tooling configuration entrypoints, with exact reasons recorded in the scanner policy; all source scripts in `scripts/**` per #2260. Script root policy does not exempt app modules unless actual imports connect them. Root source files such as queryClient are candidates unless imported; they do not become entries merely because they sit in the repository root. Unit/e2e runners and their configuration/import chains are not app-liveness roots.

Expo route roots include valid route/layout reexports and framework-reserved contracts such as `+html` and `+native-intent`; classify platform route families consistently. Do not label all `app/**` helpers as roots. Installed Expo Router's `_ctx-shared.js` matches broad TS/TSX contexts and `getRoutesCore.js:500–508` only warns for missing default exports: directory placement alone is not a valid route contract. The guard statically recognizes default exports/reexports for ordinary route modules and framework-supported exports for reserved entries. A plain helper without that contract remains a candidate needing an actual dependency path; do not claim Expo runtime cannot encounter a misplaced helper. This control does not execute Router or change routing. Fixtures distinguish valid default reexport, reserved native-intent entry, non-entry helper, ignored test/declaration paths and platform variants.

Explicit configured ambient `.d.ts` contracts are compile-time roots only; do not make every `types/*.ts` module live through the typeRoots directory. Imported declarations and type-only import edges carry type provenance. Runtime and type reachability are separate recorded sets; their union answers module usage because unused runtime exports in a type-used module are outside dead-module scope.

Rejected alternative: making every app/root/type file live by location would exempt new helpers and recreate the problem. An editable per-module root override registry would provide a second exception-growth bypass; do not add one.

### 3. Conservative platform closure with precise path semantics

Resolve `@/` and relative paths using an indexed candidate set and the project's alias contract. For a neutral module specifier, collect the legitimate resolution winners for web, iOS and Android plus supported shared/native forms, including base fallback and index/barrel modules. Platform siblings are reachable only through this resolution family or their own entry; explicit `.web`/`.ios` imports remain exact and do not automatically exempt unrelated siblings. A reached platform adapter may explicitly reexport another platform file (current Android gallery→iOS). Preserve extension-qualified JS specifiers that target TS sources where project resolution supports them. Keep normalized case-sensitive POSIX repository paths; same exported binding names do not merge nodes.

TypeScript `resolveModuleName` may supply base alias/extension behavior using cached virtual host reads; platform alternatives require explicit per-platform resolution, not the app tsconfig's web-first single winner. Keep helper private to this control until an actual second consumer requires extraction. External packages/assets end the graph without app-module violations.

### 4. Exact debt ledger, immutable boundary, no update workaround

Proposed schema: contractVersion 1 and sorted entries keyed by repository path, each with `reason` and `owner`; owner references a canonical family/card where known. The initial current graph-derived dead list is generated as a review candidate only and independently compared path by path with the exact source graph and claimed ownership. No historical 31/43 list is copied automatically. If still unreachable, `components/MapPage/Map/useRouteBuilding.ts` must name MAP-ROUTING-001/#2014. Every other row needs a real accountable domain owner before initialization; unknown ownership is an unmet acceptance item. This is ordinary independent review of the implementation diff, not a new human-baseline approval request.

**Bootstrap has two ordered checkpoints, with one initial authority:**

1. Implement the unwired guard, graph/ledger fixture tests and candidate ledger. A read-only inventory/fixture interface may inspect graph and candidate validity; it never claims the default committed-policy check passed and never writes or accepts a ledger. Before this authority exists, the normal check explicitly refuses with `initial authority not established`, while existing default gates stay unchanged. Independently review graph, exact inventory, reason/owner rows and initial ledger against a frozen source snapshot. Commit the explicit reviewed guard/test/ledger paths as initial ledger introduction commit **C**, without package/default-gate wiring. The initial ledger must be absent in C's parent/history and present exactly once at C; capture C and its ledger blob identity in the review receipt. This bootstrap commit is not a deployment or a completed task.
2. In the next implementation checkpoint, pin C and its ledger blob in the guard's fixed authority policy, then wire the default lint command without any initializer/update flags. Independently review the complete final task diff, including the pinned authority and wiring, and run the actual default check against current HEAD. Normal checking requires C to be a reachable ancestor, verifies its pinned blob/schema/metadata and that it is the first ledger introduction, then audits every later transition. No user-supplied normal CLI authority override is provided. Fixture-level authority injection is isolated to temporary Git repositories; it cannot select a fresh working ledger as production authority.

Thus initial default checking does not deadlock on an absent HEAD ledger: wiring follows committed authority. It also cannot silently adopt a new ledger when lookup fails. C is allowed only as the independently reviewed first introduction for this implementation; a later deletion/recreation, new first-authority selection or debt-expanding reset requires a separate reviewed control change, not a maintenance command.

Normal checking reads working ledger AND committed Git snapshots using argument-array, read-only git show/log calls. Working path set must be a subset of HEAD ledger; changing the working JSON together with a new dead file therefore fails. Check each committed ledger transition from pinned C through HEAD, requiring each later path set to be a subset of its predecessor; memoize hashes and batch Git reads. This also rejects a growth already committed before the current invocation. Detect deletion/recreation transitions, rather than selecting the latest addition as a new baseline. Metadata corrections may be reviewed without changing path identity; replacing an old dead path with a new one counts as growth, even when total length stays equal. Remove deleted/reachable entries in the same change. No normal `--update`, `--initialize` or `--accept-current` command is provided.

Missing C, missing/patched pinned blob, absent HEAD/working ledger, C not reachable, failed Git lookup or incomplete history fails closed with the exact prerequisite. A later ledger deletion/recreation never reinitializes. The current repository is non-shallow; temporary shallow/no-history fixtures must still prove refusal. The control cannot protect against intentional replacement of its own implementation or fixed authority policy; mandatory independent review remains the authority for such control changes.

Rejected alternative: compare only current dead paths to editable current JSON, or only compare ledger length. Both accept newly created dead modules hidden by same-change exceptions or same-count replacements.

### 5. Diagnostics and integration

Sort violations by path/kind, retain #2260 unreachable/stale-baseline output shape and exit 1; invalid JSON/version/metadata/path, graph resolution and history failures have distinct explanatory diagnostics and also exit 1. Empty valid finding set exits0. Hook `guard:unimported-modules` into existing lint chain once. No startup app code, network probe or module execution. Problem Memory records tests and the lint entry as the common control, with cleanup waves linked separately by root after normal board-contract discovery.

## Risks / Trade-offs

- Platform overreach → per-platform winner fixtures, explicit suffix negative tests and real current callers; conservative module usage is not a runtime execution claim.
- Misplaced app helpers/typeRoots false liveness → static valid-entry contracts and separate type provenance fixtures; no broad app/types exemption.
- Opaque imports or missing Git history → explicit actionable failure, finite loader mapping or restored history; no guessed baseline growth.
- Current dead list has disputed ownership → independent path-by-path candidate review with reason/owner, no app deletion in this change; root creates separate canonical waves.
- Bootstrap check enabled before authority → commit reviewed ledger introduction C first, then pin C/blob and wire default gates; missing authority is a failure, never an implicit initializer.
- History/AST overhead → one parse per path, cached resolution and batched changed-ledger snapshots; measure before optimizing. The 10-second target is proposed, not verified by planning.
- Unrelated concurrent edits → freeze only task-owned implementation paths, preserve MESSAGES/foreign scratch, never include an entire working tree in baseline review without source SHA binding.

## Migration Plan

After a separate explicit apply request: build and test unwired graph/ledger fixtures; independently review the actual source-bound inventory and owner mapping; commit explicit reviewed initial authority paths at C while default gates are unchanged; then pin C/blob, wire lint and record family/control. Complete final full-diff review-and-fix/code gate and genuine normal guard checks before final task commit/push, ordinary authorized web publication and acceptance. Hand root cleanup-wave manifests; no additional baseline permission request is introduced. Do not remove existing dead modules during initialization. Rollback disables only task-owned wiring/implementation changes without deleting or recreating the initial authority ledger; subsequent repair may restore wiring, but must retain C and shrink-only history. No content/data migration needs undo. A debt-expanding reset requires a separate reviewed control change, not a maintenance switch.

## Validation matrix and impact boundaries

| Surface or contract | Planned evidence |
| --- | --- |
| Graph identity/empty/errors | Real temporary-tree tests: live entry, new orphan, test-only importer, disconnected cycle, unresolved local literal, helper beside app entry, no source execution |
| Platform resolution | Fixtures for aliases, index/barrel, literal dynamic/require, base/web/native/iOS/Android and Android→iOS reexport; explicit platform import must not exempt siblings |
| Type contracts | Type-only imports, import-type/reference, configured ambient declaration, unused ordinary type module |
| Ledger lifecycle | Real temporary Git repos: independently reviewed first introduction C before wiring; missing/unpinned authority refuses; C/blob/ancestry verification; new dead file+working baseline addition; committed growth; equal-count replacement; metadata errors; deleted/reachable stale rows; shrink success; deletion/recreation and incomplete/no-history refusal |
| Main tooling | Targeted guard test, whole scripts tests, tsc, lint after integration; test temp paths use existing makeTempDir policy |
| Performance | Warm once then record three monotonic wall-clock runs on designated project machine with SHA/Node/version/module count; every run ≤10 seconds, include ledger-history work |
| Desktop/mobile web | No UI diff; post-own-deploy #2260 smoke `/`, `/map`, `/travelsby`, console clean, published SHA; do only after source review/testing |
| Android/iOS | App sources/config/runtime unchanged; no device/store gate. Platform fixture assertions do not claim device PASS |
| RU/BE/UK/PL/EN | No text/resource edits; verify task diff remains locale-free, no fresh i18n suite needed solely for this control |
| SEO/a11y/security/analytics/API | No app URL/markup/control/event/request changes; verify read-only parser/Git confinement and no app import execution |

Before completion/archive, validate this change strictly and later run `openspec validate --all`; other changes' unrelated failures must be reported without mutation. No implementation or measured runtime PASS is claimed by these planning artifacts.
