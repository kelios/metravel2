## Context

See proposal.md for the problem and boundaries. The #1874 Task Contract and
implementation source audit confirm two gaps: article editor attributes discard
the formatting vocabulary, and the readers have no corresponding style mapping.
Supplemental fields also bypass the article body's safe write normalization.

Quill 2's installed attributor whitelists are bounded: alignment center/right/
justify, fonts serif/monospace, sizes small/large/huge and indentation levels 1–8.
Block attributes can occur on paragraphs, headings and list items. Font and size
occur on inline spans. The backend strips inline style but retains class.

## Goals / Non-Goals

**Goals:** keep one bounded format vocabulary, preserve it through the editor and
API write path, map it to actual reader styles, and make toolbar growth fail
closed in the regression fixture. Analysis level L because this is a recurring
sanitization and cross-platform rendering boundary.

**Non-Goals:** no general CSS support, broad font regular expression, new HTML
parser, backend implementation, media pipeline work or editorial content repair.

## Decisions

1. Reuse the existing sanitizers and list normalizer. Define the bounded Quill
   vocabulary in a small shared utility usable by the editor sanitizer and
   readers. Restrict classes per block/inline tag. Reject allowing arbitrary
   `ql-font-*` or unbounded indentation: the editor does not expose those values.
2. Reuse a scoped web CSS generator in SafeHtml and travel typography. Native
   alignment/font/indent use `classesStyles`; relative size uses the existing
   span model's `getMixedUAStyles` with parent tag styles. Actual RNRH defaults
   resolve em against rootFontSize, not the parent heading, so class em alone can
   make large text smaller than its heading. Keep renderer `emSize` aligned with
   `baseFontSize`, and return numeric size/line-height from the bounded size model.
   This preserves huge heading descendants without type escapes or HTML rewrite.
   Use the existing
   platform font policy/system fonts. The existing native renderer maps generic
   serif/monospace to Times New Roman/Menlo on iOS and serif/monospace on Android;
   reuse these generic families rather than introducing another font registry.
   Do not import editor CSS globally or let
   article content style unrelated application elements.
3. Reuse `sanitizeTravelBodyForWrite` for all four fields on PUT and PATCH. Keep
   supplemental-field limits and the existing FAQ-loss protection. Do not run
   previously stored editorial HTML through a narrower editor-only allowlist.
   Its existing API sanitizer permits editorial classes/styles; the new bounded
   class policy belongs to editor output and must not narrow old article input.
4. Traverse every toolbar variant and option in the regression fixture. Real
   installed picker defaults supply empty option lists. Each case must assert
   actual sanitizer output, not merely membership in the new utility. Mutation
   control adds an unknown format/option and proves the test rejects it.
5. Preserve the mobile simplified editor's existing rich-content protection.
   `ContentUpsertSection.isRichDescription` must recognize supported Quill
   paragraph/span classes; otherwise its next plain-text edit erases the very
   formatting this change preserves. Extend that existing predicate and its
   regression test, without redesigning the mobile editor or adding copy.
6. Remove the color/background row from the full toolbar. This is the minimal
   previously recommended option adopted under the user's subsequent explicit
   fix-all-and-deploy request. Verify actual rendered toolbars in both variants;
   restoring the unsupported controls must fail the format contract. Enabling
   styles only on the frontend is rejected because the backend still strips them.

Task-owned code: `utils/articleEditorSanitize.ts`, a focused shared Quill helper,
`components/article/articleEditorConfig.ts`,
`components/article/SafeHtml.tsx`, stable-content web typography and native render
configuration, `api/misc.ts`, and focused sanitizer/API/reader tests.
The mobile rich-content predicate and its focused test are also task-owned.
Root owns this change and `docs/PROBLEM_MEMORY.md`; the implementation/review
agents own feature code in coordinated phases.

## Risks / Trade-offs

- Safe class vocabulary could omit a real Quill block tag → test real output for
  headings, list items, paragraphs and inline formats.
- Repeated sanitization could lose stored editorial markup → preserve the broader
  existing API write sanitizer and verify FAQ/list controls on PUT and PATCH.
- Native fonts and relative size processing differ from web → use the actual
  default tree/font adapter in tests, cover huge headings/bold descendants/plain
  spans, and verify Android/iOS readers rather than only the web CSS.
- Wider read styles could escape their article → scope CSS selectors to each
  existing reader container and reject arbitrary content classes.
- Future color reintroduction without backend support → explicit unsupported-control
  regression and real round-trip cases fail before it can ship.

## Validation Matrix

Before testing: targeted sanitizer/toolbar/API/reader tests, mutation RED control,
TypeScript, scoped ESLint, relevant security and project guards, prompt audit and
OpenSpec strict validation. Independent full-diff review-and-fix follows; commit
and push use explicit task paths before the ticket enters testing.

In testing, local API localhost:8000 and Expo web localhost:8081: apply formatting
in the real desktop description editor to a disposable test article, save and inspect both raw HTML
and canonical safe HTML. Desktop 1280 and mobile 390 must show computed alignment,
non-default font and changed font size; test plus/minus/recommendation list type,
FAQ controls and retained toolbar actions. `ContentUpsertSection` uses the full
toolbar only for desktop description; supplemental fields and mobile fullscreen
editing use the existing compact toolbar. Do not add new controls there. Use the
actual compact bullet button and paste/copy of formatted content for supplemental
round-trip coverage, then reopen/read it on mobile. This corrects the original
ticket's assumption that every field exposes all five formatting controls.
Record screenshots, network and console.

Native-specific `classesStyles` changes additionally require Android local
debug install/device observation and iOS simulator reader observation after
testing. No store build/upload is involved. Auth uses existing ignored e2e
credentials; local test data is cleaned through the normal API.

Localization impact none; no new copy, formatting labels or locale behavior.
Security negatives are required. SEO, accessibility, analytics and performance
have no changed external contracts beyond preserved semantic article content;
no media or network budget measurement is introduced.

## Migration Plan

No migration. Only future saves retain supported formatting that was previously
discarded; previously lost text styling cannot be reconstructed. Rollback reverts
the explicit task commit. Production deployment was explicitly requested in the
user's subsequent message and follows full lint/Jest/e2e plus production gates.
After required QA, archive/synchronize the completed specification and validate
all OpenSpec artifacts without modifying unrelated active changes.
