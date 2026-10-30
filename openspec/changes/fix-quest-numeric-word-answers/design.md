## Context

See proposal.md. `utils/questAdapters.ts` builds shared answer functions; `utils/questAnswerEvaluation.ts` is the single evaluation entry. Numeric branches currently use prefix parsers. Text normalization removes punctuation and must not be repurposed as numeric parsing. The live Sofia pattern is `range` with min=max=2.

## Goals / Non-Goals

Use one pure numeric parser across numeric answer branches and numeric variants. Keep API schemas, platform input components, saved values, number keyboards, morphology, final-point policy and privacy intact. No backend edits or authored-content changes.

## Decisions

- Add a bounded full-string parser with literal validation and per-language cardinal lexicons/grammar for 0–999. Reject cross-language compounds, ordinals, arbitrary phrases, infinities and malformed prefixes.
- Numeric equality uses original strings before punctuation normalization. Existing textual matching remains available for nonnumeric authored variants. Integer patterns reject fractions; approximate patterns retain decimal support and tolerance.
- Literal values outside JavaScript's safe numeric range, or fractions rounded into integers by conversion, fail closed. Unsupported numeric literals never become textual variants.
- Reuse the existing checker/evaluator and regression corpus. Rejected alternative: changing only Sofia to a manual dictionary, which leaves other count steps with the same defect. Avoid a third-party language parser and an unbounded general-language grammar.
- Ownership: numeric utility, adapter and focused tests belong to the implementing agent; planning and feature documentation belong to the primary session. Independent reviewer covers the full diff.

## Risks / Trade-offs

- Accidental false positives → tests for different quantities, decimals/signs, malformed words, ordinals and the existing rejected-answer corpus.
- Words beyond 999 → remain unsupported; large numeric literals remain supported. No claim of complete natural-language parsing.
- Shared platform logic → run one pure behavior suite covering all current locales; no platform-specific code changes or device capability gates.
- SEO, media, auth, external links, focus and analytics event schemas → unaffected; no new requests, dependencies or rendered UI.

## Migration Plan

No data migration. After targeted checks, independent review and code-review gate, commit explicit task paths and push main. Use the project production-deploy operator and verify the published source plus one representative answer flow. Do not replay or modify progress 595. Rollback is a revert of the task commit followed by the normal deployment pipeline.

## Validation

Failing-before/passing-after Sofia regression; literal/cardinal cases in all five locales; exact/exact_any/range/any_number/approx boundaries; free-text and rejected-answer regressions; targeted lint and typecheck; OpenSpec validation and prompt audit. One representative production browser flow after review, with a disposable test identity only if persistence is needed. This is a shared logic change with unchanged rendering, so duplicate viewport and native runs add no distinct assertion. Recheck when numeric grammar, checker normalization or pattern semantics change.
