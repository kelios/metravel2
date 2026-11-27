## Context

See proposal.md. Existing OpenCode and the student runner already provide a
local-only provider, raw events and watchdog. The ordinary PhpStorm profile
remains unchanged. Browser MCP is an official, separately installed dependency;
its current version often returns snapshot/screenshot file links.

## Goals / Non-Goals

Goals: a reusable local QA experiment, truthful raw evidence, narrow authority,
mobile/desktop sessions and a reviewable final result. Non-goals: an automatic
site acceptance judge, crawler claiming all content coverage, or a secure OS
sandbox. Product code and backend contracts are unchanged.

## Decisions

1. Reuse the student watchdog with an additive step-budget argument (default16
   preserved), QA24/600s, instead of a second process lifecycle implementation.
2. Use a separate browser-only primary profile with the local Gemma provider,
   actual image-input capability and no cloud fallback. The main64-role coding
   catalog is unnecessary in each QA request.
3. Place browser workspace/CWD and all reports in one ignored run directory;
   allow native read only there. File links require reading the actual snapshot;
   stale refs after hydration require a new observation, not forced clicking.
4. Use an isolated guest browser; block non-read HTTP methods and outside
   top-level navigation. Preserve blocked-request receipts separately from bugs.
   This is a workflow guard, not a promise against every browser/OS escape.
5. Save raw events and a mechanical receipt. Exit zero means a report draft is
   available; it never grants teacher acceptance. Readability checks cannot
   establish arbitrary UX correctness or the meaning of every claimed action.
6. Preserve original failed attempts. Evaluate independent planning, real actions,
   visual input, coverage and reporting separately; teacher fixes to instructions
   do not turn the initial attempt into an unassisted success.

The rejected alternative is a broad shell-enabled coding profile browsing the
site with an unbounded context: it adds authority and irrelevant context without
proving QA quality. A new full agent framework is unnecessary for this trial.

## Risks / Trade-offs

- Model invents PASS from href/file → compare report with real actions and files;
  keep teacher-required state regardless of CLI code.
- Tool emits file links without pixels → distinguish file creation, attachment
  and provider delivery; visual PASS needs actual image-input evidence.
- Initial SSR refs become hidden after hydration → fresh state and bounded retry.
- Long snapshots fill context → short per-feature batches and bounded reads;
  do not claim a prompt word limit is a hard enforced limit.
- Public-only policy leaves functional states untested → explicit coverage matrix;
  broader account/data testing requires its own scoped workflow.

## Migration Plan

Add `.aiassistant/qa/`, the narrow watchdog extension, a canonical skill reference
and usage link. Validate mock/config tests and independent source review, then
commit/push exact paths. Acceptance targets this Mac and the installed profile
against the declared live site revision. No deployed product module changes;
web rollout does not validate the local client. Rollback removes the optional
QA entry point; the normal coding profile and prior student defaults remain.
