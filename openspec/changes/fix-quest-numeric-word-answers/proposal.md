## Why

Review of QuestProgress 595 exposed a checker defect independent of the player's final unanswered point: the Polotsk Sofia count accepts `2`, but the equivalent correct answer `два` is rejected. Numeric-prefix parsing can also credit `2.5` as two.

## What Changes

- Accept full numeric literals and equivalent cardinal number words for count answers through the shared checker.
- Cover RU/BE/UK/PL/EN cardinal words from zero through 999; preserve larger numeric literals, free responses and authored textual variants.
- Reject wrong quantities, ordinals and malformed numeric prefixes; do not expand factual answer dictionaries.
- Preserve player progress and quest content. An unanswered final point remains incomplete.

## Capabilities

### New Capabilities

- `quest-numeric-answers`: equivalent numeric/cardinal submissions with strict boundaries.

### Modified Capabilities

None.

## Impact

- Platform impact: shared; the same pure checker serves web, Android and iOS. No platform boundary changes.
- Localization impact: all current locales; number recognition only, no new UI strings.
- Paths: numeric answer utility, quest adapter, focused regression tests, this change and the answer-checking feature documentation.
- API/data: existing answer-pattern schemas and saved values remain unchanged. No backend dependency or mocks.
- SEO/accessibility/media: unaffected; no route, markup, focus, keyboard or rendering change.
- Performance/security: bounded local parsing, no dependencies or network calls; full-string validation prevents prefix false positives.
- Analytics/privacy: submitted values and free-response privacy remain unchanged.
- Non-goals: changing the Polotsk itinerary/final-point policy, accepting factually wrong guesses, reconstructing why the player closed the page, store releases.
- Open questions: none. User explicitly authorized fixes; web publication follows the existing repository pipeline.
