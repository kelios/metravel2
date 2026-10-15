## Context

See `proposal.md` for motivation and
`docs/design/task-2434-bottom-sheets.md` for source evidence, candidate matrix,
implementation slices, risks and complete validation matrix. That document is
the canonical technical detail for this change and was prepared before code.

## Goals / Non-Goals

Goals: remove the wrapper mechanism, reuse one bottom-sheet presentation owner,
preserve keyboard access, nested lifecycle, feedback and focus.
Non-goals: backend/API changes, new strings, Apple portal/signing/release,
redesign of the centred paywall or unrelated consumers.

## Decisions

- Reuse `components/ui/BottomSheet.tsx` for seven lower sheets; keep ThemePreview
  paywall centred with sibling backdrop/card. Reject local accessible=false
  patches and a second generic sheet primitive.
- Extend the existing shell only through backward-compatible `keyboardAware`,
  `panelStyle?: StyleProp<Pick<ViewStyle, 'maxHeight'>>` and
  `modalContent?: ReactNode` options. Preserve existing defaults,
  touch boundary, swipe, insets and appropriate former maxHeight limits.
- Keep modal toast hosts at full-screen overlay level; adapt the structural
  `guard-modal-feedback.js` to BottomSheet aliases and retained overlay owners.
  Report remains transient report-parent, without its own disappearing host.
- Preserve nested native presentation structure and reuse RNW Modal's web focus
  stack/trap/Escape/restore rather than adding a competing trap.
- New AST guard rejects the backdrop-wrapper/noop family and runs under lint;
  fixtures cover failure and accepted siblings/handlers/import aliases.

Affected paths: eight Task Contract components, BottomSheet, guards, package.json
and associated tests. Owners and file evidence are in the canonical design.
Data/API/backend, SEO/URLs, analytics, auth/storage/privacy/signing: unchanged;
no new dependency, network/media request or external capability.

## Risks / Trade-offs

Height/scroll clipping → preserve source limits and exercise long bodies.
Double keyboard inset → iOS avoidance, Android resize-aware behavior.
Toast loss/offset → retained full-screen slot and feedback guard regressions.
Nested modal/focus regression → close/reopen hierarchy and web Tab/Escape checks.

## Migration Plan

Implement shell, migrate consumers, integrate guards, run targeted checks,
then independent code review. Runtime acceptance occurs only in `testing`:
web 390/1440 after task-SHA deploy, iPhone 17 Pro iOS 26.5 Inspector and
keyboard locally and Android TalkBack. Narrow iPad layout checks are optional
risk controls, not an added Task Contract gate.
Preserve RU/BE/UK/PL/EN keys; no new translations or test:i18n required.
Detailed gates and operation boundaries remain in Task Contract and canonical
design. Rollback reverts the complete task diff; no data migration is needed.
