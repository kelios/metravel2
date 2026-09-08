## Why

Task #1874 confirms that article save strips formatting produced by the existing
toolbar. Authors see alignment, font and size in the editor but readers lose
them. This repeats the sanitizer family #1768 → #1866 → #1874: earlier tests
covered selected examples instead of every configured authoring format.

## What Changes

- Preserve the supported alignment, font, size and indentation vocabulary through
  sanitization and the reader's web/native rendering contracts.
- Normalize description, plus, minus and recommendation through the same safe
  article-body write path, including list transport normalization and FAQ guards.
- Derive regression coverage from every configured toolbar format and option;
  adding an unsupported control must fail the automated contract.
- Remove the two unsupported color/background controls. Under the user's later
  instruction to fix all failures and deploy, implementation adopts this
  previously recommended minimal option. Inline-style acceptance stays unchanged.
- Record the recurring family and its permanent control in Problem Memory.

Goal and user-visible result: supported formatting survives save and is visibly
rendered to readers; the unsupported color/background boundary has an explicit
implementation decision under the user's fix-all request.

Existing behavior to preserve: FAQ disclosure markup, ordered/bullet list type,
safe links/media, draft/autosave behavior and save != moderation.

## Capabilities

### New Capabilities

- `article-format-preservation`: preservation, safe rendering and complete
  coverage of the article editor's configured formats across rich-text fields.

### Modified Capabilities

None. Existing living specs do not define this formatting boundary.

## Impact

- Platform impact: shared editor/write path, desktop web and mobile web readers;
  Android/iOS native reader styles require equivalent rendering support.
- Localization impact: none. No new app-owned labels or editorial copy.
- Frontend scope: editor sanitizer/configuration, SafeHtml, stable-content web
  typography/native render configuration, api/misc.ts, focused tests, registry.
- Data/API: HTML string fields and endpoints stay unchanged. Editor output
  retains only bounded, supported formatting classes; API writes preserve the
  existing broader safe contract for stored editorial HTML.
- Security: editor-produced markup keeps bounded classes and rejects unsupported
  styles. Existing API sanitization for stored editorial HTML remains intact;
  scripts, event handlers and unsafe URLs remain rejected. No new dependency.
- Accessibility: existing semantic paragraphs, headings, lists and disclosures
  remain intact; no focus/navigation changes.
- SEO: no URL, metadata or SSG changes. Existing FAQ markup must survive.
- Performance: small bounded style maps; no extra fetches or media changes.
- Analytics: no event changes.
- Dependencies: no blocker for alignment/font/size/list normalization/coverage.
  Backend currently strips inline style; removing the unsupported controls avoids
  that dependency. Backend source remains read-only.
- Fallback/mock policy: no fabricated successful API payloads. Unit fixtures use
  real editor markup; runtime QA saves a disposable local article and reads its
  genuine API response.
- Non-goals: backend code, historical content repair, unrelated editor redesign,
  publication/moderation changes, dependency upgrades and store releases.

The user subsequently explicitly requested full lint, tests, e2e, correction of
all errors/warnings and production deployment. Release verification therefore
follows completion of this code change, through the existing production operator.
The removal is an implementation decision under that broad fix request, not a
claim that the user separately selected a literal option. Store operations remain
outside scope. The current production dirty-checkout backup-directory blocker
must be resolved through its documented operator boundary before deployment.
