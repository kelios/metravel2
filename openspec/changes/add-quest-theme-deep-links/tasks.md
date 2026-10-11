## 1. Contract and selection implementation after separate apply approval

- [ ] 1.1 Record query presence, repeated-value fallback and seasonal URL-versus-storage policy in the ticket and `docs/features/quests.md`.
- [ ] 1.2 Add the pure theme-query resolver using existing registry/date authority without importing i18n into restoration leaf consumers; test valid, normalized, empty, repeated, unknown and inactive values.
- [ ] 1.3 Integrate initial/warm navigation selection and persistence with async restoration generation guards; test delayed storage, stale handoff, changed URL, manual Reset and ordinary rerenders.
- [ ] 1.4 Add the fixed theme-alias redirect route; test that valid/unknown aliases never invoke quest detail.
- [ ] 1.5 Align the emitted head-script marker with explicit query priority using the shared validation contract; extend restoration script tests.

## 2. Code review

- [ ] 2.1 Run targeted resolver/restoration/screen/route Jest suites, scoped lint and typecheck; preserve personal/city/country filters and profile handoff.
- [ ] 2.2 Run independent `metravel-code-reviewer` review-and-fix then code-review-gate on the complete task diff; rerun changed code-level checks.

## 3. Testing after reviewed diff

- [ ] 3.1 After the standard task pipeline makes the reviewed SHA available, verify `.build-source.json` and browser valid/invalid/alias/reset cases at 390/1440 using real catalog data, screenshots and console.
- [ ] 3.2 Verify active Halloween under an explicit fixed-date test and natural inactive fallback outside the season; schedule an exact unmodified-date production recheck from 15 October for natural Halloween entry/count.
- [ ] 3.3 Verify cold/warm Android emulator and iPhone simulator deep links, invalid fallback and Reset with the same catalog backend; report exact access unblock if unavailable.
- [ ] 3.4 Check existing RU/BE/UK/PL/EN theme/header labels and healthy city/country/profile selections without new key leakage.
- [ ] 3.5 Run `openspec validate add-quest-theme-deep-links --type change --strict`; before archive run `openspec validate --all` and attach actual acceptance evidence, preserving unfinished temporal gates.
