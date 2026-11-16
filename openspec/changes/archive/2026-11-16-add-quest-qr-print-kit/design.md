## Context

QuestPrintable supplies an existing print family and ready books supply licensed Noto fonts and vector QR practice. Gameplay detail GET increments views; safe published projections do not. Existing discovery and public-page validators already enforce identity and schema. Standard GA page_location retains query, and quest_start uses existing campaign context; actual human starts belong to pilot3250.

## Goals / Non-Goals

Goals: one local command, two PDFs per real quest, traceable source/UTM, all five localized label sets and digitally verified QR.
Non-goals: new application screen, gameplay/answers/content mutation, backend implementation, printing/distribution, social accounts, new event taxonomy or invented conversions.

## Decisions

CLI reads safe RU published discovery to resolve numeric/string id, then requested-locale published detail. Reuse validateQuestDiscovery and validateQuestPublicProjection. Only404 may trigger a RU detail read. Invalid identities,503 and absent trip_facts fail closed. API duration/is_free are authoritative; unknown time is labelled unknown and false is_free suppresses the free claim. Preserve API heading and record content locale separately from paper locale.

A pure typed model uses getFixedTranslator and formatInteger, existing books namespace keys, buildQuestLocalePath and UTM_MEDIUMS.referral. QRCode provides a local matrix; ReportLab renders its vector modules, embedded licensed Noto and the existing PRINT_COLORS. No remote QR/image service, gameplay API, browser, cloud or fee. Rejected a full quest-book export because it includes gameplay and unnecessary map/media; rejected arbitrary HTML/browser PDF for this small physical layout because existing fonts/colors and direct measured text fit suffice.

Geometry/typography is fixed by docs/design/quest-qr-print-kit.md: A5 safe10mm,70mm QR;100×120mm sticker safe7mm,45mm QR; min title18pt/12pt. Every QR has4 quiet modules and min0.4mm/module. Text wraps by actual glyph widths and never truncates. Both QR and PDF annotation share one target. Output stages privately and commits only after both PDFs succeed; refuse occupied output. Manifest stores public source hash/revision, exact text, PDF boxes/hash and layout metrics.

Scope: scripts/quests/build-qr-kit.mjs, scripts/quests/render-qr-kit.py, scripts/quests/qr-kit-model.ts, five books locale resources, focused tests/snapshots, own feature/design docs and OpenSpec. Backend remains readonly.

## Risks / Trade-offs

Local published discovery currently503 because its publisher is not bootstrapped. The changed boundary is the local CLI/PDF, so selection-gate refinement uses actual anonymous published production API data with local artifact generation; no unrelated publisher bootstrap, fake data or claim of local-API readiness. Requested locale may have RU content; record it and link only to actual publication. Unknown time stays unknown. Metadata alone is not a scan proof; decode exact rendered PDF pages. Noindex is allowed. ReportLab/Python and decoder/Poppler setup are documented.

Validation selection: pure model and CLI behavior, all five resource labels + test:i18n, scoped lint, geometry/text/font/link checks and300dpi color/grayscale decoding for two actual quests, one attributed landing/analytics transport assertion. Reuse existing UTM/quest context tests for unchanged event policy; no repeated app viewport/native matrix. Code review-auditor then formal gate before local runtime acceptance; no production app deploy needed for CLI-only change. Source-data reads are not QA verdicts. Existing shared quality/host leases remain binding. Rollback: revert task commits; no data migration.
