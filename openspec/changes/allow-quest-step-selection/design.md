## Context

`QuestWizard.goToStep` and the shared route visual model both treat the historical progress index as a navigation gate.

## Decisions

- Keep the progress index as the furthest reached point, including a jump. Update it monotonically and reuse the existing postponed-point derivation and persisted cursor. The current point keeps visual priority.
- Reuse the existing sidebar pills, horizontal navigation and mobile route sheet, with their button semantics, focus handoff, labels and sizes. Derive the same current, answered and postponed flags on all surfaces.
- Keep required points in the finale calculation and use the existing guest gate for unanswered points. Applying an official skip during navigation was rejected because it can change whether the route qualifies for completion.
- A jump uses the existing progress write and step-view tracking. It introduces no API calls, analytics event types, new inputs, translation keys, media or SEO changes.

## Risks / Trade-offs

- A lost cursor or an answer counted by navigation would affect resuming and completion. Verify the persisted progress payload and guest limit in Jest.
- Skipping to a later point can create several postponed tasks at once. Verify that navigation can return to each of them.

## Migration Plan

The existing progress format supports the jump without migration. Reverting the code restores the prior navigation rule. Saved cursors and reached indices remain readable.

## Validation

Run focused quest navigation, guest, progress and finale tests and lint. After independent review, verify mobile web first and desktop web second with the jump and return scenario, screenshots and console evidence. Shared navigation has no separate native runtime dependency or new locale variants.
