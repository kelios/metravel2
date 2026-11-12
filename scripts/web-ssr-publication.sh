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

# #3307: `publish-code <sha> --expect-current <sha|none>` hands the server the
# revision the rollout was checked against; under its lock the helper refuses
# the switch when the current pair is another one (#3308).
# #3334: `--publication-id <id>` on publish-code, finalize-code and
# rollback-code is the identity of one rollout (backend #3310). The receipt
# lives at web-ssr/receipts/<sha>.json, so without the id a session could
# finalize or roll back another session's publication of the same revision.
# The caller generates the id before publish-code and passes the same one to
# all three actions, and only to a helper whose capability advertises it.
# Three answers mean "refused before any write" and leave with their own codes;
# the caller must not answer them with rollback-code:
#   75  current_changed: production moved on, or already serves this sha;
#   77  publication_mismatch: the receipt belongs to another publication (or is
#       absent, or the release is already accepted) — nothing was changed;
#   78  the host helper rejected the argument itself (argparse, before the lock).
# All are recognised by the helper's stderr line, not by the exit status that
# travelled through ssh and `bash -ic`; no other failure leaves with 75, 77 or 78.
EXIT_OVERTAKEN=75
EXIT_NOT_OURS=77
EXIT_UNSUPPORTED=78
expect=''
publication=''
code_errors=''
code_usage() {
  if [[ "$action" == publish-code ]]; then
    echo 'Expected: publish-code <sha> [--expect-current <full lowercase sha|none>] [--publication-id <16-64 of A-Za-z0-9_->]' >&2
  else
    echo "Expected: $action <sha> [--publication-id <16-64 of A-Za-z0-9_->]" >&2
  fi
  exit 1
}
parse_code_options() {
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == --expect-current && "$action" == publish-code && -z "$expect" && $# -ge 2 && "$2" =~ ^([a-f0-9]{40}|none)$ ]]; then
      expect="$2"
    elif [[ "$1" == --publication-id && -z "$publication" && $# -ge 2 && "$2" =~ ^[A-Za-z0-9_-]{16,64}$ ]]; then
      publication="$2"
    else
      code_usage
    fi
    shift 2
  done
}
unsupported_argument() {
  local flag="$1" value="$2" contract="$3"
  # Без якоря начала строки: вывод ~/.bashrc через `bash -ic` может стоять на той же строке.
  [[ -n "$value" ]] && grep -Eq "[^ ]+: error: .*$flag" "$code_errors" || return 0
  echo "❌ Помощник публикации на хосте не принял $flag $value — отказ до замка и записи, прод не менялся" >&2
  echo "   Бэкенд на хосте старее контракта $contract либо отклонил значение: выкатите бэкенд и повторите выкат фронта." >&2
  exit "$EXIT_UNSUPPORTED"
}
code_action() {
  local status=0 refusal actual state owner
  local args=(--receipt "$receipt")
  parse_code_options "$@"
  if [[ "$action" == publish-code ]]; then args=(--sha "$sha" --receipt "$receipt"); fi
  if [[ -n "$expect" ]]; then args+=(--expect-current "$expect"); fi
  if [[ -n "$publication" ]]; then args+=(--publication-id "$publication"); fi
  code_errors="$(mktemp -t metravel-code-action 2>/dev/null || mktemp /tmp/metravel-code-action.XXXXXX)"
  trap 'rm -f "$code_errors"' EXIT
  # The helper's stderr is shown as it arrives and kept for its refusal line.
  { remote "$action" "${args[@]}" 2>&1 >&3 | tee "$code_errors" >&2; } 3>&1 || status=$?
  [[ "$status" != 0 ]] || return 0
  if [[ -n "$expect" ]]; then
    # Not anchored at the line start: output of the interactive remote shell
    # without a trailing newline may precede the helper line on the same line.
    # The exact expected= value keeps a foreign refusal from matching.
    refusal="$(tr -d '\r' <"$code_errors" |
      grep -E "web-ssr release refused: current_changed expected=$expect actual=([a-f0-9]{40}|none) mutation=none\$" |
      tail -n 1 || true)"
    if [[ -n "$refusal" ]]; then
      actual="${refusal#* actual=}"
      actual="${actual% mutation=none}"
      if [[ "$actual" == "$sha" ]]; then
        echo "❌ Ревизия ${sha:0:9} уже публикуется или опубликована другой сессией — наш релиз не переключался, чужой не финализируется и не возвращается" >&2
      else
        echo "❌ Нас обогнали: прод уже ушёл на ${actual:0:9}; наш ${sha:0:9} не опубликован — ничего не возвращалось" >&2
      fi
      exit "$EXIT_OVERTAKEN"
    fi
  fi
  # #3334: the helper names the receipt it refused; `sha=none` is a receipt
  # whose name is not a revision.
  refusal="$(tr -d '\r' <"$code_errors" |
    grep -E "web-ssr release refused: publication_mismatch sha=($sha|none) state=[a-z_]+ receipt=(bound|unbound|missing) mutation=none\$" |
    tail -n 1 || true)"
  if [[ -n "$refusal" ]]; then
    state="${refusal#* state=}"
    state="${state%% *}"
    owner="${refusal#* receipt=}"
    owner="${owner%% *}"
    echo "❌ $action ${sha:0:9}: это не наша публикация (state=$state, receipt=$owner) — сервер отказал до записи, прод этим вызовом не менялся; чужая публикация не финализируется и не возвращается" >&2
    if [[ "$owner" == missing ]]; then
      echo "   Receipt этой публикации на хосте нет: она ничего не переключала, возвращать нечего." >&2
    elif [[ "$state" == finalized ]]; then
      echo "   Релиз ${sha:0:9} уже принят (finalize-code завершён), автоматика его не возвращает: docs/WORKFLOW_OPERATIONS.md → «Аварийный возврат прошлой версии», путь 2." >&2
    elif [[ "$owner" == bound && -z "$publication" ]]; then
      echo "   Receipt привязан к идентификатору публикации: повторите с --publication-id <id> из лога того выката (строка «🔖 Публикация»)." >&2
    elif [[ "$owner" == unbound ]]; then
      echo "   Receipt записан без идентификатора (клиент до #3334): его публикацию ведёт та сессия; вручную — та же команда без --publication-id." >&2
    else
      echo "   Receipt ведёт другая сессия выката: её публикацию примет или вернёт она сама. Сверьте https://metravel.by/.build-source.json" >&2
    fi
    exit "$EXIT_NOT_OURS"
  fi
  unsupported_argument --expect-current "$expect" '#3308'
  unsupported_argument --publication-id "$publication" '#3310'
  if [[ "$status" == "$EXIT_OVERTAKEN" || "$status" == "$EXIT_NOT_OURS" || "$status" == "$EXIT_UNSUPPORTED" ]]; then status=1; fi
  exit "$status"
}

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
    # Ready-book files live in S3 (#2971): the release carries only
    # client/travel-books/manifest.json, so it travels with the rest of the
    # candidate. The books audit below refuses anything else there and drains
    # the former shared store (#2857) as old releases leave the retention.
    books_store="$PROD_REMOTE_DIR/web-ssr/shared/travel-books"
    # The same pre-transfer reserve contract as the static publisher; private
    # server generations also consume the production filesystem.
    ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- preflight \
      "$PROD_REMOTE_DIR" "$payload_kib" "${DEPLOY_DISK_RESERVE_MB:-720}" "${DEPLOY_BACKEND_BUILD_MB:-1536}" \
      < "$SCRIPT_DIR/deploy-disk-guard.sh"
    rsync -azHhe ssh --delete --mkpath --protect-args "$candidate/" \
      "$PROD_SSH_TARGET:$incoming/"
    if [[ "${EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR:-false}" == "true" ]]; then
      remote stage --sha "$sha" --overlay-retention-days "$EXPO_OVERLAY_RETENTION_DAYS" --overlay-max-mb "$EXPO_OVERLAY_MAX_MB"
    else
      remote stage --sha "$sha"
    fi
    remote preflight --sha "$sha"
    # What was sealed: release books and the chunk overlay the backend ran with
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
    if [[ "$action" == publish-code || "$action" == rollback-code || "$action" == finalize-code ]]; then
      code_action "${@:3}"
    elif [[ "$action" == activate ]]; then
      remote "$action" --sha "$sha" --receipt "$receipt"
    else
      remote "$action" --receipt "$receipt"
    fi
    # The disk line of the deploy report (#2186) lived in the static publisher
    # and was lost with it (#2980). Finalize has already applied the release
    # retention, so this is the disk the next deploy and the backend start from.
    # The deploy is done here: a failed report only says so.
    if [[ "$action" == finalize || "$action" == finalize-code ]]; then
      ssh "${ssh_args[@]}" "$PROD_SSH_TARGET" bash -s -- report \
        "$PROD_REMOTE_DIR" "$PROD_REMOTE_DIR/web-ssr/releases" "${DEPLOY_BACKEND_BUILD_MB:-1536}" \
        < "$SCRIPT_DIR/deploy-disk-guard.sh" \
        || echo "⚠️ Отчёт о диске прода не получен; релиз уже финализирован — место проверить вручную (docs/ops/prod-disk-growth.md)"
    fi
    ;;
  *) echo 'Expected capability, stage, activate, rollback, finalize or code publication action' >&2; exit 1 ;;
esac
