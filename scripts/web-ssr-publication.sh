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
    payload_kib="$(du -sk "$candidate" | awk '{ print $1 }')"
    # The same pre-transfer reserve contract as the static publisher; private
    # server generations also consume the production filesystem.
    ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- preflight \
      "$PROD_REMOTE_DIR" "$payload_kib" "${DEPLOY_DISK_RESERVE_MB:-720}" "${DEPLOY_BACKEND_BUILD_MB:-1536}" \
      < "$SCRIPT_DIR/deploy-disk-guard.sh"
    rsync -azHhe ssh --delete --mkpath --protect-args "$candidate/" \
      "$PROD_SSH_TARGET:$PROD_REMOTE_DIR/web-ssr/incoming/$sha/"
    if [[ "${EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR:-false}" == "true" ]]; then
      metravel_deploy_defaults
      remote stage --sha "$sha" --overlay-retention-days "$EXPO_OVERLAY_RETENTION_DAYS" --overlay-max-mb "$EXPO_OVERLAY_MAX_MB"
    else
      remote stage --sha "$sha"
    fi
    remote preflight --sha "$sha"
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
