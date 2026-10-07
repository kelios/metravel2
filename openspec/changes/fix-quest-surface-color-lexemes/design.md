## Context

See proposal.md for the blocker. `scripts/scan-quest-surface-answer.js:196–200` uses substring search for both answer dictionary values and task tokens. `:169–184` documents collisions and deliberately freezes the historic #1431 parity. Existing canonical Task #1431 is done; the problem registry treats its root cause as stale object appearance, whereas this proposal fixes measurement over-inclusion.

## Goals / Non-Goals

**Goals:** one deterministic lexical criterion for both consumers, explicit historical criterion revision, retained real-risk coverage and drift sensitivity, no editorial mutation.
**Non-Goals:** contextual NLP (a genuinely color-named monument can still require human exclusion), complete novel-language vocabulary, counting/material criterion redesign, blanket rebaseline.

## Decisions

1. Reuse `classifyStep`, `scanQuests`, `findingKeys`, `loadLocalBundles` and shared baseline splitting. Refine the existing positive-root check with a lexical validation conjunction; no new root/vocabulary matches are introduced. Change only color lexeme recognition; retain the established false-word precedence. Candidate is `color-lexemes.candidate.js` and in-memory injection in `probe.cjs`, both ignored scratch.
2. Use normalized Unicode-letter tokens and anchored stems with language-specific inflection endings, supported compound prefixes and shade/color-verb forms. Reject arbitrary inner-root occurrences. Corpus deltas drove retention of genuine `золотится`, `беленый`, `позолота`, `голубизна`, `белоснежный` and RU joined compounds; other-language compounds separated with spaces/hyphens. Supported vocabulary is explicit; no unproved completeness claim across eight languages. Joined compounds are deliberately supported only for RU; other supported language compounds retain space/hyphen token boundaries. Independent architect controls include серебристый/серебро/терракота/niebieskie/белы, UK soft inflections, PL shade families and German -lich derivatives.
3. Keep every current baseline byte and version unchanged; stale false-positive entries are harmless because a removed finding emits no key. Never regenerate baseline on this dirty shared tree. Retain the old root/vocabulary acceptance check as a prefilter before lexical validation, so every new marker must already be an old marker: baseline stays valid conservatively. Vocabulary expansion, including previously unrecognized «бурая», is outside this refinement.
4. Revise the historical criterion honestly: original 107 scope +40 structural becomes 85+40. All 22 removed ids are already in `scope-decisions.excluded`, leaving split 60+25+40=125. Keep old outcomes and old split immutable as historical evidence; append a criterion-v2 artifact and update canonical assertions/board contract explicitly through their owners.
5. Ownership after separate apply authorization: `scripts/scan-quest-surface-answer.js`, new `scripts/lib/questColorLexemes.js`, `__tests__/scripts/scanQuestSurfaceAnswer.test.ts`, `__tests__/scripts/fixtures/quest-surface-color-lexemes-v2.json` and controls `__tests__/scripts/fixtures/quest-surface-color-controls-v2.json`; portable 124-row corpus (60 resolved,40 structural,22 removed,2 extra independent signals; changed step300 is already resolved) fixture with the 60 resolved ids and changed rows, `.agents/skills/metravel-quest/SKILL.md` section 4f, `docs/PROBLEM_MEMORY.md` canonical family control, approved OpenSpec paths. Backend and source content are outside ownership.

Rejected alternatives: a `сохран` stop-list item leaves the family unresolved; word-start matching still matches «синагога» and «серия»; rewriting the task invents editorial scope; adding its marker to baseline hides the criterion bug; frozen count 107 ignores the known artifact rather than measuring coverage.

## Risks / Trade-offs

- [Rare color forms lost] → corpus before/after rows, 171 unique positive words including reviewed out-of-corpus inflections, one true example for each of the 92 old roots, all tested through task and dictionary consumers, all true historical marker forms retained; fail apply if a removed actual color cannot be explained.
- [Historical audit reproducibility depends on ignored corpus] → preserve original immutable outputs and add a minimal portable regression corpus tied to reviewed ids/reasons; never make tests depend on `.quest-audit/` availability.
- [Unexpected new marker] → assert every new key is contained in old keys for every corpus row; treat any violation as a candidate bug, never expand baseline.
- [Phrase-level false-word exclusions remain legacy behavior] → preserve precedence in this scope; compound phrases containing a known excluded noun need a separate documented criterion change.
- [Prototype vocabulary over/under-inclusion outside measured corpus] → independent review must assess morphology groups, and corpus evidence proves current snapshots only.

## Migration Plan

Present this planning package; separate owner request approves protected paths and starts apply. Then integrate lexical criterion, tests and documentation, append revision evidence and obtain independent code review. No production API or content writes are required for this tool-only change. Rollback removes the lexical module/use, new tests and criterion-v2 documentation together; old baseline remains intact.

## Validation matrix

| Target | Required evidence |
|---|---|
| Node scanner, two consumers | positive/negative lexical controls; exact Ogulin fixture, green counting, empty direct question, materials, all historical resolved ids preserved |
| Historical corpus | 139 quests/1160 steps, 107→85 scope, 40→40 structural membership; 8 structural rows lose non-color markers, retained independent material markers; 22 removals exclusively prior excluded; all true old color markers retained |
| Local source snapshot | 204 quests/1857 steps, 115→91 findings, 52→52 structural membership; 11 structural marker rows change, every changed row listed; remeasure if shared sources change |
| Baseline | unchanged bytes; «синий»→«белый» stays fresh; new color stays fresh; no update-baseline |
| Static checks | targeted scanner Jest, node syntax, validator-contract-change guard, external-links/image/governance and complexity guards under existing operation ownership |
| Docs/skill | validator for changed quest skill and `npm run audit:prompts` |
| App platforms/locales | none: no visible/runtime/i18n diff, no browser/device gate |

Data/API/auth/platform split: none, no product contract changes. SEO, accessibility, CWV, media, security and analytics: none, Node-only execution. No tokens/secrets or network runtime are needed.
