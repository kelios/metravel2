## Context

See proposal.md for the observed physical failure. The dependency documents last-mounted-host priority, but `ToastRoot` recreates its imperative handle whenever `useToast` replaces show/hide closures. Its callback ref removes and appends that handle, promoting an older root after legitimate keyboard/inset updates or an internal auto-hide. Existing modal tests use the real registry but do not update only a lower host after mounting the modal.

Owned production path is `patches/react-native-toast-message+2.3.3.patch`; focused coverage is `__tests__/components/ui/ToastHost.priority.native.test.tsx`. Reuse ToastHost, ModalToastHost, the public static API, useToast and the repository's fail-closed patch-package postinstall. No package/version/lockfile changes.

## Goals / Non-Goals

**Goals:** restore lifetime identity and last-mounted selection while retaining current method closures; prove the mechanism using the real dependency and an unpatched negative control.

**Non-goals:** a new registry, depth API, renderer, visual design, TTL changes, permission policy or per-screen fixes. No runtime, board, signing or store operations in implementation/review.

## Decisions

1. `ToastRoot` stores the latest show/hide functions in a ref each render and exposes one imperative object through `useImperativeHandle(..., [])`. Stable wrapper methods delegate to that ref. True unmount still executes the existing registry removal; no registry rewrite is required. Memoizing ToastHost would not prevent useToast's internal rerenders; a private app adapter would duplicate ownership policy.
2. Patch the verified lockfile-resolved dependency 2.3.3 using the existing patch-package mechanism. Check clean application on an untouched temporary copy and then installation locally at an explicit shared-dependency boundary. No node_modules-only fix.
3. Keep real Toast, ToastUI, registry, useToast and timers in regression tests. Replace only AnimatedContainer with a deterministic presentation, exercising config/action rendering. Drive actual ToastHost keyboard and inset updates separately, internal root expiry, current defaults, nested unmount fallback and public/action hide. A simplified mock registry cannot establish this mechanism.

## Analyst and designer source review

Requirement: feedback from Photos denial and other existing producers must remain in the active retained native presentation. Audience: iPhone/iPad and Android users; no new UI or localized text. Acceptance criteria are the three requirements in `native-feedback-layer-priority/spec.md`. Apple permission feedback is affected; this code-only slice does not attest App Review compliance or TestFlight readiness. No owner/Apple action or backend dependency is introduced.

UX invariant: existing message hierarchy, card geometry, contrast, semantics, focus, keyboard avoidance, safe-area offsets, 44pt action targets, durations and animations are preserved. No design-token changes. The repair changes only which already-mounted host receives the public API request.

## Compatibility and risk zones

No data/API, auth, error handling, backend, URL, metadata, SEO, media, tokens, input validation, WebView or analytics changes. There are no new requests, timers or assets; each host adds one constant-size ref and two method wrappers. No Core Web Vitals surface changes. Existing callbacks are forwarded without argument or return-value changes.

## Risks / Trade-offs

- [Stale methods in a stable handle] → update delegates each render; assert changed callbacks and timing defaults plus public hide.
- [Lost true-unmount cleanup or stale replay] → nested child/parent close tests and final root fallback.
- [Dependency drift] → versioned patch and existing postinstall `--error-on-fail`; verify a clean-copy application.
- [Unit tests cannot prove UIKit stacking] → physical acceptance after independent review/testing, preserving prior evidence scope.

## Migration Plan

No data migration. Install the patch through existing postinstall, review the entire owned diff, then hand off to the root for commit/push and physical acceptance under the task workflow. Future candidate provenance must include the patch. Rollback removes the patch and corresponding regression change and restores the locked dependency via the ordinary install gate; no backend or permission rollback is involved.

## Validation matrix

| Surface / locales | Code-level control | Testing handoff |
| --- | --- | --- |
| iPhone/iPad native, existing RU/BE/UK/PL/EN | Real-library priority, callbacks, action/dismissal tests; focused static checks | Physical iPhone EN: retained fullscreen editor with keyboard → Photos denied; invalid anchor; map Copy; retained gallery/review feedback; normal close/reopen → root. iPad is not newly attested by this slice. |
| Android native, existing RU/BE/UK/PL/EN | Same real-library lifecycle tests and existing Android host controls | No new Android device claim; shared native regression risk retained for platform QA. |
| Desktop/mobile web, existing RU/BE/UK/PL/EN | Separate ToastHost.web path unchanged; existing no-extra-native-host web control | No visible web diff; no new browser probe required for this dependency-only repair. |

Localization impact is none: no keys or formatting changed, so test:i18n is not required. Run targeted Jest, native compatibility governance, scoped check:fast, strict OpenSpec validation and independent code review. Full quality/build/runtime remain with the root's operation gate.
