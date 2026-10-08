## Why

#2260 records five manual dead-module cleanup rounds (#1694, #1732, #2044, #2063, #2259) without a repeatable reachability control. Type checking and local unused-variable lint cannot distinguish an application module reached only by its own tests from a module reached by a production entry; name searches also misclassify aliases and platform siblings.

The goal is a deterministic path-based lint control that rejects new unreachable modules and stale exceptions while allowing one reviewed inventory of existing debt to shrink. Historical scans of 31/43 modules are evidence of the gap, not an approved current baseline.

## What Changes

- Introduce an observable lint capability for source-module reachability from application routes, application entry/configuration and repository scripts. Test/e2e importers do not make application modules live.
- Resolve repository aliases, platform variants, barrels, literal dynamic imports and literal require, retaining type dependencies separately from runtime dependencies.
- Independently review the exact current unreachable-module inventory path by path, with a reason and accountable owner for every entry. Establish its initial committed authority before wiring the guard into default gates; this ordinary code-review step does not introduce a separate user approval for the baseline.
- After initialization, reject new entries, baseline growth hidden in the same change as a new dead module, and stale entries for deleted or newly reachable modules. A missing committed authority never causes automatic initialization.
- Integrate the control into lint, report deterministic path/kind violations, and measure a warm-tree 10-second maximum. Record DEAD-MODULE-NO-IMPORTER-001 in Problem Memory.
- Produce owner-specific cleanup-wave cards from the reviewed baseline; removal of their code, tests and five-locale resources belongs to those separate cards.

## Capabilities

### New Capabilities

- `module-reachability-control`: Production-entry reachability and a shrink-only exception ledger in the repository lint contract.

### Modified Capabilities

None; no existing specification covers this repository control.

## Impact

- **Task-owned implementation paths, after explicit apply:** `scripts/guard-unimported-modules.js`, `scripts/unimported-modules-baseline.json`, `__tests__/scripts/guard-unimported-modules.test.ts`, `package.json`, `docs/PROBLEM_MEMORY.md`. A small script helper is permitted only if implementation proves reuse is needed; no application module deletion or migration is part of this change.
- **User-visible result / Platform impact:** none. Desktop web, mobile web, Android and iOS application behavior remains unchanged; their module-resolution variants are guard fixture cases, not a device release request.
- **Localization impact:** none. RU/BE/UK/PL/EN content and keys remain unchanged.
- **API/data:** no backend or client API change. Guard output remains a sorted list of `{ path, kind: "unreachable" | "stale-baseline" }` for those violations, exit 1; invalid policy, initialization or resolution failures also fail explicitly with a diagnostic and never silently pass.
- **SEO / accessibility / analytics:** unchanged; no rendered page, URL, metadata, semantic control or event changes.
- **Performance:** development-only control, proposed warm-tree elapsed budget ≤10 seconds; no app requests, bytes or bundle work. The budget requires actual later measurements, not a planning PASS.
- **Security:** read-only source/Git analysis, no module execution, secrets, network or backend writes. Paths are confined to the repository.
- **Dependencies:** installed TypeScript/Node and Git metadata already used by guards. No hard API dependency. Independent review must verify the concrete current path/reason/owner inventory before the first ledger commit, including MAP-ROUTING-001/#2014 for `components/MapPage/Map/useRouteBuilding.ts` if still unreachable. Initial authority and default lint wiring are ordered implementation checkpoints within the separately authorized apply, not additional user permission gates.
- **Existing behavior to preserve:** live route reexports, aliases, platform siblings, index/barrel imports, literal lazy loads and required type-only modules; isolated dead cycles remain dead.
- **Fallback/mock policy:** guard errors fail closed. Real temporary filesystem/Git fixtures may exercise resolution and ledger transitions; application/browser mock success is not acceptance evidence.
- **Non-goals:** automatic deletion, dead-export analysis, proving which conditional branch runs, arbitrary computed-import inference, changing Expo/Metro config, backend, store stages, deployment tooling #2226/#2227, and cleanup of unrelated active tasks.
- **Open questions:** no material policy ambiguity remains. Implementation must present the current inventory and cleanup owners; historical name-based candidates are not silently accepted. Any opaque local loader without a finite supported mapping is an explicit blocker, not an automatic root or exception.

These artifacts authorize planning only. Implementation starts after a separate explicit user request to apply the completed change.
