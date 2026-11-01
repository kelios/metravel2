#!/bin/bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-target.sh"
require_deploy_target

quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
action="${1:-}"
sha="${2:-}"
helper=deploy/prod/web_ssr_release.py
remote_prefix="cd $(quote "$PROD_REMOTE_DIR") && "
ssh_args=(-o BatchMode=yes -o ConnectTimeout=15)
# The helper starts compose services (quest-web-refresh) whose environment
# interpolates the production secrets kept in ~/.bashrc: an interactive shell,
# as for deploy/prod/release_app.sh. Without it the refresher crash-loops on
# SECRET_KEY and every quest page and the home page answer 503. Its stdout
# stays clean (job-control notices go to stderr), so JSON replies parse.
remote_shell() { ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" "bash -ic $(quote "$1")"; }

if [[ "$action" == capability ]]; then
  remote_shell "${remote_prefix}if [ -f $helper ]; then python3 $helper capability; else printf '%s\\n' '{\"schema_version\":1,\"available\":false,\"enabled\":false}'; fi"
  exit
fi
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid SSR source SHA' >&2; exit 1; }
receipt="web-ssr/receipts/$sha.json"
remote() { remote_shell "${remote_prefix}python3 $helper $*"; }

case "$action" in
  stage)
    candidate="${3:?SSR candidate directory required}"
    [[ -d "$candidate/runtime" && -f "$candidate/.ssr-build.json" ]] || { echo 'Incomplete SSR candidate' >&2; exit 1; }
    # Recheck the backend-owned path/checkout gate immediately before writing,
    # not only before the several-minute build in deploy-prod.sh.
    capability="$(remote capability)"
    node -e 'const {resolveWebSsrCapability}=require(process.argv[1]); const c=resolveWebSsrCapability(JSON.parse(process.argv[2])); if(c.output!=="server" || (process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR==="true" && !c.questRuntime)) process.exit(1)' "$SCRIPT_DIR/lib/webOutput.js" "$capability"
    metravel_deploy_defaults
    # The chunk limit is applied on the host after the stage; a malformed value
    # must stop the deploy here, before the upload and the seal.
    [[ "${SSR_RELEASE_JS_MAX_MB:-}" =~ ^[0-9]*$ ]] || { echo 'SSR_RELEASE_JS_MAX_MB must be a whole number of megabytes' >&2; exit 1; }
    incoming="$PROD_REMOTE_DIR/web-ssr/incoming/$sha"
    release_client="$PROD_REMOTE_DIR/web-ssr/releases/$sha/client"
    payload_kib="$(du -sk "$candidate" | awk '{ print $1 }')"
    # Ready books are immutable by revision (#2857): an unchanged book is
    # uploaded once and then hard-linked from the shared store on the host, so
    # neither the transfer nor the release pays its 226 MB again. The store
    # lives outside releases/<sha> and is refreshed and pruned after the stage
    # by web-ssr-release-audit.sh. The dry run tells how much the upload will
    # actually bring, so the disk preflight counts the shared books as free.
    books="$candidate/client/travel-books"
    books_store="$PROD_REMOTE_DIR/web-ssr/shared/travel-books"
    books_rsync=(rsync -aH --delete --mkpath --protect-args --link-dest="$books_store")
    if [[ -d "$books" ]]; then
      books_kib="$(du -sk "$books" | awk '{ print $1 }')"
      ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" "mkdir -p $(quote "$books_store")"
      books_transfer="$("${books_rsync[@]}" --dry-run --stats "$books/" "$PROD_SSH_TARGET:$incoming/client/travel-books/" \
        | awk -F': ' '/^Total transferred file size/ { gsub(/[^0-9]/, "", $2); print $2 }')"
      [[ "$books_transfer" =~ ^[0-9]+$ ]] || { echo 'Cannot size the book transfer' >&2; exit 1; }
      payload_kib=$(( payload_kib - books_kib + (books_transfer + 1023) / 1024 ))
    fi
    # The same pre-transfer reserve contract as the static publisher; private
    # server generations also consume the production filesystem.
    ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- preflight \
      "$PROD_REMOTE_DIR" "$payload_kib" "${DEPLOY_DISK_RESERVE_MB:-720}" "${DEPLOY_BACKEND_BUILD_MB:-1536}" \
      < "$SCRIPT_DIR/deploy-disk-guard.sh"
    if [[ -d "$books" ]]; then
      "${books_rsync[@]}" -zhe ssh "$books/" "$PROD_SSH_TARGET:$incoming/client/travel-books/"
    fi
    # The excluded books are also protected from `--delete` on the receiver.
    rsync -azHhe ssh --delete --mkpath --protect-args --exclude=/client/travel-books/ "$candidate/" \
      "$PROD_SSH_TARGET:$incoming/"
    if [[ "${EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR:-false}" == "true" ]]; then
      remote stage --sha "$sha" --overlay-retention-days "$EXPO_OVERLAY_RETENTION_DAYS" --overlay-max-mb "$EXPO_OVERLAY_MAX_MB"
    else
      remote stage --sha "$sha"
    fi
    remote preflight --sha "$sha"
    # What was sealed: book sharing and the chunk overlay the backend ran with
    # its output captured. The chunk limit stops the deploy before the swap.
    ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- books "$release_client" "$books_store" \
      < "$SCRIPT_DIR/web-ssr-release-audit.sh"
    fresh_js_kib=0
    if [[ -d "$candidate/client/_expo/static/js" ]]; then
      fresh_js_kib="$(du -sk "$candidate/client/_expo/static/js" | awk '{ print $1 }')"
    fi
    ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- chunks "$release_client" "$fresh_js_kib" \
      "$EXPO_OVERLAY_MAX_MB" "${SSR_RELEASE_JS_MAX_MB:-}" \
      < "$SCRIPT_DIR/web-ssr-release-audit.sh"
    ;;
  verify-code)
    remote verify-code --sha "$sha"
    ;;
  activate|rollback|finalize|publish-code|rollback-code|finalize-code)
    if [[ "$action" == activate || "$action" == publish-code ]]; then
      remote "$action" --sha "$sha" --receipt "$receipt"
    else
      remote "$action" --receipt "$receipt"
    fi
    ;;
  *) echo 'Expected capability, stage, activate, rollback, finalize or code publication action' >&2; exit 1 ;;
esac
