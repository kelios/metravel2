## Context

See proposal.md. Node's default HTTP agent retains keep-alive sockets; graceful Gunicorn worker retirement can race their reuse. The internal API path bypasses nginx's retry. Production measured three ECONNRESET/reusedSocket=true failures in 360 requests; baseline artifacts are in `.codex-temp/task-2818/`. `fetchPublicRouteJson.ts` starts the existing 10-second abort timer; nginx waits 15 seconds for the complete render.

## Goals / Non-Goals

Goals: recover only the confirmed retired-socket failure for all SSR loader consumers. Non-goals: admission queue, warmup, concurrency or timeout change, blanket retry, backend source edits.

## Decisions

Reuse `scripts/lib/ssrApiTransport.js`; no new module or packaging change. Within its existing promise, attempt once normally and once with `agent:false` only for request ECONNRESET with `reusedSocket=true`, no response started, and active original signal. Keep headers, GET, redirect behavior and body limit. Catch synchronous retry construction failures through the same rejection path.

An HTTP status or partial body is a real response, so it never triggers recovery. Avoid logging URLs, headers or error objects. Regression coverage uses a real local HTTP server and deterministic socket retirement instead of mocking the transport under test.

Rejected: increase the 10-second timeout, since observed failures finish earlier; warm the sitemap or serialize renders, since neither removes the connection race; retry all errors, since this amplifies genuine API outages.

Widened 27.10.2026 by production evidence: the first full post-deploy scan after deploy `6183122ad` still had one 503 whose API request vanished during a Gunicorn worker replacement (no app log line) — the retiring worker had accepted a fresh connection just before exiting. Recovery now covers ECONNRESET/EPIPE/ECONNREFUSED on reused and fresh connections before any response, once, after a 150 ms replacement delay that the original signal can cancel. The bound (at most two connection attempts, no retry of HTTP statuses, timeouts or partial bodies) keeps genuine outages visible; the transport logs only the error code, attempt and reuse flag.

Root owns planning/board/evidence; worker owns transport and tests. Backend rollback #2819 remains a read-only dependency: finalized rollback must validate the active pair and previous generation, restore client/renderer/builder, reject stale receipts and preserve history when republishing the same SHA.

## Risks / Trade-offs

- Additional GET after the server might have accepted the first → only idempotent guest reads, one retry, original deadline, fresh socket.
- Partial response retried accidentally → response-start guard and truncated-body regression.
- Apparent success on warm cache → direct renderer probes bypass nginx cache at 4/8/12 and a production post-deploy scan.
- Current rollback helper refuses finalized → recover frontend through a reviewed forward fix until #2819 is accepted; never edit pointers manually.

## Migration Plan

No data migration. Code-only review-and-fix, independent gate, explicit-path commit/push, status testing, canonical frontend deploy. Repeat baseline on the actual deployed source SHA. Preserve full #2818 Done gate until #2819 and its production drill pass.

## Validation matrix

Transport unit regressions plus existing loader tests cover desktop/mobile web together; no UI/layout change, hence no duplicate viewport scenario. Direct renderer 4/8/12 and full post-deploy SEO statuses prove production availability. RU is the representative runtime locale; unchanged transport/header contracts cover BE/UK/PL/EN. Android/iOS are outside the Node runner boundary. Source checks cover Host, abort, 404/410/503, redirect and byte-bound invariants. SEO content, accessibility, media, analytics and native behavior do not change.
