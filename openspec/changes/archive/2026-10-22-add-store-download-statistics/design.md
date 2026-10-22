## Context

See proposal.md for scope. `metrics-summary-sources.js` isolates sources and `metrics-summary.js` renders the existing owner report. There is no supported local Apple statistics credential adapter. Existing Google release status calls create temporary publication edits and are inappropriate for read-only analytics.

## Goals / Non-Goals

Reuse the report pipeline and import official exports without expanding credentials. No store changes, backend work, UI redesign, device testing or web deployment: all observable changes belong to the owner CLI.

## Decisions

1. Add `store-download-reports.js`, focused tests, and `--store-reports-dir` defaulting to ignored `.codex-temp/store-reports`. Use `manifest.json` `{schemaVersion:1,reports:[{source,file,from,to,calendar,coverage,appId|packageName,dimension?}]}`. `coverage` distinguishes complete export coverage from partial data; exact dates are independent of whether a month has ended. Source enums are `apple-sales-summary` and `google-play-installs`. Source identities must match the current published app/package. Deriving coverage from a filename or file mtime was rejected because it creates false historical zeroes.
2. Apple: bounded gzip/UTF-8 TSV; required Apple Identifier, Product Type Identifier, Units, Begin Date, End Date. Initial types 1/1F/1T and redownload 3/3F are separate; updates and IAP excluded. Negative relevant Units make acquisitions unqualified rather than clamped. Google: UTF-16 BOM or UTF-8 CSV with quotes; Date, Package Name, Country, Daily Device Installs, Daily User Installs. Only country dimension supported initially. Do not mix distinct dimensions or unlike metric semantics.
3. Validate paths (including realpath), size, strict dates, numeric counts, headers and row identity. Both supported official report formats use Pacific Time: require the canonical `America/Los_Angeles` calendar rather than accepting arbitrary IANA overrides. Apple Begin/End Date describe the entire report window and must exactly match manifest boundaries; a daily report cannot qualify a full month. Reject overlap and duplicate rows instead of double-counting; preserve independent stores and bounded diagnostic codes. A complete valid zero is permitted; missing or malformed input is null.
4. Add qualified monthly store values and `storeDownloads.periods` to JSON/Markdown; current evidence remains outside existing twelve full months and YoY. Each period includes source, from/to, calendar, coverage, metrics and status. Keep app_download_click unchanged.
5. Official sources: [Apple summary](https://developer.apple.com/help/app-store-connect/reference/reporting/summary-sales-report/), [types](https://developer.apple.com/help/app-store-connect/reference/reporting/product-type-identifiers), [Apple report calendar](https://developer.apple.com/help/app-store-connect/measure-app-performance/view-units-proceeds-sales-and-pre-orders/), [Google exports](https://support.google.com/googleplay/android-developer/answer/6135870?hl=en), [Google installation calendar](https://support.google.com/googleplay/android-developer/answer/139628?hl=en). Read console exports only; do not create keys or change permissions.

## Risks / Trade-offs

- Export schema drift → strict parsing, fixtures for official schemas and explicit unsupported gaps.
- Partial/overlapping periods → qualify coverage and disallow double counting.
- Apple access unavailable → show source gap, continue Google report, request session refresh for actual figures.
- Export import is not an unattended API collector → document repeatable refresh and retain export provenance; do not describe imported evidence as live collection.
- Large/untrusted local input → compressed/decompressed limits, path confinement, safe error messages, no raw inputs in output.

## Migration Plan

Additive optional CLI flag and report fields. Existing sources continue when input is missing. Revert task-owned changes to roll back; keep original ignored exports intact. No app bundle changes or rollout are required.

## Validation Matrix

- Owner CLI: fixtures for app filtering, type exclusions, signed/invalid units, UTF-16/quoted CSV, dates/headers, missing files, unsafe paths, overlap, zero versus absent coverage, source independence, current periods and unchanged monthly windows.
- Static: targeted ESLint and scripts checks; OpenSpec strict validation and prompt audit for documentation.
- Independent code review-and-fix on complete task diff, then required code review gate.
- Testing: real downloaded export import and existing statistics CLI run, with exact store period and safe gap handling when a source is inaccessible.
- Desktop/mobile web, Android/iOS runtime, localization, SEO, accessibility and Core Web Vitals: no observable changes; no device/browser QA or web build/deploy required for this CLI-only change. Store discovery audit uses published pages and authenticated console reads independently of app runtime.
