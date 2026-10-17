# Quest locale release — E #2366

The existing `scripts/deploy-prod.sh <full SHA>` retains its shared build lock,
isolated worktree and source/config/static gates. Backend C/D owns the private
v1 contract, Nginx, initial maintenance conversion and exposure. This transport
never changes backend tracked files.

`QUEST_SEO_MODE=legacy` is the default. Explicit `ru-only` or `translations`
builds full v1 exports. Both use complete private R1/R2 receipts without a quest
or locale selector. RU-only limits generated members and keeps all five error
artifacts. Transport/partial-catalogue/fence failures reject the whole package.
An active v1 pointer makes legacy publication/recovery/chunk replacement refuse.
Critical legacy mutations own the app operation flock themselves and compare
the expected directory device/inode; a separate lease process is insufficient.

V1 requires deployed `quest_seo_revision_receipt` / `quest_seo_activate`, matching
app/Nginx static bind mounts, the static owner UID and clean/untracked target
classification. Before copying, inventory all retained generations. Unknown,
unfinished or corrupt generations stop the release and remain for owner
inspection. The existing owner-selected `QUEST_SEO_MANAGED_MAX_BYTES=1610612736`
is a physical allocation ceiling; the backend build reserve remains 1536 MiB,
separate from that ceiling. A larger configured deploy reserve still applies.
Normal publication first invokes a separate, explicit retention operation with
`keep_releases=2`, preserving active, rollback and pinned readers. A pinned third
generation refuses staging. Activation performs no cleanup. Initial legacy
conversion retains its separately managed whole backup and never shares its
mutable inodes.

The private storage handshake is version 2; public manifest/activation/serving
contracts remain v1. `total_bytes` and backend `remaining_bytes` retain their
logical per-path meanings. Private `allocated_bytes` and
`remaining_allocated_bytes` count the physical union of unique device/inode
allocated blocks, including directories, locks, private indexes and all retained
roots. Logical limits remain 2 GiB / 50,000 paths per complete export.

Static preflight accepts a bind of the static directory or its ancestor (for
example, the checkout bound to `/app`). It resolves the most specific covering
bind and checks the host/app/Nginx directory device, inode and owner. The app
must use that owner UID with writable directory access. Foreign roots, symlink
paths, read-only app binds and mounts nested below static fail before any lock
or package mutation; a dedicated `/app/static` bind is not required.

After the source/dependency gates, capture old assets in parallel with cold
Metro, holding the release reader pin during download. The completed, closed
private archive sits beside release state with a unique build nonce, size and
SHA-256. The transient `captured` state binds that archive, state/export paths
and the complete current sealed identity. A legacy root also binds its host
device/inode, checked before and after download. No partial capture becomes
applicable. Before SEO generation the build waits and propagates capture failure.
The FIFO-controlled supervisor owns a detached IPC worker; cancellation signals
only that worker's own process group, escalates TERM to KILL after five seconds,
and waits before `.env` restoration or shared build-lock release. A completed
capture remains owned until explicit finish, so cleanup never signals an old PID.
The transport shell and its container-resolution SSH requests run inside that
owned group from the start, including cancellation before download begins.
The control FIFO stays writable throughout the finish wait so an interrupt can
still replace that pending finish with bounded cancellation.

After all HTML writers and the source marker, rerun static preflight and compare
the actual full base identity (or legacy host device/inode). Validate nonce/path
binding and the bounded private regular archive's hash/size before unpacking.
Apply the existing 14-day/256-MiB overlay locally, preserving mtimes and the
replaced generation's exception. Run the full live-catalog quest static verifier
once here for v1, then R2/finalizer and the independent postseal package verifier.
Legacy retains its earlier quest guard. Timings separately report parallel
capture, its wait, late apply, live verification, sealing, postseal verification
and private index/archive preparation. The 300-second budget, cold Metro,
request pacing, storage ceilings and backend reserve remain unchanged. No
mutation follows sealing.
For v1, collect SEO inputs while cold Metro exports: complete R1 precedes API
content reads. A private bounded0600 file in a0700 build-owned directory binds
nonce, frontend SHA, API origin, mode and the captured R1. Offline rendering
rejects incomplete/mismatched inputs and never falls back to HTTP. Retain the
same late R2/preseal/postseal guards. Normal exit and trapped INT/TERM/HUP reap
the owned collector group before env restoration or build unlock. Uncatchable
Bash SIGKILL triggers bounded group cancellation through owner loss, including
when FIFO EOF is not delivered; it cannot restore `.env` or promise unlock
ordering. Inspect the interrupted build state before another build.
Only after collection has finished may media audits start. Their network work
overlaps offline rendering and finishes before late API guards. Each retains
its own unfiltered catalogue, scan IDs, mandatory upload anchors and media
probes. Successful raw same-origin numeric travel-detail responses may be read
from this exact validated build input; missing IDs still use original paced
live requests. No cross-run cache or concurrent independent API producers.
Private capture v2 stores accepted numeric travel bodies once; normalized
travel-detail slots reference those exact raw records after shared-normalizer
equality checks. Successful slug fallbacks remain inline when no accepted numeric
raw exists. Only the generator materializes references; media audits read raw
records directly. Numeric section/framing byte diagnostics precede size refusal.
The128MiB capture limit, source completeness and all final guards remain fixed.
After postprocessing, prepare a private per-file index (at most 8 MiB / 50,000
paths), recording path, SHA-256, size, mode and canonical whole-second mtime.
Archive verification rejects symlinks, archive hardlinks, special files, traversal,
duplicates, unreadable subtrees and any mismatch with that index. Each incoming
new unique member is hashed through one bounded temporary file. Equal content files may
share an inode only within the candidate or with a sealed reader-pinned managed
generation, and only when size, SHA-256, mode and canonical mtime all match.
Secure no-follow parent opens and source byte/identity rechecks precede every
link. Shared inode metadata is never modified. Failed verification or linking
refuses; there is no full-copy fallback. The complete export, including unrelated
routes, remains independently readable. The tar uses gzip level 1 to bound local
compression work; this changes transfer compression, not expanded content.

Before archive transfer, storage planning checks current-pointer CAS, private
index digest, sealed source identities and physical usage. It admits the
incremental distinct content, a conservative directory/entry allowance, one
largest temporary member and the bounded private index/plan. Existing partials
and unknown files are never silently discarded. Stage recomputes the exact
plan under the operation lock, holds source reader pins throughout streaming,
checks budget/free headroom while writing, and checks final physical allocation
and CAS. The free-space check always preserves the 1536-MiB backend reserve.
An interrupted unsealed generation blocks another attempt until an explicit
provenance-based recovery decision; retaining its bytes does not imply success.
Streaming uses just one private `.storage-member.v2.tmp` beside `dist`, with no
temporary members exposed inside the public tree.

Private transfer-v3 wraps the unchanged storage-v2 plan and a deterministic
hash-bound list of missing content representatives. The local framer verifies
the entire prepared archive against its full index, then transmits only those
regular bodies. Stage recomputes both plans before candidate creation, rejects
any missing/extra/duplicate/unsafe body, writes/fsyncs each new unique body once
and reconstructs all indexed paths with verified hardlinks. A zero-body delta
is valid only when every key is verified in pinned sealed sources. V2 actions
remain supported. On-disk index/plan and abort-stage-v2 provenance stay v2;
public manifest, logical limits, physical peak/reserve and backend CAS stay
unchanged. The full prepared archive/index remain local integrity evidence.

Private state, adjacent `*.package.tar.gz`, `*.files.v2.json` and `*.plan.v2.json`
persist outside the disposable worktree under `.codex-temp/deploy/`, alongside
the log. V3 publication writes `*.plan.v3.json`; `state.storage_plan` remains v2
and separate `state.transfer_plan`/stage receipt bind the v3 wrapper hash.
The private v3 stage receipt records the staging process's actual peak RSS in
`max_rss_bytes`; this diagnostic does not alter resource admission or limits.
They record actual SHA, ID, manifest/archive/index digests, separate
logical/physical inventory, the peak plan, receipts and failure/actual-pointer
evidence. A bounded local `*.stage-v3` frame is removed after transfer. On the
server, index/plan provenance lives beside `dist`, never inside public dist.
Older prepared state without a v2 index requires fresh preparation with current
tooling; publication does not guess its storage needs or relax the budget.

For an already managed root, after source review and authorized target:

```bash
QUEST_SEO_MODE=translations QUEST_SEO_MANAGED_MAX_BYTES="$OWNER_BYTE_BUDGET" \
  DEPLOY_QUIET=1 scripts/deploy-prod.sh "$FRONTEND_SHA"
```

Translated publication requires a live canonical locale gateway **before**
retention or staging. Preparation records the first translated member's bounded
`gateway_probe_path`; normal publication derives it and `ru_only` again from the
manifest whose actual digest matches the prepared identity. A changed path or
forged mode fails before contacting the server. RU-only exports need no probe.
The read-only check compares the running Nginx config file's SHA-256 with the
backend checkout's canonical `deploy/prod/nginx/nginx.conf`, then performs a
five-second HEAD request to that public canonical route without following
redirects. It requires HTTP 200 or 404 and exact `Cache-Control: no-store`,
`Pragma: no-cache`, `Expires: 0`. Both the config identity and actual response
are required: a config file alone cannot establish that workers reloaded, and
one response alone cannot establish the complete canonical configuration.
Missing headers, legacy static handling, a mismatched config, redirects,
network failures and 5xx stop before generation retention or copying.
Canonical backend config must also reject direct `/static/dist` and
`/static/quest-seo-releases` aliases, owned `/static/legacy-2363-` backup paths
and `/static/.quest-seo-` state, including normalized equivalents. They cannot
bypass live eligibility or expose unactivated/retained HTML. Ordinary static
quest media and Expo assets remain positive controls.

Validate-only is not activation. Check exact receipt keys/schema/result, ID,
SHA, actual manifest digest, prior ID, `static/dist` and relative release root.
Activation owns its lock: never hold an outer flock around the command.
After activation, publish the existing shared fallback cover from the active
sealed tree to `/static/quests/quest-default-cover.svg` through the same app-owner
operation lock, identity/CAS and atomic sibling replacement. Preflight refuses
a tracked target; links/special targets and missing source bytes fail closed.
Rollback and recovery republish the corresponding active cover. This existing
shared asset stays outside dist; no sealed package bytes are changed.
Readiness requires exact 200, source marker, public controls including the
shared cover, and Nginx validation/graceful reload within one 30-second deadline.
Do not restart app.

Initial conversion is a separately authorized D maintenance operation. Prepare
a complete RU-only baseline without publication through the same entrypoint:

```bash
QUEST_SEO_MODE=ru-only QUEST_SEO_MANAGED_MAX_BYTES="$OWNER_BYTE_BUDGET" \
  DEPLOY=0 DEPLOY_QUIET=1 scripts/deploy-prod.sh "$FRONTEND_SHA"
```

Archive/state survive worktree removal. Owner stops publication/cleanup,
disables gateway/exposure, quiesces readers, retains the whole legacy backup
outside managed generations and moves it on the same filesystem per D runbook.
The frontend command never performs these steps. Only after owner makes the
active path absent:

```bash
QUEST_SEO_OWNER_MAINTENANCE=1 QUEST_SEO_MANAGED_MAX_BYTES="$OWNER_BYTE_BUDGET" \
  bash scripts/quest-seo-operation.sh baseline "$PREPARED_RU_STATE"
```

This requires a prepared RU-only archive, absent pointer and validate/activate
CAS `none`; the remote transport also checks actual first-generation members.
Preserve the backup and retain RU rollback. First certify the unchanged managed
RU root with exposure false, then switch only Nginx to the canonical config
under the frozen runtime/EX lease. Verify RU readiness, false-prefix rejection
and private-path denials before ending that bounded configuration window.
Only then stage/validate/activate translations through the ordinary online
publisher. Transfer and complete package hashing must not consume the closed
window. The earlier combined translated-config operator failed its180s budget
on17October and restored certified RU; that run is not release acceptance.
Its executable entry is retired; use the canonical-RU-only transition followed
by the ordinary online publisher.
Do not use the ordinary translated publisher while the legacy config is pinned;
its live gateway check deliberately refuses that ordering. Exposure remains a D
decision after A/B/E acceptance. No normal command converts a legacy directory
or reuses an ID with changed bytes. The server independently verifies that a
none-CAS initial baseline actually contains RU-only members, regardless of the
private state's flag.

After an ambiguous failure, inspect the actual pointer and keep both trees.
Authorized `bash scripts/quest-seo-operation.sh recover "$STATE"` replays only
when actual pointer already names the candidate, checking the real saved
rollback ID. Another publisher's root is never overwritten. Authorized
`bash scripts/quest-seo-operation.sh rollback "$STATE"` uses the same preflight,
backend command and current CAS. It retains generations and live withdrawal
filtering; failed recovery preserves evidence for the owner.

For an interrupted stage that never activated, explicitly abort only the exact
candidate bound to its saved index/plan before preparing a fresh generation:

```bash
bash scripts/quest-seo-operation.sh abort-stage "$STATE"
```

This acquires the operation lock and an exclusive nonblocking candidate reader
pin; it requires unchanged current-pointer CAS and rejects active, rollback or
sealed generations. Both private digests must match the saved state. Every
present dist file must be a fully verified subset of the index, including exact
metadata. Only the known private index/plan/lock, dist and one bounded regular
partial member are allowed; unknown entries refuse removal. Shared content
inodes survive via their other retained links. There is no automatic abort or
sweep. Death before complete private provenance requires owner inspection and
stays blocked. In initial maintenance, abort before restoring legacy when
possible; a restored legacy directory deliberately fails managed-pointer CAS.

Production acceptance remains on #2363/#2366: actual revisions/mounts/config,
root/manifest/receipts, complete no-JS status/head/body/locale and effective
prefixed sitemap parity, RU/unrelated controls, desktop/mobile evidence,
controlled withdrawal/change/republish/source drift with warm validators,
concurrent pinned readers and rollback without resurrection, matched
TTFB/LCP/CLS and build duration/requests/bytes. Local gates do not close it.
