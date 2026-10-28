## Why

The existing ROUTE-BUNDLE-001 contract (#2738) stops production publication:
the 28 October server export reports 11 byte-budget breaches, including TOTAL
gzip 3352.1 KB against 3284.9 KB with the existing tolerance. The previous
production release already exceeded TOTAL; enabling the mandatory deploy guard
exposes that debt rather than proving a new telemetry leak.

Goal: remove unnecessary client dependencies and web compilation overhead while
preserving the existing release ceilings and observable product behavior. The
user-visible result is a publishable frontend with the same quest pages and
metadata, allowing the independently reviewed CWV work in #2846 to reach testing.

## What Changes

- Separate client-used quest JSON-LD/alternate construction from server fetch
  and metadata construction, preserving their values and server entry points.
- Let the web production minifier allocate module-factory parameter names;
  preserve parameter positions, compression settings, imports and export behavior.
- Add real dependency-graph and factory-ABI regression controls. Validate the
  resulting release artifact with all existing byte/request/payload guards.
- Record the confirmed recurrence controls in the existing problem registry.

Existing behavior to preserve: public URLs, redirects, canonical/hreflang,
JSON-LD, all current locale values, SSR/hydration, quest gameplay, error handling,
native compilation and the current feature/analytics set.

Non-goals: changing bundle ceilings or attribution to conceal bytes; disabling
guards; removing HEIC support or other features; changing locale reactivity;
rewriting the serializer; changing backend or native code; claiming field INP
improved merely because a bundle guard passes.

## Capabilities

### New Capabilities

None. This is a refactor/tooling change; `skip_specs: true` keeps the current
observable requirements and numeric release contracts unchanged.

### Modified Capabilities

None.

## Impact

- **Platform impact:** desktop web and mobile web. Native keeps the installed
  compiler defaults; no Android/iOS runtime behavior is changed.
- **Localization impact:** none; the existing RU/BE/UK/PL/EN construction remains.
- **Data/API:** no contract changes; server fetch stays in the server owner.
- **SEO:** identical structured data, alternates and metadata must be demonstrated.
- **Accessibility:** no rendering, focus, semantics or controls change.
- **Performance:** release JS bytes and dependency reachability change. The guard
  remains the acceptance source; offline minification estimates are not a pass.
- **Security:** preserve public-projection validation and server-only transport.
- **Analytics:** event names, consent and payloads remain unchanged.
- **Dependencies:** the existing Expo/Metro installation and one coordinated
  production export. Backend and store operations are outside scope.
- **Fallback/mock policy:** source/VM fixtures cover invariants; no mock, old
  artifact or renamed chunk may substitute for the fresh release guard and
  production verification after publication.
- **Open questions:** none affecting product behavior. The final byte reduction
  is deliberately measured after implementation; remaining breaches require
  renewed source attribution before expanding this change.
