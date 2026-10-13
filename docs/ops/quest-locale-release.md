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
inspection. Owner must select `QUEST_SEO_MANAGED_MAX_BYTES` from actual candidate
+ active + rollback + reader-pinned usage and free headroom; there is no guessed
default or automatic cleanup. Existing disk reserve/backend-build floor apply.
Explicit bounded backend cleanup preserves active, rollback and pinned readers.

Static preflight accepts a bind of the static directory or its ancestor (for
example, the checkout bound to `/app`). It resolves the most specific covering
bind and checks the host/app/Nginx directory device, inode and owner. The app
must use that owner UID with writable directory access. Foreign roots, symlink
paths, read-only app binds and mounts nested below static fail before any lock
or package mutation; a dedicated `/app/static` bind is not required.

Download old assets while holding the release reader pin. Apply the existing
14-day/256-MiB overlay locally, preserving mtimes and the replaced generation's
exception. After all postprocessing/marker/overlay, run the full quest static
verifier, R2/finalizer, then package verifier. No mutation follows sealing.
Archive transfer creates only new app-owned regular files/directories and
rejects links, traversal, duplicate paths, unreadable subtrees and >2 GiB or
50k entries. It preserves the complete export, including unrelated routes.

Private state and adjacent `*.package.tar.gz` persist outside the disposable
worktree under `.codex-temp/deploy/`, alongside the log. They record actual SHA,
ID, manifest/archive digests, inventory, receipts and failure/actual-pointer
evidence. Never place private state/receipts inside dist.

For an already managed root, after source review and authorized target:

```bash
QUEST_SEO_MODE=translations QUEST_SEO_MANAGED_MAX_BYTES="$OWNER_BYTE_BUDGET" \
  DEPLOY_QUIET=1 scripts/deploy-prod.sh "$FRONTEND_SHA"
```

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
Preserve the backup, publish a second complete translated generation and retain
RU rollback. D enables compatible gateway/exposure after A/B/E acceptance. No
normal command converts a legacy directory or reuses an ID with changed bytes.

After an ambiguous failure, inspect the actual pointer and keep both trees.
Authorized `bash scripts/quest-seo-operation.sh recover "$STATE"` replays only
when actual pointer already names the candidate, checking the real saved
rollback ID. Another publisher's root is never overwritten. Authorized
`bash scripts/quest-seo-operation.sh rollback "$STATE"` uses the same preflight,
backend command and current CAS. It retains generations and live withdrawal
filtering; failed recovery preserves evidence for the owner.

Production acceptance remains on #2363/#2366: actual revisions/mounts/config,
root/manifest/receipts, complete no-JS status/head/body/locale and effective
prefixed sitemap parity, RU/unrelated controls, desktop/mobile evidence,
controlled withdrawal/change/republish/source drift with warm validators,
concurrent pinned readers and rollback without resurrection, matched
TTFB/LCP/CLS and build duration/requests/bytes. Local gates do not close it.
